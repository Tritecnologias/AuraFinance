import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  CreditCard as CardIcon,
  Wallet,
  X,
  FileDown,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatDate,
  formatMonthYear,
} from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { generateAnnualFinancialReportPDF } from '../utils/pdfGenerator';
import { requestCategorySuggestion } from '../utils/aiCategorizer';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';

type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'desc_asc';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    accounts,
    creditCards,
    categories,
    selectedMonth,
    toggleTransactionStatus,
    deleteTransaction,
    updateTransaction,
    setIsQuickAddOpen,
    profile,
    savingsGoals,
  } = useFinance();

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'selected_month' | 'all' | 'custom'>('selected_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountOrCardFilter, setAccountOrCardFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

  // Edit Modal State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editStatus, setEditStatus] = useState<TransactionStatus>('completed');
  const [isSuggestingEditCategory, setIsSuggestingEditCategory] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Smart Category Suggestion for Edit Modal
  const handleSuggestCategoryForEdit = async () => {
    if (!editDesc.trim()) {
      toast.error('Preencha a descrição primeiro para a IA sugerir a categoria.');
      return;
    }
    try {
      setIsSuggestingEditCategory(true);
      const res = await requestCategorySuggestion(editDesc.trim(), categories, editingTx?.type);
      const matched = categories.find((c) => c.id === res.category_id);
      if (matched) {
        setEditCategoryId(matched.id);
        soundFX.playSuccess();
        toast.success(`Categoria sugerida: ${res.category_name}`, {
          description: `${res.confidence_percent}% de certeza · ${res.reasoning}`,
        });
      }
    } catch {
      toast.error('Não foi possível obter sugestão para esta descrição.');
    } finally {
      setIsSuggestingEditCategory(false);
    }
  };

  // Open Edit Modal
  const handleStartEdit = (tx: Transaction) => {
    soundFX.playClick();
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditAmount(tx.amount.toString());
    setEditDate(tx.date);
    setEditCategoryId(tx.category_id);
    setEditStatus(tx.status);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const val = parseFloat(editAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      soundFX.playError();
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!editDesc.trim()) {
      soundFX.playError();
      toast.error('Informe uma descrição para a transação.');
      return;
    }

    updateTransaction(editingTx.id, {
      description: editDesc.trim(),
      amount: val,
      date: editDate,
      category_id: editCategoryId,
      status: editStatus,
    });

    setEditingTx(null);
  };

  // Helper Maps
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const cardMap = useMemo(() => new Map(creditCards.map((c) => [c.id, c])), [creditCards]);

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Search text
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(query);
        const catMatch = categoryMap.get(tx.category_id)?.name.toLowerCase().includes(query);
        if (!descMatch && !catMatch) return false;
      }

      // 2. Period Filter
      if (periodFilter === 'selected_month') {
        if (!tx.date.startsWith(selectedMonth)) return false;
      } else if (periodFilter === 'custom') {
        if (customStartDate && tx.date < customStartDate) return false;
        if (customEndDate && tx.date > customEndDate) return false;
      }

      // 3. Type Filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // 4. Status Filter
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;

      // 5. Category Filter
      if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false;

      // 6. Account or Card Filter
      if (accountOrCardFilter !== 'all') {
        if (accountOrCardFilter.startsWith('acc_')) {
          if (tx.account_id !== accountOrCardFilter && tx.destination_account_id !== accountOrCardFilter) {
            return false;
          }
        } else if (accountOrCardFilter.startsWith('card_')) {
          if (tx.credit_card_id !== accountOrCardFilter) return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    searchTerm,
    periodFilter,
    selectedMonth,
    customStartDate,
    customEndDate,
    typeFilter,
    statusFilter,
    categoryFilter,
    accountOrCardFilter,
    categoryMap,
  ]);

  // Sorting Logic
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      switch (sortOption) {
        case 'date_desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date_asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'desc_asc':
          return a.description.localeCompare(b.description);
        default:
          return 0;
      }
    });
  }, [filteredTransactions, sortOption]);

  // Filtered Summary Totals
  const { totalIncomes, totalExpenses } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === 'income') inc += t.amount;
      if (t.type === 'expense') exp += t.amount;
    });
    return { totalIncomes: inc, totalExpenses: exp };
  }, [filteredTransactions]);

  const handleExportCSV = () => {
    soundFX.playClick();
    exportTransactionsToCSV(sortedTransactions, categories, accounts, creditCards);
  };

  const handleExportAnnualPDF = async () => {
    soundFX.playClick();
    setIsExportingPdf(true);
    const year = parseInt(selectedMonth.split('-')[0] || '2026', 10);
    const toastId = toast.loading(`Gerando Relatório Financeiro Anual (${year})...`);

    try {
      await generateAnnualFinancialReportPDF({
        year,
        profile,
        accounts,
        creditCards,
        categories,
        transactions,
        savingsGoals,
      });
      soundFX.playSuccess();
      toast.success(`Relatório anual consolidado de ${year} gerado com sucesso!`, { id: toastId });
    } catch (err) {
      console.error(err);
      soundFX.playError();
      toast.error('Ocorreu um erro ao gerar o relatório em PDF.', { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Gestão de Transações
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Filtre, pesquise, concilie e exporte todo o seu histórico financeiro.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAnnualPDF}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-60"
            title="Exportar Relatório Anual Consolidado em PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-indigo-500" />
            )}
            <span className="hidden sm:inline">Relatório PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Exportar dados filtrados para arquivo CSV (Excel)"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Nova Transação</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 space-y-3">
        {/* Row 1: Search bar and primary selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative flex items-center lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Period Filter */}
          <div>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="selected_month">Mês Vigente ({formatMonthYear(selectedMonth)})</option>
              <option value="all">Todo o Histórico</option>
              <option value="custom">Período Customizado</option>
            </select>
          </div>

          {/* Account or Card Filter */}
          <div>
            <select
              value={accountOrCardFilter}
              onChange={(e) => setAccountOrCardFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="all">Todas as Contas & Cartões</option>
              <optgroup label="Contas Bancárias">
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    Conta: {acc.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões de Crédito">
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    Cartão: {card.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === 'income' ? '▲ ' : '▼ '} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Secondary Filters & Custom Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          {/* Segmented Type and Status buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type buttons */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    soundFX.playClick();
                    setTypeFilter(t);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t === 'all'
                    ? 'Todos'
                    : t === 'expense'
                    ? 'Despesas'
                    : t === 'income'
                    ? 'Receitas'
                    : 'Transf.'}
                </button>
              ))}
            </div>

            {/* Status buttons */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {(['all', 'completed', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    soundFX.playClick();
                    setStatusFilter(s);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    statusFilter === s
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'Status: Todos' : s === 'completed' ? 'Efetivados' : 'Pendentes'}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <ArrowUpDown className="h-3 w-3" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="date_desc">Mais Recentes</option>
              <option value="date_asc">Mais Antigas</option>
              <option value="amount_desc">Maior Valor</option>
              <option value="amount_asc">Menor Valor</option>
              <option value="desc_asc">Descrição (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Custom date range inputs when selected */}
        {periodFilter === 'custom' && (
          <div className="flex items-center gap-3 pt-2 text-xs">
            <span className="text-slate-500 font-medium">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
            <span className="text-slate-500 font-medium">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Summary KPI Strip of filtered results */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Mostrando <span className="font-semibold text-slate-900 dark:text-white">{sortedTransactions.length}</span>{' '}
          {sortedTransactions.length === 1 ? 'registro' : 'registros'}
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>
            Receitas:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{formatCurrency(totalIncomes)}
            </strong>
          </span>
          <span>
            Despesas:{' '}
            <strong className="text-rose-600 dark:text-rose-400 tabular-nums">
              -{formatCurrency(totalExpenses)}
            </strong>
          </span>
          <span>
            Líquido:{' '}
            <strong
              className={`tabular-nums ${
                totalIncomes - totalExpenses >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(totalIncomes - totalExpenses)}
            </strong>
          </span>
        </div>
      </div>

      {/* Transactions Table & Mobile Card List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 overflow-hidden">
        {/* Mobile View: Card List (md:hidden) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          {sortedTransactions.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-400 text-xs">
              Nenhuma transação encontrada com os filtros selecionados.
            </div>
          ) : (
            sortedTransactions.map((tx) => {
              const cat = categoryMap.get(tx.category_id);
              const acc = tx.account_id ? accountMap.get(tx.account_id) : null;
              const destAcc = tx.destination_account_id ? accountMap.get(tx.destination_account_id) : null;
              const card = tx.credit_card_id ? cardMap.get(tx.credit_card_id) : null;
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';
              const isCompleted = tx.status === 'completed';

              return (
                <div
                  key={tx.id}
                  className="p-3.5 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : isTransfer
                            ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                            : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : isTransfer ? (
                          <ArrowLeftRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat?.color || '#94a3b8' }}
                          />
                          <span className="truncate">{cat?.name || 'Geral'}</span>
                          <span>·</span>
                          <span className="font-mono">{formatDate(tx.date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-mono font-bold tabular-nums ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isTransfer
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(tx.amount)}
                      </div>
                      <button
                        onClick={() => toggleTransactionStatus(tx.id)}
                        className={`mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                        }`}
                        title="Clique para alternar status"
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Efetivado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-2.5 w-2.5" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100/60 dark:border-slate-800/40">
                    <span className="truncate">
                      {card ? `Cartão ${card.name}` : isTransfer ? `${acc?.name} → ${destAcc?.name}` : acc ? acc.name : '-'}
                      {tx.installment_current && tx.installment_total && ` (${tx.installment_current}/${tx.installment_total}x)`}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(tx)}
                        className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setTxToDelete(tx)}
                        className="rounded p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Conta / Cartão</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Nenhuma transação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((tx) => {
                  const cat = categoryMap.get(tx.category_id);
                  const acc = tx.account_id ? accountMap.get(tx.account_id) : null;
                  const destAcc = tx.destination_account_id
                    ? accountMap.get(tx.destination_account_id)
                    : null;
                  const card = tx.credit_card_id ? cardMap.get(tx.credit_card_id) : null;
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';
                  const isCompleted = tx.status === 'completed';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                        {formatDate(tx.date)}
                      </td>

                      {/* Description with subtle icon */}
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] ${
                              isIncome
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : isTransfer
                                ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                                : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : isTransfer ? (
                              <ArrowLeftRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                          </span>
                          <span className="truncate">{tx.description}</span>
                          {tx.is_recurring && (
                            <span className="text-[10px] text-slate-400 font-normal shrink-0">
                              (Recorrente)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat?.color || '#94a3b8' }}
                          />
                          <span>{cat?.name || 'Geral'}</span>
                        </div>
                      </td>

                      {/* Account / Card Source */}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                        {card ? (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <CardIcon className="h-3 w-3 text-indigo-400" />
                            {card.name}
                          </span>
                        ) : isTransfer ? (
                          <span>
                            {acc?.name} → {destAcc?.name}
                          </span>
                        ) : acc ? (
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3 text-slate-400" />
                            {acc.name}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Installment */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {tx.installment_current && tx.installment_total ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                            {tx.installment_current}/{tx.installment_total}
                          </span>
                        ) : (
                          'À vista'
                        )}
                      </td>

                      {/* Status toggle action */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          onClick={() => toggleTransactionStatus(tx.id)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400'
                          }`}
                          title="Clique para alternar status entre Efetivado e Pendente"
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Efetivado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Amount */}
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isTransfer
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(tx.amount)}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(tx)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                            title="Editar transação"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setTxToDelete(tx)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Excluir transação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Editar Transação
              </h3>
              <button
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500">
                    Categoria
                  </label>
                  {editDesc.trim().length >= 2 && (
                    <button
                      type="button"
                      onClick={handleSuggestCategoryForEdit}
                      disabled={isSuggestingEditCategory}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <Sparkles className={`h-2.5 w-2.5 ${isSuggestingEditCategory ? 'animate-spin' : ''}`} />
                      <span>{isSuggestingEditCategory ? 'Analisando...' : 'Sugerir com IA'}</span>
                    </button>
                  )}
                </div>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('completed')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                      editStatus === 'completed'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Efetivado
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('pending')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                      editStatus === 'pending'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Pendente
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Transaction Deletion */}
      <ConfirmModal
        isOpen={!!txToDelete}
        title="Excluir Transação?"
        description={
          txToDelete
            ? `Tem certeza que deseja remover a movimentação "${txToDelete.description}" no valor de ${formatCurrency(txToDelete.amount)}?`
            : ''
        }
        confirmLabel="Sim, excluir"
        variant="danger"
        iconType="trash"
        onConfirm={() => {
          if (txToDelete) {
            deleteTransaction(txToDelete.id);
            setTxToDelete(null);
            toast.success('Transação removida.');
          }
        }}
        onCancel={() => setTxToDelete(null)}
      />
    </div>
  );
};
