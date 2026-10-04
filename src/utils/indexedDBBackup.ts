import { Account, Budget, Category, CreditCard, Profile, SavingsGoal, Transaction } from '../types/finance';
import { formatDate } from './formatters';

export type BackupFrequency = 'daily' | 'every_3_days' | 'weekly' | 'every_session';
export type BackupFormat = 'json' | 'csv' | 'both';

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  format: BackupFormat;
  maxRetentionBackups: number; // e.g. 20
  lastBackupTimestamp?: number;
  lastBackupStatus?: 'success' | 'failed';
  notifyOnBackup: boolean;
  autoDownloadFile: boolean;
}

export interface FinanceDataSnapshot {
  version: string;
  app: string;
  exportedAt: string;
  profile: Profile;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
}

export interface BackupRecord {
  id: string; // e.g. backup_1728059000000_scheduled
  timestamp: number;
  createdAt: string; // ISO string
  type: 'scheduled' | 'manual';
  frequency: BackupFrequency | 'manual';
  itemCounts: {
    transactions: number;
    accounts: number;
    creditCards: number;
    budgets: number;
    savingsGoals: number;
    categories: number;
  };
  sizeBytes: number;
  sizeFormatted: string;
  jsonData: FinanceDataSnapshot;
  csvData: {
    transactionsCsv: string;
    accountsCsv: string;
    cardsCsv: string;
  };
}

const DB_NAME = 'AuraFinance_Backup_DB';
const DB_VERSION = 1;
const STORE_NAME = 'backups';
const SCHEDULE_CONFIG_KEY = 'aura_fin_backup_schedule_config';

export const DEFAULT_SCHEDULE_CONFIG: BackupScheduleConfig = {
  enabled: true,
  frequency: 'daily',
  format: 'both',
  maxRetentionBackups: 20,
  notifyOnBackup: true,
  autoDownloadFile: false,
};

/**
 * Initialize and open the IndexedDB database
 */
export function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não é suportado neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao abrir IndexedDB.'));
    };
  });
}

/**
 * Save a backup record to IndexedDB
 */
export async function saveBackupToIDB(record: BackupRecord): Promise<void> {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao salvar backup no IndexedDB.'));
    };
  });
}

/**
 * Retrieve all backup records from IndexedDB sorted by newest first
 */
export async function getAllBackupsFromIDB(): Promise<BackupRecord[]> {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => {
      const results = (request.result as BackupRecord[]) || [];
      // Sort newest first
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao buscar backups do IndexedDB.'));
    };
  });
}

/**
 * Delete a specific backup from IndexedDB
 */
export async function deleteBackupFromIDB(id: string): Promise<void> {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao excluir backup do IndexedDB.'));
    };
  });
}

/**
 * Clear all backups from IndexedDB
 */
export async function clearAllBackupsFromIDB(): Promise<void> {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Falha ao limpar backups do IndexedDB.'));
    };
  });
}

/**
 * Enforce retention policy: delete backups beyond maxRetention
 */
export async function enforceRetentionPolicy(maxCount: number): Promise<number> {
  if (maxCount <= 0) return 0;
  const backups = await getAllBackupsFromIDB();
  if (backups.length <= maxCount) return 0;

  const toDelete = backups.slice(maxCount);
  let deletedCount = 0;
  for (const b of toDelete) {
    try {
      await deleteBackupFromIDB(b.id);
      deletedCount++;
    } catch (e) {
      console.error('Erro ao purgar backup antigo:', e);
    }
  }
  return deletedCount;
}

/**
 * Get storage quota info from navigator.storage if available
 */
export async function getStorageEstimate(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  usageFormatted: string;
  quotaFormatted: string;
  percentage: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usageBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 1024 * 1024 * 1024;
      const percentage = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
      return {
        usageBytes,
        quotaBytes,
        usageFormatted: formatBytes(usageBytes),
        quotaFormatted: formatBytes(quotaBytes),
        percentage: Math.min(100, Number(percentage.toFixed(1))),
      };
    } catch {
      // Fallback
    }
  }
  return {
    usageBytes: 0,
    quotaBytes: 1024 * 1024 * 1024,
    usageFormatted: 'N/D',
    quotaFormatted: 'N/D',
    percentage: 0,
  };
}

/**
 * Format bytes to readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Export transactions to CSV format string
 */
export function generateTransactionsCSV(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  creditCards: CreditCard[]
): string {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const cardMap = new Map(creditCards.map((c) => [c.id, c.name]));

  const headers = [
    'ID',
    'Data',
    'Descricao',
    'Tipo',
    'Categoria',
    'Valor_BRL',
    'Status',
    'Fonte_Financeira',
    'Parcela',
    'Recorrente',
  ];

  const rows = transactions.map((t) => {
    let source = '-';
    if (t.credit_card_id) {
      source = `Cartao: ${cardMap.get(t.credit_card_id) || 'Cartao'}`;
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
      `"${t.id}"`,
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

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Export accounts to CSV format string
 */
export function generateAccountsCSV(accounts: Account[]): string {
  const headers = ['ID', 'Nome', 'Tipo', 'Saldo_Inicial_BRL', 'Saldo_Atual_BRL', 'Cor_Hex'];
  const typeMap: Record<string, string> = {
    checking: 'Conta Corrente',
    investment: 'Investimentos',
    savings: 'Poupança',
    cash: 'Dinheiro',
  };

  const rows = accounts.map((acc) => [
    `"${acc.id}"`,
    `"${acc.name.replace(/"/g, '""')}"`,
    `"${typeMap[acc.type] || acc.type}"`,
    `"${acc.initial_balance.toFixed(2).replace('.', ',')}"`,
    `"${acc.current_balance.toFixed(2).replace('.', ',')}"`,
    `"${acc.color}"`,
  ].join(';'));

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Export credit cards to CSV format string
 */
export function generateCreditCardsCSV(cards: CreditCard[]): string {
  const headers = [
    'ID',
    'Nome_Cartao',
    'Limite_Total_BRL',
    'Dia_Fechamento',
    'Dia_Vencimento',
    'Cor_Hex',
  ];

  const rows = cards.map((c) => [
    `"${c.id}"`,
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.limit_amount.toFixed(2).replace('.', ',')}"`,
    `"${c.closing_day}"`,
    `"${c.due_day}"`,
    `"${c.color}"`,
  ].join(';'));

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Construct a complete BackupRecord from current finance state
 */
export function createBackupSnapshot(
  data: {
    profile: Profile;
    accounts: Account[];
    creditCards: CreditCard[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    savingsGoals: SavingsGoal[];
  },
  type: 'scheduled' | 'manual',
  frequency: BackupFrequency | 'manual'
): BackupRecord {
  const now = Date.now();
  const dateIso = new Date(now).toISOString();

  const snapshot: FinanceDataSnapshot = {
    version: '2.0',
    app: 'Aura Finance',
    exportedAt: dateIso,
    profile: data.profile,
    accounts: data.accounts,
    creditCards: data.creditCards,
    categories: data.categories,
    transactions: data.transactions,
    budgets: data.budgets,
    savingsGoals: data.savingsGoals,
  };

  const transactionsCsv = generateTransactionsCSV(
    data.transactions,
    data.categories,
    data.accounts,
    data.creditCards
  );
  const accountsCsv = generateAccountsCSV(data.accounts);
  const cardsCsv = generateCreditCardsCSV(data.creditCards);

  const jsonString = JSON.stringify(snapshot);
  const approxSize =
    new Blob([jsonString, transactionsCsv, accountsCsv, cardsCsv]).size;

  return {
    id: `backup_${now}_${type}`,
    timestamp: now,
    createdAt: dateIso,
    type,
    frequency,
    itemCounts: {
      transactions: data.transactions.length,
      accounts: data.accounts.length,
      creditCards: data.creditCards.length,
      budgets: data.budgets.length,
      savingsGoals: data.savingsGoals.length,
      categories: data.categories.length,
    },
    sizeBytes: approxSize,
    sizeFormatted: formatBytes(approxSize),
    jsonData: snapshot,
    csvData: {
      transactionsCsv,
      accountsCsv,
      cardsCsv,
    },
  };
}

/**
 * Trigger file download directly in browser
 */
export function downloadFile(content: Blob | string, filename: string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Load backup schedule configuration from localStorage
 */
export function loadScheduleConfig(): BackupScheduleConfig {
  try {
    const saved = localStorage.getItem(SCHEDULE_CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_SCHEDULE_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SCHEDULE_CONFIG;
}

/**
 * Save backup schedule configuration to localStorage
 */
export function saveScheduleConfig(config: BackupScheduleConfig): void {
  try {
    localStorage.setItem(SCHEDULE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Erro ao salvar configuração de backup agendado:', e);
  }
}

/**
 * Determine if a scheduled backup is due based on configured frequency
 */
export function isBackupDue(config: BackupScheduleConfig): boolean {
  if (!config.enabled) return false;
  if (!config.lastBackupTimestamp) return true;

  const now = Date.now();
  const elapsedMs = now - config.lastBackupTimestamp;

  switch (config.frequency) {
    case 'every_session':
      // Backs up if at least 1 hour has elapsed since last backup
      return elapsedMs > 60 * 60 * 1000;
    case 'daily':
      // 24 hours
      return elapsedMs >= 24 * 60 * 60 * 1000;
    case 'every_3_days':
      // 72 hours
      return elapsedMs >= 3 * 24 * 60 * 60 * 1000;
    case 'weekly':
      // 7 days
      return elapsedMs >= 7 * 24 * 60 * 60 * 1000;
    default:
      return elapsedMs >= 24 * 60 * 60 * 1000;
  }
}

/**
 * Get human-readable description for frequency
 */
export function getFrequencyLabel(frequency: BackupFrequency | 'manual'): string {
  switch (frequency) {
    case 'daily':
      return 'Diário (a cada 24h)';
    case 'every_3_days':
      return 'A cada 3 dias';
    case 'weekly':
      return 'Semanal (a cada 7 dias)';
    case 'every_session':
      return 'A cada nova sessão';
    case 'manual':
      return 'Manual';
    default:
      return frequency;
  }
}
