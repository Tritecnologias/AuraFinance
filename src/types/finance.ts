export type AccountType = 'checking' | 'investment' | 'cash' | 'savings';

export type CategoryType = 'income' | 'expense';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'completed' | 'pending';

export interface Profile {
  id: string;
  full_name: string;
  currency: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  color: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
  status: TransactionStatus;
  destination_account_id?: string | null;
  installment_current?: number | null;
  installment_total?: number | null;
  installment_group_id?: string | null;
  is_recurring: boolean;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month_year: string; // YYYY-MM
  limit_amount: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string; // YYYY-MM-DD
  account_id: string; // Conta bancária ou de investimento vinculada
  color: string;
  created_at: string;
}

export type ActiveTab = 'dashboard' | 'transactions' | 'calendar' | 'cards' | 'budgets' | 'goals' | 'accounts';

export type NotificationType = 'card_due' | 'budget_overrun' | 'budget_warning' | 'system';

export interface FinancialAlert {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  timestamp: string;
  read: boolean;
  linkTab?: ActiveTab;
  metadata?: {
    cardId?: string;
    categoryId?: string;
    amount?: number;
    limit?: number;
    dueDay?: number;
  };
}

export interface TransactionFilters {
  search: string;
  period: 'current' | 'previous' | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
  accountId: string; // 'all' or specific
  creditCardId: string; // 'all' or specific
  type: 'all' | TransactionType;
  status: 'all' | TransactionStatus;
  categoryId: string; // 'all' or specific
}
