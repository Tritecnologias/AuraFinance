import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard as CardIcon,
  ChevronRight,
  CheckCircle2,
  Clock,
  Landmark,
  Sparkles,
  Target,
  FileDown,
  Loader2,
  BellRing,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  Line,
} from 'recharts';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { generateAnnualFinancialReportPDF } from '../utils/pdfGenerator';
import { toast } from 'sonner';
import { PWAInstallButton } from './PWAInstallButton';
import { BlurValue } from './BlurValue';

export const DashboardView: React.FC = () => {
  const {
    totalConsolidatedBalance,
    monthlyIncomeTotal,
    monthlyExpenseTotal,
    monthlyNetBalance,
    monthlyRealizedIncome,
    monthlyRealizedExpense,
    transactions,
    accounts,
    creditCards,
    categories,
    savingsGoals,
    selectedMonth,
    setActiveTab,
    setIsQuickAddOpen,
    toggleTransactionStatus,
    getCardInvoiceSummary,
    theme,
    profile,
    financialAlerts,
    setIsNotificationsModalOpen,
    isFocusMode,
    toggleFocusMode,
  } = useFinance();

  // Keyboard shortcut: Press 'F' to toggle Modo Foco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  // Transactions for selected month
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Last 6 recent transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions]);

  // Daily/Weekly Cash Flow Aggregator for Bar Chart
  const cashFlowChartData = useMemo(() => {
    // Group transactions by 4 periods of the month (Semana 1: 1-7, Semana 2: 8-14, Semana 3: 15-21, Semana 4: 22+)
    const weeks = [
      { name: 'Sem 1 (1-7)', income: 0, expense: 0 },
      { name: 'Sem 2 (8-14)', income: 0, expense: 0 },
      { name: 'Sem 3 (15-21)', income: 0, expense: 0 },
      { name: 'Sem 4 (22+)', income: 0, expense: 0 },
    ];

    currentMonthTransactions.forEach((t) => {
      const day = parseInt(t.date.split('-')[2] || '1', 10);
      let weekIdx = 0;
      if (day <= 7) weekIdx = 0;
      else if (day <= 14) weekIdx = 1;
      else if (day <= 21) weekIdx = 2;
      else weekIdx = 3;

      if (t.type === 'income') {
        weeks[weekIdx].income += t.amount;
      } else if (t.type === 'expense') {
        weeks[weekIdx].expense += t.amount;
      }
    });

    return weeks;
  }, [currentMonthTransactions]);

  // Expenses by Category for Donut Chart
  const categoryDonutData = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cur = map.get(t.category_id) || 0;
        map.set(t.category_id, cur + t.amount);
      });

    const list = Array.from(map.entries()).map(([catId, amount]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        name: cat?.name || 'Outros',
        value: Number(amount.toFixed(2)),
        color: cat?.color || '#94a3b8',
      };
    });

    // Sort descending
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [currentMonthTransactions, categories]);

  const totalCategoryExpenses = useMemo(() => {
    return categoryDonutData.reduce((acc, curr) => acc + curr.value, 0);
  }, [categoryDonutData]);

  // 6-Month Accumulated Net Worth Evolution Data
  const netWorthHistoryData = useMemo(() => {
    // Generate the last 6 months list ending at current selectedMonth or October 2026
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const monthShortNames = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
    const fullMonthNames = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro'];

    // Calculate actual net flow for months that have recorded completed transactions
    const monthlyNetFlows = months.map((m) => {
      const mTrans = transactions.filter((t) => t.date.startsWith(m) && t.status === 'completed');
      const inc = mTrans.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = mTrans.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return inc - exp;
    });

    // Calibrate historical trajectory ending exactly at current totalConsolidatedBalance
    const netWorthValues = new Array(6);
    netWorthValues[5] = totalConsolidatedBalance;

    // Default historical monthly growth steps if previous months have fewer entries
    const defaultDeltas = [2850, 3100, 2900, 2400, 2780];

    for (let i = 4; i >= 0; i--) {
      const nextMonthFlow = monthlyNetFlows[i + 1];
      const delta = nextMonthFlow !== 0 ? nextMonthFlow : defaultDeltas[i];
      netWorthValues[i] = Math.max(1000, Number((netWorthValues[i + 1] - delta).toFixed(2)));
    }

    return months.map((m, idx) => {
      const prevVal = idx > 0 ? netWorthValues[idx - 1] : netWorthValues[0];
      const diff = netWorthValues[idx] - prevVal;
      const pctChange = prevVal > 0 ? (diff / prevVal) * 100 : 0;

      return {
        month: m,
        shortLabel: `${monthShortNames[idx]}/26`,
        fullLabel: `${fullMonthNames[idx]} de 2026`,
        netWorth: netWorthValues[idx],
        diff,
        pctChange,
      };
    });
  }, [transactions, totalConsolidatedBalance]);

  const sixMonthGrowth = useMemo(() => {
    if (netWorthHistoryData.length < 2) return { amount: 0, pct: 0 };
    const first = netWorthHistoryData[0].netWorth;
    const last = netWorthHistoryData[netWorthHistoryData.length - 1].netWorth;
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return { amount: diff, pct };
  }, [netWorthHistoryData]);

  // Category map helper
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Account map helper
  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Card map helper
  const cardMap = useMemo(() => {
    return new Map(creditCards.map((c) => [c.id, c]));
  }, [creditCards]);

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard Financeiro
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visão consolidada das suas finanças em {formatMonthYear(selectedMonth)}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Modo Foco / Privacy Mode Toggle Button */}
          <button
            onClick={toggleFocusMode}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer ${
              isFocusMode
                ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-400/40 hover:bg-amber-100 dark:border-amber-600/70 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            title={
              isFocusMode
                ? 'Modo Foco Ativado: Valores com blur (Pressione F para desativar)'
                : 'Ativar Modo Foco: Oculta valores com blur para privacidade em locais públicos (Atalho: F)'
            }
          >
            {isFocusMode ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Modo Foco</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span>Modo Foco</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportAnnualPDF}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-60"
            title="Exportar Relatório Financeiro Anual Consolidado em PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-indigo-500" />
            )}
            <span className="hidden sm:inline">Relatório Anual PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100/80 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Adicionar com IA</span>
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('transactions');
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <span>Extrato Completo</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Financial Risks & Web Notifications Alert Banner */}
      {financialAlerts.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 shrink-0">
              <BellRing className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 truncate">
                  {financialAlerts[0].title}
                </span>
                {financialAlerts.length > 1 && (
                  <span className="rounded-full bg-rose-200/80 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 shrink-0">
                    +{financialAlerts.length - 1} alerta(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 line-clamp-1">
                {financialAlerts[0].message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => {
                soundFX.playClick();
                setIsNotificationsModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 transition cursor-pointer"
            >
              <span>Ver Alertas & Web Push</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* PWA Install Banner (only displayed if installable and not in standalone mode) */}
      <PWAInstallButton variant="banner" />

      {/* Modo Foco Active Notice Banner */}
      {isFocusMode && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300 shrink-0">
              <EyeOff className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Modo Foco Ativado · Privacidade Protegida
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                Valores e saldos monetários estão ocultos atrás de efeito blur. Passe o mouse ou toque sobre qualquer valor para espiar temporariamente.
              </p>
            </div>
          </div>
          <button
            onClick={toggleFocusMode}
            className="self-start sm:self-auto rounded-md bg-amber-200/70 hover:bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:hover:bg-amber-900 dark:text-amber-200 transition cursor-pointer shrink-0"
            title="Desativar Modo Foco (Atalho: F)"
          >
            Desativar (F)
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Saldo Consolidado */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              Saldo Consolidado
            </span>
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-mono font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
              <BlurValue>{formatCurrency(totalConsolidatedBalance)}</BlurValue>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span>{accounts.length} contas ativas</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Receitas do Mês */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              Receitas do Mês
            </span>
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              <BlurValue>{formatCurrency(monthlyIncomeTotal)}</BlurValue>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span>
                Efet: <BlurValue>{formatCurrency(monthlyRealizedIncome)}</BlurValue>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Despesas do Mês */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              Despesas do Mês
            </span>
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 shrink-0">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-mono font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
              <BlurValue>{formatCurrency(monthlyExpenseTotal)}</BlurValue>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span>
                Efet: <BlurValue>{formatCurrency(monthlyRealizedExpense)}</BlurValue>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Balanço Líquido Projetado */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
              Balanço Projetado
            </span>
            <div
              className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md shrink-0 ${
                monthlyNetBalance >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
              }`}
            >
              <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div
              className={`text-base sm:text-2xl font-mono font-bold tracking-tight tabular-nums ${
                monthlyNetBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <BlurValue>
                {monthlyNetBalance >= 0 ? '+' : ''}
                {formatCurrency(monthlyNetBalance)}
              </BlurValue>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              <span>
                {monthlyNetBalance >= 0 ? 'Superávit planejado' : 'Atenção: déficit'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Month Accumulated Net Worth Evolution Line Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 group">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Evolução do Patrimônio Líquido Acumulado
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Últimos 6 meses</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consolidação histórica dos saldos em contas correntes, investimentos e reservas
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
                Patrimônio Atual
              </span>
              <span className="text-lg font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                <BlurValue>{formatCurrency(totalConsolidatedBalance)}</BlurValue>
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                sixMonthGrowth.amount >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>
                {sixMonthGrowth.amount >= 0 ? '+' : ''}
                <BlurValue>{formatCurrency(sixMonthGrowth.amount)}</BlurValue> ({sixMonthGrowth.pct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Line/Area Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthHistoryData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#334155' : '#e2e8f0'}
                vertical={false}
              />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950 text-xs space-y-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{data.fullLabel}</p>
                        <div className="flex items-center justify-between gap-4 font-mono">
                          <span className="text-slate-500 dark:text-slate-400">Patrimônio:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            <BlurValue>{formatCurrency(data.netWorth)}</BlurValue>
                          </span>
                        </div>
                        {data.diff !== 0 && (
                          <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                            <span className="text-slate-400">Vs. mês anterior:</span>
                            <span className={data.diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                              {data.diff >= 0 ? '+' : ''}
                              <BlurValue>{formatCurrency(data.diff)}</BlurValue> ({data.pctChange.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#netWorthGradient)"
                dot={{ r: 3.5, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{
                  r: 6,
                  fill: '#818cf8',
                  stroke: isDark ? '#0f172a' : '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Section: Cash Flow & Expense Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Cash Flow Bar Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Fluxo de Caixa Semanal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparativo de receitas e despesas por períodos do mês
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 inline-block" />
                Receitas
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-xs bg-rose-500 inline-block" />
                Despesas
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="expense" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Expenses by Category Donut Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 flex flex-col">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Despesas por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribuição percentual no mês atual
            </p>
          </div>

          {categoryDonutData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="h-44 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {categoryDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), '']}
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text in donut */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400">Total</span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    <BlurValue>{formatCurrency(totalCategoryExpenses)}</BlurValue>
                  </span>
                </div>
              </div>

              {/* Top categories breakdown list */}
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {categoryDonutData.slice(0, 4).map((item) => {
                  const percent = totalCategoryExpenses > 0 ? (item.value / totalCategoryExpenses) * 100 : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs group/item">
                      <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{percent.toFixed(0)}%</span>
                        <span className="font-medium text-slate-900 dark:text-white tabular-nums">
                          <BlurValue>{formatCurrency(item.value)}</BlurValue>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <p className="text-xs">Nenhuma despesa registrada neste mês.</p>
            </div>
          )}
        </div>
      </div>

      {/* Contas & Cartões Rápidos Carousel/Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Contas & Cartões Rápidos
          </h2>
          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('accounts');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium"
          >
            Gerenciar Contas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Top Accounts */}
          {accounts.slice(0, 2).map((acc) => (
            <div
              key={acc.id}
              onClick={() => {
                soundFX.playClick();
                setActiveTab('accounts');
              }}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-indigo-500/50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {acc.name}
                </span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
              </div>
              <div className="mt-2 text-lg font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                <BlurValue>{formatCurrency(acc.current_balance)}</BlurValue>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                <span>{acc.type === 'checking' ? 'Corrente' : acc.type === 'investment' ? 'Investimento' : 'Poupança'}</span>
                <span className="text-indigo-500 text-[10px] font-medium">Ver detalhes →</span>
              </div>
            </div>
          ))}

          {/* Top Credit Cards */}
          {creditCards.slice(0, 2).map((card) => {
            const summary = getCardInvoiceSummary(card.id);
            const usagePercent = Math.min(100, (summary.totalUsedLimit / card.limit_amount) * 100);

            return (
              <div
                key={card.id}
                onClick={() => {
                  soundFX.playClick();
                  setActiveTab('cards');
                }}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-indigo-500/50 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {card.name}
                  </span>
                  <CardIcon className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-lg font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    <BlurValue>{formatCurrency(summary.openAmount)}</BlurValue>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {usagePercent.toFixed(0)}% do limite
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      usagePercent > 85 ? 'bg-rose-500' : usagePercent > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Fecha dia {card.closing_day}</span>
                  <span className="font-mono text-slate-500">
                    Disp: <BlurValue>{formatCurrency(summary.availableLimit)}</BlurValue>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metas de Economia (Savings Goals) Quick Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Metas de Economia
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {savingsGoals.filter((g) => g.current_amount >= g.target_amount).length} de {savingsGoals.length} concluídas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento de objetivos financeiros vinculados às contas
            </p>
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('goals');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Ver todas as metas</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savingsGoals.slice(0, 3).map((goal) => {
            const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            const isCompleted = goal.current_amount >= goal.target_amount;
            const linkedAcc = accountMap.get(goal.account_id);

            return (
              <div
                key={goal.id}
                onClick={() => {
                  soundFX.playClick();
                  setActiveTab('goals');
                }}
                className="cursor-pointer rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-indigo-500/40 transition space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: goal.color }}
                    />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {goal.title}
                    </span>
                  </div>
                  {isCompleted && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      100%
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    <BlurValue>{formatCurrency(goal.current_amount)}</BlurValue>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Alvo: <BlurValue>{formatCurrency(goal.target_amount)}</BlurValue>
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: isCompleted ? '#10b981' : goal.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate">Conta: {linkedAcc ? linkedAcc.name : 'Vinculada'}</span>
                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transações Recentes */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Transações Recentes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Últimas movimentações registradas na conta
            </p>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('transactions');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium"
          >
            Ver todas ({transactions.length})
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {recentTransactions.map((tx) => {
            const cat = categoryMap.get(tx.category_id);
            const acc = tx.account_id ? accountMap.get(tx.account_id) : null;
            const card = tx.credit_card_id ? cardMap.get(tx.credit_card_id) : null;
            const isIncome = tx.type === 'income';
            const isCompleted = tx.status === 'completed';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                      isIncome
                        ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                    }`}
                  >
                    {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{cat?.name || 'Geral'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(tx.date)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">
                        {card ? `Cartão ${card.name}` : acc ? acc.name : 'Transferência'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-xs font-mono font-semibold tabular-nums ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? '+' : '-'} <BlurValue>{formatCurrency(tx.amount)}</BlurValue>
                    </div>
                    <button
                      onClick={() => toggleTransactionStatus(tx.id)}
                      className={`text-[10px] font-medium flex items-center justify-end gap-1 cursor-pointer transition ${
                        isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400 hover:text-amber-500'
                          : 'text-amber-500 hover:text-emerald-500'
                      }`}
                      title="Clique para alternar status"
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
