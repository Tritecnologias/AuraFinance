import { Transaction, Account, Category, CreditCard } from '../types/finance';

/**
 * Formats a number to Brazilian Real currency (R$ 1.250,50)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats date string (YYYY-MM-DD) into readable Brazilian format (DD/MM/YYYY)
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}

/**
 * Formats date string into short day + month ("04 Out")
 */
export function formatShortDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Formats month-year string (YYYY-MM) into month name ("Outubro de 2026")
 */
export function formatMonthYear(monthYear: string): string {
  if (!monthYear) return '';
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
}

/**
 * Get current month-year string (YYYY-MM)
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Export transactions to CSV file with UTF-8 BOM
 */
export function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  creditCards: CreditCard[]
) {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(creditCards.map((c) => [c.id, c.name]));

  const headers = [
    'Data',
    'Descrição',
    'Tipo',
    'Categoria',
    'Valor (R$)',
    'Status',
    'Conta / Cartão',
    'Parcela',
    'Recorrente',
  ];

  const rows = transactions.map((t) => {
    let source = '-';
    if (t.credit_card_id) {
      source = `Cartão: ${cardMap.get(t.credit_card_id) || 'Cartão'}`;
    } else if (t.account_id) {
      source = `Conta: ${accountMap.get(t.account_id) || 'Conta'}`;
    }

    const typeLabel =
      t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : 'Transferência';
    const statusLabel = t.status === 'completed' ? 'Concluído' : 'Pendente';
    const installment =
      t.installment_current && t.installment_total
        ? `${t.installment_current}/${t.installment_total}`
        : 'À vista';

    return [
      `"${formatDate(t.date)}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${typeLabel}"`,
      `"${(categoryMap.get(t.category_id) || 'Geral').replace(/"/g, '""')}"`,
      `"${t.amount.toFixed(2).replace('.', ',')}"`,
      `"${statusLabel}"`,
      `"${source.replace(/"/g, '""')}"`,
      `"${installment}"`,
      `"${t.is_recurring ? 'Sim' : 'Não'}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `transacoes_aura_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
