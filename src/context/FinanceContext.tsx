import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  Account,
  ActiveTab,
  Budget,
  Category,
  CreditCard,
  FinancialAlert,
  Profile,
  SavingsGoal,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import {
  INITIAL_ACCOUNTS,
  INITIAL_BUDGETS,
  INITIAL_CATEGORIES,
  INITIAL_CREDIT_CARDS,
  INITIAL_PROFILE,
  INITIAL_SAVINGS_GOALS,
  INITIAL_TRANSACTIONS,
} from '../data/mockData';
import { getCurrentMonthYear } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import {
  BrowserPermissionStatus,
  evaluateFinancialAlerts,
  getNotificationPermission,
  requestNotificationPermission,
  sendWebNotification,
} from '../utils/notifications';
import {
  BackupRecord,
  BackupScheduleConfig,
  FinanceDataSnapshot,
  loadScheduleConfig,
  saveScheduleConfig,
  isBackupDue,
  createBackupSnapshot,
  saveBackupToIDB,
  getAllBackupsFromIDB,
  deleteBackupFromIDB,
  clearAllBackupsFromIDB,
  enforceRetentionPolicy,
} from '../utils/indexedDBBackup';

interface NewTransactionInput {
  description: string;
  amount: number;
  type: TransactionType;
  category_id: string;
  date: string;
  status: TransactionStatus;
  account_id?: string | null;
  credit_card_id?: string | null;
  destination_account_id?: string | null;
  installments?: number;
  is_recurring?: boolean;
}

interface CardInvoiceSummary {
  card: CreditCard;
  openAmount: number;
  closedAmount: number;
  futureAmount: number;
  totalUsedLimit: number;
  availableLimit: number;
  openTransactions: Transaction[];
  closedTransactions: Transaction[];
}

interface FinanceContextType {
  profile: Profile;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isFocusMode: boolean;
  setIsFocusMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleFocusMode: () => void;
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (open: boolean) => void;
  isSqlModalOpen: boolean;
  setIsSqlModalOpen: (open: boolean) => void;
  isNotificationsModalOpen: boolean;
  setIsNotificationsModalOpen: (open: boolean) => void;
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (open: boolean) => void;

  // Scheduled IndexedDB Backup
  backupScheduleConfig: BackupScheduleConfig;
  updateBackupScheduleConfig: (config: Partial<BackupScheduleConfig>) => void;
  backupsList: BackupRecord[];
  refreshBackupsList: () => Promise<void>;
  createManualBackup: () => Promise<BackupRecord>;
  restoreFromBackupData: (snapshot: FinanceDataSnapshot) => void;
  deleteBackup: (id: string) => Promise<void>;
  clearAllBackups: () => Promise<void>;

  // Notification & Financial Alerts
  financialAlerts: FinancialAlert[];
  unreadAlertsCount: number;
  dismissAlert: (alertId: string) => void;
  markAllAlertsAsRead: () => void;
  notificationPermission: BrowserPermissionStatus;
  requestBrowserNotificationPermission: () => Promise<BrowserPermissionStatus>;
  triggerTestNotification: () => void;
  triggerAlertPushNotifications: () => void;

  // Actions
  addTransaction: (data: NewTransactionInput) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  toggleTransactionStatus: (id: string) => void;

  addAccount: (data: Omit<Account, 'id' | 'user_id'>) => void;
  updateAccount: (id: string, data: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addCreditCard: (data: Omit<CreditCard, 'id' | 'user_id'>) => void;
  updateCreditCard: (id: string, data: Partial<CreditCard>) => void;
  deleteCreditCard: (id: string) => void;

  addSavingsGoal: (data: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at'>) => void;
  updateSavingsGoal: (id: string, data: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  depositToGoal: (goalId: string, amount: number, sourceAccountId?: string) => void;
  withdrawFromGoal: (goalId: string, amount: number) => void;

  setBudgetLimit: (categoryId: string, monthYear: string, limitAmount: number) => void;
  payCreditCardInvoice: (cardId: string, invoiceAmount: number, sourceAccountId: string) => void;
  resetToMockData: () => void;

  // Computed metrics
  totalConsolidatedBalance: number;
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  monthlyNetBalance: number;
  monthlyRealizedIncome: number;
  monthlyRealizedExpense: number;
  getCardInvoiceSummary: (cardId: string) => CardInvoiceSummary;
  categorySpendingMap: Map<string, number>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_PREFIX = 'aura_fin_';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile] = useState<Profile>(INITIAL_PROFILE);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthYear());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Scheduled IndexedDB Backup state
  const [backupScheduleConfig, setBackupScheduleConfig] = useState<BackupScheduleConfig>(() =>
    loadScheduleConfig()
  );
  const [backupsList, setBackupsList] = useState<BackupRecord[]>([]);

  // Web Notification Permission state
  const [notificationPermission, setNotificationPermission] = useState<BrowserPermissionStatus>(() =>
    getNotificationPermission()
  );

  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}dismissed_alerts`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [readAlertIds, setReadAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}read_alerts`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}theme`);
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem(`${STORAGE_PREFIX}theme`, theme);
  }, [theme]);

  const toggleTheme = () => {
    soundFX.playClick();
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Focus Mode (Privacy Blur in Public Places)
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}focus_mode`);
    return saved === 'true';
  });

  const toggleFocusMode = () => {
    soundFX.playClick();
    setIsFocusMode((prev) => {
      const next = !prev;
      localStorage.setItem(`${STORAGE_PREFIX}focus_mode`, String(next));
      if (next) {
        toast.info('Modo Foco ativado: valores monetários ocultos por privacidade.', {
          description: 'Passe o mouse sobre qualquer valor para espiar.',
        });
      } else {
        toast.success('Modo Foco desativado: valores monetários visíveis.');
      }
      return next;
    });
  };

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}accounts`);
    return saved ? JSON.parse(saved) : INITIAL_ACCOUNTS;
  });

  // Credit Cards
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}cards`);
    return saved ? JSON.parse(saved) : INITIAL_CREDIT_CARDS;
  });

  // Categories
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}categories`);
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}transactions`);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Budgets
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}budgets`);
    return saved ? JSON.parse(saved) : INITIAL_BUDGETS;
  });

  // Savings Goals
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}savings_goals`);
    return saved ? JSON.parse(saved) : INITIAL_SAVINGS_GOALS;
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}accounts`, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}cards`, JSON.stringify(creditCards));
  }, [creditCards]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}categories`, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}transactions`, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}budgets`, JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}savings_goals`, JSON.stringify(savingsGoals));
  }, [savingsGoals]);

  // Keyboard shortcut 'N' for quick add transaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        soundFX.playClick();
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Recalculate account balance based on a delta
  const adjustAccountBalance = (accountId: string, delta: number) => {
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === accountId
          ? { ...acc, current_balance: Number((acc.current_balance + delta).toFixed(2)) }
          : acc
      )
    );
  };

  // Add Transaction (supports single or installments)
  const addTransaction = (data: NewTransactionInput) => {
    const installments = data.installments && data.installments > 1 ? data.installments : 1;
    const isInstallment = installments > 1;
    const groupId = isInstallment ? `grp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` : null;
    const installmentAmount = Number((data.amount / installments).toFixed(2));

    const newTransactions: Transaction[] = [];

    // Base date parsing
    const [yearStr, monthStr, dayStr] = data.date.split('-');
    let baseYear = parseInt(yearStr, 10);
    let baseMonth = parseInt(monthStr, 10); // 1-12
    const baseDay = parseInt(dayStr, 10);

    for (let i = 1; i <= installments; i++) {
      let curMonth = baseMonth + (i - 1);
      let curYear = baseYear;
      while (curMonth > 12) {
        curMonth -= 12;
        curYear += 1;
      }
      // Calculate max days in target month
      const maxDaysInMonth = new Date(curYear, curMonth, 0).getDate();
      const targetDay = Math.min(baseDay, maxDaysInMonth);
      const targetDate = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

      // Adjust last installment for rounding cents difference
      const finalAmount =
        i === installments
          ? Number((data.amount - installmentAmount * (installments - 1)).toFixed(2))
          : installmentAmount;

      const desc = isInstallment
        ? `${data.description} (${i}/${installments})`
        : data.description;

      const tx: Transaction = {
        id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        user_id: profile.id,
        description: desc,
        amount: finalAmount,
        type: data.type,
        category_id: data.category_id,
        date: targetDate,
        status: data.status,
        account_id: data.account_id || null,
        credit_card_id: data.credit_card_id || null,
        destination_account_id: data.destination_account_id || null,
        installment_current: isInstallment ? i : null,
        installment_total: isInstallment ? installments : null,
        installment_group_id: groupId,
        is_recurring: data.is_recurring ?? false,
      };

      newTransactions.push(tx);
    }

    // Apply immediate balance change for completed transactions on accounts
    newTransactions.forEach((tx) => {
      if (tx.status === 'completed' && tx.account_id) {
        if (tx.type === 'income') {
          adjustAccountBalance(tx.account_id, tx.amount);
        } else if (tx.type === 'expense') {
          adjustAccountBalance(tx.account_id, -tx.amount);
        } else if (tx.type === 'transfer' && tx.destination_account_id) {
          adjustAccountBalance(tx.account_id, -tx.amount);
          adjustAccountBalance(tx.destination_account_id, tx.amount);
        }
      }
    });

    setTransactions((prev) => [...newTransactions, ...prev]);
    soundFX.playSuccess();
    toast.success(
      isInstallment
        ? `Despesa parcelada em ${installments}x cadastrada com sucesso!`
        : 'Transação adicionada com sucesso!'
    );
  };

  // Update Transaction
  const updateTransaction = (id: string, updated: Partial<Transaction>) => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;

    // Reverse old balance impact
    if (existing.status === 'completed' && existing.account_id) {
      if (existing.type === 'income') adjustAccountBalance(existing.account_id, -existing.amount);
      if (existing.type === 'expense') adjustAccountBalance(existing.account_id, existing.amount);
      if (existing.type === 'transfer' && existing.destination_account_id) {
        adjustAccountBalance(existing.account_id, existing.amount);
        adjustAccountBalance(existing.destination_account_id, -existing.amount);
      }
    }

    const merged: Transaction = { ...existing, ...updated };

    // Apply new balance impact
    if (merged.status === 'completed' && merged.account_id) {
      if (merged.type === 'income') adjustAccountBalance(merged.account_id, merged.amount);
      if (merged.type === 'expense') adjustAccountBalance(merged.account_id, -merged.amount);
      if (merged.type === 'transfer' && merged.destination_account_id) {
        adjustAccountBalance(merged.account_id, -merged.amount);
        adjustAccountBalance(merged.destination_account_id, merged.amount);
      }
    }

    setTransactions((prev) => prev.map((t) => (t.id === id ? merged : t)));
    soundFX.playSuccess();
    toast.success('Transação atualizada com sucesso!');
  };

  // Delete Transaction
  const deleteTransaction = (id: string) => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;

    // Reverse balance impact if was completed
    if (existing.status === 'completed' && existing.account_id) {
      if (existing.type === 'income') adjustAccountBalance(existing.account_id, -existing.amount);
      if (existing.type === 'expense') adjustAccountBalance(existing.account_id, existing.amount);
      if (existing.type === 'transfer' && existing.destination_account_id) {
        adjustAccountBalance(existing.account_id, existing.amount);
        adjustAccountBalance(existing.destination_account_id, -existing.amount);
      }
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    soundFX.playDelete();
    toast.success('Transação excluída');
  };

  // Toggle status between completed and pending
  const toggleTransactionStatus = (id: string) => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;

    const newStatus: TransactionStatus = existing.status === 'completed' ? 'pending' : 'completed';

    if (existing.account_id) {
      const multiplier = newStatus === 'completed' ? 1 : -1;
      if (existing.type === 'income') {
        adjustAccountBalance(existing.account_id, existing.amount * multiplier);
      } else if (existing.type === 'expense') {
        adjustAccountBalance(existing.account_id, -existing.amount * multiplier);
      } else if (existing.type === 'transfer' && existing.destination_account_id) {
        adjustAccountBalance(existing.account_id, -existing.amount * multiplier);
        adjustAccountBalance(existing.destination_account_id, existing.amount * multiplier);
      }
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    soundFX.playClick();
    toast.success(newStatus === 'completed' ? 'Marcada como paga / concluída' : 'Marcada como pendente');
  };

  // Account CRUD
  const addAccount = (data: Omit<Account, 'id' | 'user_id'>) => {
    const newAcc: Account = {
      ...data,
      id: `acc_${Date.now()}`,
      user_id: profile.id,
      current_balance: data.initial_balance,
    };
    setAccounts((prev) => [...prev, newAcc]);
    soundFX.playSuccess();
    toast.success(`Conta "${newAcc.name}" criada com sucesso!`);
  };

  const updateAccount = (id: string, data: Partial<Account>) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    soundFX.playSuccess();
    toast.success('Conta atualizada!');
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    soundFX.playDelete();
    toast.success('Conta removida.');
  };

  // Credit Card CRUD
  const addCreditCard = (data: Omit<CreditCard, 'id' | 'user_id'>) => {
    const newCard: CreditCard = {
      ...data,
      id: `card_${Date.now()}`,
      user_id: profile.id,
    };
    setCreditCards((prev) => [...prev, newCard]);
    soundFX.playSuccess();
    toast.success(`Cartão "${newCard.name}" adicionado!`);
  };

  const updateCreditCard = (id: string, data: Partial<CreditCard>) => {
    setCreditCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    soundFX.playSuccess();
    toast.success('Cartão atualizado!');
  };

  const deleteCreditCard = (id: string) => {
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
    soundFX.playDelete();
    toast.success('Cartão excluído.');
  };

  // Savings Goals CRUD
  const addSavingsGoal = (data: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at'>) => {
    const newGoal: SavingsGoal = {
      ...data,
      id: `goal_${Date.now()}`,
      user_id: profile.id,
      created_at: new Date().toISOString(),
    };
    setSavingsGoals((prev) => [...prev, newGoal]);
    soundFX.playSuccess();
    toast.success(`Meta "${newGoal.title}" criada com sucesso!`);
  };

  const updateSavingsGoal = (id: string, data: Partial<SavingsGoal>) => {
    setSavingsGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
    soundFX.playSuccess();
    toast.success('Meta atualizada!');
  };

  const deleteSavingsGoal = (id: string) => {
    setSavingsGoals((prev) => prev.filter((g) => g.id !== id));
    soundFX.playDelete();
    toast.success('Meta removida.');
  };

  const depositToGoal = (goalId: string, amount: number, sourceAccountId?: string) => {
    const goal = savingsGoals.find((g) => g.id === goalId);
    if (!goal || amount <= 0) return;

    // If source account specified and different from linked account, perform transfer
    if (sourceAccountId && sourceAccountId !== goal.account_id) {
      const sourceAcc = accounts.find((a) => a.id === sourceAccountId);
      if (sourceAcc && sourceAcc.current_balance < amount) {
        toast.error('Saldo insuficiente na conta de origem.');
        return;
      }
      adjustAccountBalance(sourceAccountId, -amount);
      adjustAccountBalance(goal.account_id, amount);

      // Register transfer transaction
      const transferTx: Transaction = {
        id: `tx_goal_${Date.now()}`,
        user_id: profile.id,
        account_id: sourceAccountId,
        destination_account_id: goal.account_id,
        category_id: 'cat_exp_01',
        type: 'transfer',
        amount,
        description: `Aporte Meta: ${goal.title}`,
        date: new Date().toISOString().slice(0, 10),
        status: 'completed',
        is_recurring: false,
      };
      setTransactions((prev) => [transferTx, ...prev]);
    } else if (sourceAccountId && sourceAccountId === goal.account_id) {
      // Just earmark existing money in the same account
    }

    const newAmount = Number((goal.current_amount + amount).toFixed(2));
    const wasCompleted = goal.current_amount >= goal.target_amount;
    const isNowCompleted = newAmount >= goal.target_amount;

    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, current_amount: newAmount } : g))
    );

    if (!wasCompleted && isNowCompleted) {
      soundFX.playCelebration();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6'],
      });
      toast.success(`🎉 Parabéns! Você atingiu 100% da meta "${goal.title}"!`);
    } else {
      soundFX.playSuccess();
      toast.success(`Aporte de R$ ${amount.toFixed(2).replace('.', ',')} adicionado à meta!`);
    }
  };

  const withdrawFromGoal = (goalId: string, amount: number) => {
    const goal = savingsGoals.find((g) => g.id === goalId);
    if (!goal || amount <= 0) return;

    if (amount > goal.current_amount) {
      toast.error('O valor do resgate não pode ser maior que o saldo acumulado da meta.');
      return;
    }

    const newAmount = Number((goal.current_amount - amount).toFixed(2));
    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, current_amount: newAmount } : g))
    );
    soundFX.playClick();
    toast.success(`Resgate de R$ ${amount.toFixed(2).replace('.', ',')} efetuado.`);
  };

  // Budget Set
  const setBudgetLimit = (categoryId: string, monthYear: string, limitAmount: number) => {
    setBudgets((prev) => {
      const existingIdx = prev.findIndex(
        (b) => b.category_id === categoryId && b.month_year === monthYear
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], limit_amount: limitAmount };
        return copy;
      } else {
        const newBudget: Budget = {
          id: `bud_${Date.now()}`,
          user_id: profile.id,
          category_id: categoryId,
          month_year: monthYear,
          limit_amount: limitAmount,
        };
        return [...prev, newBudget];
      }
    });
    soundFX.playSuccess();
    toast.success('Teto orçamentário atualizado!');
  };

  // Pay Credit Card Invoice
  const payCreditCardInvoice = (cardId: string, invoiceAmount: number, sourceAccountId: string) => {
    const card = creditCards.find((c) => c.id === cardId);
    const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
    if (!card || !sourceAccount) {
      toast.error('Erro ao processar pagamento: conta ou cartão não encontrados.');
      return;
    }

    if (sourceAccount.current_balance < invoiceAmount) {
      toast.error('Saldo insuficiente na conta selecionada para liquidar a fatura.');
      return;
    }

    // Deduct balance from source account
    adjustAccountBalance(sourceAccountId, -invoiceAmount);

    // Create record transaction for the invoice payment
    const paymentTx: Transaction = {
      id: `tx_pay_${Date.now()}`,
      user_id: profile.id,
      account_id: sourceAccountId,
      credit_card_id: null,
      category_id: 'cat_exp_06', // Assinaturas/Serviços ou geral
      type: 'expense',
      amount: invoiceAmount,
      description: `Pagamento de Fatura - ${card.name}`,
      date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      is_recurring: false,
    };

    setTransactions((prev) => [paymentTx, ...prev]);

    // Play celebration and confetti
    soundFX.playCelebration();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#6366f1', '#f59e0b', '#8b5cf6'],
    });

    toast.success(`Fatura do ${card.name} paga com sucesso!`);
  };

  // Reset to realistic mock data
  const resetToMockData = () => {
    setAccounts(INITIAL_ACCOUNTS);
    setCreditCards(INITIAL_CREDIT_CARDS);
    setCategories(INITIAL_CATEGORIES);
    setTransactions(INITIAL_TRANSACTIONS);
    setBudgets(INITIAL_BUDGETS);
    setSavingsGoals(INITIAL_SAVINGS_GOALS);
    soundFX.playSuccess();
    toast.success('Dados restaurados com base de demonstração.');
  };

  // Scheduled IndexedDB Backup Engine Operations
  const refreshBackupsList = async () => {
    try {
      const list = await getAllBackupsFromIDB();
      setBackupsList(list);
    } catch (e) {
      console.error('Erro ao listar backups do IndexedDB:', e);
    }
  };

  const updateBackupScheduleConfig = (config: Partial<BackupScheduleConfig>) => {
    setBackupScheduleConfig((prev) => {
      const updated = { ...prev, ...config };
      saveScheduleConfig(updated);
      return updated;
    });
  };

  const createManualBackup = async (): Promise<BackupRecord> => {
    const record = createBackupSnapshot(
      {
        profile,
        accounts,
        creditCards,
        categories,
        transactions,
        budgets,
        savingsGoals,
      },
      'manual',
      'manual'
    );

    await saveBackupToIDB(record);
    await enforceRetentionPolicy(backupScheduleConfig.maxRetentionBackups);
    updateBackupScheduleConfig({
      lastBackupTimestamp: record.timestamp,
      lastBackupStatus: 'success',
    });
    await refreshBackupsList();
    soundFX.playSuccess();
    return record;
  };

  const restoreFromBackupData = (snapshot: FinanceDataSnapshot) => {
    if (!snapshot) return;
    if (snapshot.accounts && Array.isArray(snapshot.accounts)) setAccounts(snapshot.accounts);
    if (snapshot.creditCards && Array.isArray(snapshot.creditCards)) setCreditCards(snapshot.creditCards);
    if (snapshot.categories && Array.isArray(snapshot.categories)) setCategories(snapshot.categories);
    if (snapshot.transactions && Array.isArray(snapshot.transactions)) setTransactions(snapshot.transactions);
    if (snapshot.budgets && Array.isArray(snapshot.budgets)) setBudgets(snapshot.budgets);
    if (snapshot.savingsGoals && Array.isArray(snapshot.savingsGoals)) setSavingsGoals(snapshot.savingsGoals);

    soundFX.playCelebration();
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
    });
    toast.success('Snapshot restaurado com sucesso do IndexedDB!');
  };

  const deleteBackup = async (id: string) => {
    await deleteBackupFromIDB(id);
    await refreshBackupsList();
  };

  const clearAllBackups = async () => {
    await clearAllBackupsFromIDB();
    setBackupsList([]);
  };

  // Background Runner for Scheduled Backup
  useEffect(() => {
    let isMounted = true;

    const runScheduledCheck = async () => {
      if (!backupScheduleConfig.enabled) return;
      if (!isBackupDue(backupScheduleConfig)) return;

      try {
        const record = createBackupSnapshot(
          {
            profile,
            accounts,
            creditCards,
            categories,
            transactions,
            budgets,
            savingsGoals,
          },
          'scheduled',
          backupScheduleConfig.frequency
        );

        await saveBackupToIDB(record);
        await enforceRetentionPolicy(backupScheduleConfig.maxRetentionBackups);
        updateBackupScheduleConfig({
          lastBackupTimestamp: record.timestamp,
          lastBackupStatus: 'success',
        });

        if (isMounted) {
          await refreshBackupsList();
          if (backupScheduleConfig.notifyOnBackup) {
            toast.info('Backup agendado salvo no IndexedDB', {
              description: `Cópia segura de ${record.sizeFormatted} preservada no navegador.`,
            });
          }
        }
      } catch (err) {
        console.error('Erro na rotina de backup agendado:', err);
      }
    };

    // Initial check on mount
    runScheduledCheck();

    // Recurring check every 15 minutes
    const interval = setInterval(runScheduledCheck, 15 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [
    backupScheduleConfig,
    accounts,
    creditCards,
    categories,
    transactions,
    budgets,
    savingsGoals,
    profile,
  ]);

  // Computed: Consolidated Total Balance (sum of active accounts)
  const totalConsolidatedBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.current_balance, 0);
  }, [accounts]);

  // Transactions for selected month
  const selectedMonthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Monthly Income (completed + pending)
  const monthlyIncomeTotal = useMemo(() => {
    return selectedMonthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions]);

  // Monthly Realized Income (only completed)
  const monthlyRealizedIncome = useMemo(() => {
    return selectedMonthTransactions
      .filter((t) => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions]);

  // Monthly Expenses (completed + pending)
  const monthlyExpenseTotal = useMemo(() => {
    return selectedMonthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions]);

  // Monthly Realized Expense (only completed)
  const monthlyRealizedExpense = useMemo(() => {
    return selectedMonthTransactions
      .filter((t) => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions]);

  // Monthly Net Balance (Income - Expense)
  const monthlyNetBalance = useMemo(() => {
    return monthlyIncomeTotal - monthlyExpenseTotal;
  }, [monthlyIncomeTotal, monthlyExpenseTotal]);

  // Category spending for selected month
  const categorySpendingMap = useMemo(() => {
    const map = new Map<string, number>();
    selectedMonthTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cur = map.get(t.category_id) || 0;
        map.set(t.category_id, cur + t.amount);
      });
    return map;
  }, [selectedMonthTransactions]);

  // Credit Card invoice calculator
  const getCardInvoiceSummary = (cardId: string): CardInvoiceSummary => {
    const card = creditCards.find((c) => c.id === cardId) || {
      id: cardId,
      user_id: profile.id,
      name: 'Cartão',
      limit_amount: 10000,
      closing_day: 20,
      due_day: 28,
      color: '#6366f1',
    };

    const cardTxs = transactions.filter(
      (t) => t.credit_card_id === cardId && t.type === 'expense'
    );

    // Current date reference
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const curDay = now.getDate();

    let openAmount = 0;
    let closedAmount = 0;
    let futureAmount = 0;

    const openTransactions: Transaction[] = [];
    const closedTransactions: Transaction[] = [];

    cardTxs.forEach((tx) => {
      const [yStr, mStr, dStr] = tx.date.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);

      // Determine invoice cycle
      if (y < curYear || (y === curYear && m < curMonth)) {
        // Previous month transaction: If within last cycle, it's closed invoice
        closedAmount += tx.amount;
        closedTransactions.push(tx);
      } else if (y === curYear && m === curMonth) {
        if (d <= card.closing_day) {
          // Open invoice for current period
          openAmount += tx.amount;
          openTransactions.push(tx);
        } else {
          // Purchased after closing day -> will fall into future invoice
          futureAmount += tx.amount;
        }
      } else {
        // Future months (installments ahead)
        futureAmount += tx.amount;
      }
    });

    const totalUsedLimit = openAmount + closedAmount + futureAmount;
    const availableLimit = Math.max(0, card.limit_amount - totalUsedLimit);

    return {
      card,
      openAmount,
      closedAmount,
      futureAmount,
      totalUsedLimit,
      availableLimit,
      openTransactions,
      closedTransactions,
    };
  };

  // Dynamic financial alerts (credit card due dates & budget overruns)
  const financialAlerts = useMemo(() => {
    const rawAlerts = evaluateFinancialAlerts(
      creditCards,
      transactions,
      budgets,
      categories,
      selectedMonth
    );

    return rawAlerts
      .filter((alert) => !dismissedAlertIds.includes(alert.id))
      .map((alert) => ({
        ...alert,
        read: readAlertIds.includes(alert.id),
      }));
  }, [creditCards, transactions, budgets, categories, selectedMonth, dismissedAlertIds, readAlertIds]);

  const unreadAlertsCount = useMemo(() => {
    return financialAlerts.filter((a) => !a.read).length;
  }, [financialAlerts]);

  const dismissAlert = (alertId: string) => {
    soundFX.playClick();
    setDismissedAlertIds((prev) => {
      const next = [...prev, alertId];
      localStorage.setItem(`${STORAGE_PREFIX}dismissed_alerts`, JSON.stringify(next));
      return next;
    });
    toast.info('Alerta dispensado.');
  };

  const markAllAlertsAsRead = () => {
    soundFX.playClick();
    const allIds = financialAlerts.map((a) => a.id);
    setReadAlertIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem(`${STORAGE_PREFIX}read_alerts`, JSON.stringify(next));
      return next;
    });
    toast.success('Todos os alertas foram marcados como lidos.');
  };

  const requestBrowserNotificationPermission = async () => {
    soundFX.playClick();
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);

    if (perm === 'granted') {
      toast.success('Notificações Web ativadas no navegador!');
      sendWebNotification('🎉 Aura Finance · Notificações Ativadas!', {
        body: 'Você receberá avisos push no navegador sobre faturas próximas ao vencimento e estouros de orçamentos.',
      });
    } else if (perm === 'denied') {
      toast.error('Notificações bloqueadas pelo navegador. Habilite nas permissões do site.');
    } else {
      toast.info('Permissão de notificações não concedida.');
    }

    return perm;
  };

  const triggerTestNotification = () => {
    soundFX.playClick();
    if (notificationPermission !== 'granted') {
      toast.warning('Notificações no navegador não estão ativas. Clique em "Permitir Notificações".');
      return;
    }

    const n = sendWebNotification('🔔 Aura Finance · Notificação de Teste', {
      body: 'O sistema de notificações Web Push está funcionando perfeitamente!',
    });

    if (n) {
      soundFX.playSuccess();
      toast.success('Notificação push de teste enviada!');
    } else {
      toast.error('Não foi possível disparar a notificação no navegador.');
    }
  };

  const triggerAlertPushNotifications = () => {
    soundFX.playClick();
    if (financialAlerts.length === 0) {
      toast.success('Tudo sob controle! Nenhuma fatura a vencer ou orçamento estourado.');
      return;
    }

    if (notificationPermission === 'granted') {
      const topAlert = financialAlerts[0];
      sendWebNotification(topAlert.title, {
        body: topAlert.message,
        onClick: () => {
          if (topAlert.linkTab) setActiveTab(topAlert.linkTab);
        },
      });
      soundFX.playSuccess();
      toast.success(`Notificação push enviada: ${topAlert.title}`);
    } else {
      toast.warning(`Você tem ${financialAlerts.length} alertas financeiros! Ative as Notificações Web para receber push.`);
      setIsNotificationsModalOpen(true);
    }
  };

  // Push critical notification once per session if browser permission is already granted
  useEffect(() => {
    if (notificationPermission === 'granted' && financialAlerts.length > 0) {
      const sessionKey = `aura_pushed_${new Date().toISOString().slice(0, 10)}`;
      const alreadyPushed = sessionStorage.getItem(sessionKey);
      if (!alreadyPushed) {
        const criticalAlert = financialAlerts.find((a) => a.severity === 'danger') || financialAlerts[0];
        if (criticalAlert) {
          sendWebNotification(criticalAlert.title, {
            body: criticalAlert.message,
            onClick: () => {
              if (criticalAlert.linkTab) setActiveTab(criticalAlert.linkTab);
            },
          });
          sessionStorage.setItem(sessionKey, 'true');
        }
      }
    }
  }, [notificationPermission, financialAlerts, setActiveTab]);

  return (
    <FinanceContext.Provider
      value={{
        profile,
        accounts,
        creditCards,
        categories,
        transactions,
        budgets,
        savingsGoals,
        selectedMonth,
        setSelectedMonth,
        activeTab,
        setActiveTab,
        theme,
        toggleTheme,
        isFocusMode,
        setIsFocusMode,
        toggleFocusMode,
        isQuickAddOpen,
        setIsQuickAddOpen,
        isSqlModalOpen,
        setIsSqlModalOpen,
        isNotificationsModalOpen,
        setIsNotificationsModalOpen,
        isBackupModalOpen,
        setIsBackupModalOpen,

        backupScheduleConfig,
        updateBackupScheduleConfig,
        backupsList,
        refreshBackupsList,
        createManualBackup,
        restoreFromBackupData,
        deleteBackup,
        clearAllBackups,

        financialAlerts,
        unreadAlertsCount,
        dismissAlert,
        markAllAlertsAsRead,
        notificationPermission,
        requestBrowserNotificationPermission,
        triggerTestNotification,
        triggerAlertPushNotifications,

        addTransaction,
        updateTransaction,
        deleteTransaction,
        toggleTransactionStatus,

        addAccount,
        updateAccount,
        deleteAccount,

        addCreditCard,
        updateCreditCard,
        deleteCreditCard,

        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        depositToGoal,
        withdrawFromGoal,

        setBudgetLimit,
        payCreditCardInvoice,
        resetToMockData,

        totalConsolidatedBalance,
        monthlyIncomeTotal,
        monthlyExpenseTotal,
        monthlyNetBalance,
        monthlyRealizedIncome,
        monthlyRealizedExpense,
        getCardInvoiceSummary,
        categorySpendingMap,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
