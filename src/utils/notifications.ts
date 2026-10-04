/**
 * Web Notifications API Integration & Financial Risk Alert System
 * Handles browser push notifications for credit card due dates and budget overruns.
 */

import { Budget, Category, CreditCard, FinancialAlert, Transaction } from '../types/finance';
import { formatCurrency } from './formatters';
import { soundFX } from './audio';

export type BrowserPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Checks if the browser supports the Web Notifications API
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current Notification permission state
 */
export function getNotificationPermission(): BrowserPermissionStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as BrowserPermissionStatus;
}

/**
 * Requests permission from the user to display Web Notifications
 */
export async function requestNotificationPermission(): Promise<BrowserPermissionStatus> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      soundFX.playSuccess();
    }
    return permission as BrowserPermissionStatus;
  } catch (error) {
    console.warn('Error requesting notification permission (possibly iframe restricted):', error);
    return Notification.permission as BrowserPermissionStatus;
  }
}

/**
 * Dispatches a native browser Web Notification
 */
export function sendWebNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><circle cx="12" cy="12" r="10"/></svg>',
      ...options,
    });

    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (options?.onClick) {
        options.onClick();
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn('Failed to dispatch native Web Notification:', err);
    return null;
  }
}

/**
 * Detects financial alerts for credit cards (due dates approaching) and budgets (overrun or warning)
 */
export function evaluateFinancialAlerts(
  creditCards: CreditCard[],
  transactions: Transaction[],
  budgets: Budget[],
  categories: Category[],
  selectedMonth: string
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const now = new Date();
  const currentDay = now.getDate(); // e.g. 4
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // 1. Credit Card Due Date Analysis
  creditCards.forEach((card) => {
    // Calculate total pending/open invoice amount for this card
    const cardTransactions = transactions.filter((t) => t.credit_card_id === card.id);
    const invoiceAmount = cardTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    if (invoiceAmount <= 0) return;

    const dueDay = card.due_day;
    const daysUntilDue = dueDay - currentDay;

    // Check conditions:
    // a) Due today (daysUntilDue === 0)
    // b) Due within 1 to 5 days (daysUntilDue > 0 && daysUntilDue <= 5)
    // c) Overdue in current cycle (daysUntilDue < 0 && daysUntilDue >= -5)
    if (daysUntilDue === 0) {
      alerts.push({
        id: `card-due-today-${card.id}-${selectedMonth}`,
        type: 'card_due',
        title: `🚨 Fatura do Cartão ${card.name} VENCE HOJE!`,
        message: `O vencimento é hoje (dia ${dueDay}) no valor de ${formatCurrency(invoiceAmount)}. Evite juros e realize o pagamento.`,
        severity: 'danger',
        timestamp: new Date().toISOString(),
        read: false,
        linkTab: 'cards',
        metadata: {
          cardId: card.id,
          amount: invoiceAmount,
          dueDay,
        },
      });
    } else if (daysUntilDue > 0 && daysUntilDue <= 5) {
      alerts.push({
        id: `card-due-soon-${card.id}-${selectedMonth}`,
        type: 'card_due',
        title: `⚠️ Fatura do ${card.name} Vence em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}`,
        message: `Fatura programada para o dia ${dueDay} no valor de ${formatCurrency(invoiceAmount)}. Lembre-se de provisionar o saldo.`,
        severity: daysUntilDue <= 2 ? 'danger' : 'warning',
        timestamp: new Date().toISOString(),
        read: false,
        linkTab: 'cards',
        metadata: {
          cardId: card.id,
          amount: invoiceAmount,
          dueDay,
        },
      });
    } else if (daysUntilDue < 0 && daysUntilDue >= -4) {
      alerts.push({
        id: `card-overdue-${card.id}-${selectedMonth}`,
        type: 'card_due',
        title: `⚠️ Fatura do ${card.name} Venceu há ${Math.abs(daysUntilDue)} dias!`,
        message: `Vencimento ocorreu dia ${dueDay}. Saldo atual em aberto de ${formatCurrency(invoiceAmount)}.`,
        severity: 'danger',
        timestamp: new Date().toISOString(),
        read: false,
        linkTab: 'cards',
        metadata: {
          cardId: card.id,
          amount: invoiceAmount,
          dueDay,
        },
      });
    }
  });

  // 2. Budget Overrun & Consumption Alert Analysis
  const currentMonthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(selectedMonth)
  );

  budgets.forEach((budget) => {
    if (budget.month_year !== selectedMonth || budget.limit_amount <= 0) return;

    const cat = categoryMap.get(budget.category_id);
    const catName = cat ? cat.name : 'Categoria';

    const spent = currentMonthExpenses
      .filter((t) => t.category_id === budget.category_id)
      .reduce((sum, t) => sum + t.amount, 0);

    const percent = (spent / budget.limit_amount) * 100;

    if (percent >= 100) {
      const overBy = spent - budget.limit_amount;
      alerts.push({
        id: `budget-overrun-${budget.id}-${selectedMonth}`,
        type: 'budget_overrun',
        title: `🚨 Orçamento Estourado: ${catName}`,
        message: `Você atingiu ${percent.toFixed(0)}% do teto (${formatCurrency(spent)} de ${formatCurrency(budget.limit_amount)}). Estouro de ${formatCurrency(overBy)}.`,
        severity: 'danger',
        timestamp: new Date().toISOString(),
        read: false,
        linkTab: 'budgets',
        metadata: {
          categoryId: budget.category_id,
          amount: spent,
          limit: budget.limit_amount,
        },
      });
    } else if (percent >= 80) {
      const remaining = budget.limit_amount - spent;
      alerts.push({
        id: `budget-warning-${budget.id}-${selectedMonth}`,
        type: 'budget_warning',
        title: `⚠️ Alerta de Orçamento: ${catName} (${percent.toFixed(0)}%)`,
        message: `Você consumiu ${formatCurrency(spent)} do limite de ${formatCurrency(budget.limit_amount)}. Restam apenas ${formatCurrency(remaining)}.`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
        read: false,
        linkTab: 'budgets',
        metadata: {
          categoryId: budget.category_id,
          amount: spent,
          limit: budget.limit_amount,
        },
      });
    }
  });

  return alerts;
}
