import React, { useState, useMemo } from 'react';
import {
  PieChart as PieIcon,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Edit2,
  Plus,
  X,
  Target,
  ShieldAlert,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { soundFX } from '../utils/audio';

export const BudgetsView: React.FC = () => {
  const {
    categories,
    budgets,
    selectedMonth,
    categorySpendingMap,
    setBudgetLimit,
  } = useFinance();

  // Edit budget modal state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editLimitStr, setEditLimitStr] = useState<string>('');

  // Filter only expense categories
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense');
  }, [categories]);

  // Aggregate budget rows with spending
  const budgetRows = useMemo(() => {
    return expenseCategories.map((cat) => {
      const budgetObj = budgets.find(
        (b) => b.category_id === cat.id && b.month_year === selectedMonth
      );
      const limit = budgetObj ? budgetObj.limit_amount : 0;
      const spent = categorySpendingMap.get(cat.id) || 0;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      const remaining = limit - spent;
      const isOverBudget = limit > 0 && spent > limit;

      let statusColor: 'green' | 'amber' | 'red' = 'green';
      if (percentage > 90 || isOverBudget) {
        statusColor = 'red';
      } else if (percentage >= 70) {
        statusColor = 'amber';
      }

      return {
        category: cat,
        limit,
        spent,
        percentage,
        remaining,
        isOverBudget,
        statusColor,
      };
    });
  }, [expenseCategories, budgets, selectedMonth, categorySpendingMap]);

  // Global Totals
  const { totalBudgeted, totalSpent, overBudgetCount } = useMemo(() => {
    let bTotal = 0;
    let sTotal = 0;
    let over = 0;

    budgetRows.forEach((r) => {
      bTotal += r.limit;
      sTotal += r.spent;
      if (r.isOverBudget) over++;
    });

    return { totalBudgeted: bTotal, totalSpent: sTotal, overBudgetCount: over };
  }, [budgetRows]);

  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const handleOpenEdit = (categoryId: string, currentLimit: number) => {
    soundFX.playClick();
    setEditingCategoryId(categoryId);
    setEditLimitStr(currentLimit > 0 ? currentLimit.toString() : '');
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryId) return;

    const val = parseFloat(editLimitStr.replace(',', '.'));
    const limit = isNaN(val) ? 0 : Math.max(0, val);

    setBudgetLimit(editingCategoryId, selectedMonth, limit);
    setEditingCategoryId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Orçamentos & Metas Mensais
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhe o limite de gastos planejado para cada categoria em {formatMonthYear(selectedMonth)}.
          </p>
        </div>
      </div>

      {/* Global Commitment Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Target className="h-4 w-4 text-indigo-500" />
              <span>Comprometimento Global do Orçamento</span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {overallPercentage.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Gasto {formatCurrency(totalSpent)} de {formatCurrency(totalBudgeted)} planejado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {overBudgetCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                <ShieldAlert className="h-4 w-4" />
                <span>
                  {overBudgetCount} {overBudgetCount === 1 ? 'categoria estourou' : 'categorias estouraram'} o teto
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              overallPercentage > 90
                ? 'bg-rose-500'
                : overallPercentage >= 70
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, overallPercentage)}%` }}
          />
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Normal (&lt; 70%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Atenção (70% - 90%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Alerta Crítico / Estourado (&gt; 90%)
          </span>
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetRows.map((row) => {
          const { category, limit, spent, percentage, remaining, isOverBudget, statusColor } = row;
          const hasLimit = limit > 0;

          return (
            <div
              key={category.id}
              className={`rounded-xl border bg-white p-5 shadow-2xs transition dark:bg-slate-900/90 relative ${
                isOverBudget
                  ? 'border-rose-300 dark:border-rose-900/80'
                  : statusColor === 'amber'
                  ? 'border-amber-200 dark:border-amber-900/50'
                  : 'border-slate-200 dark:border-slate-800/80'
              }`}
            >
              {/* Overbudget Alert Badge */}
              {isOverBudget && (
                <div className="mb-3 flex items-center justify-between rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Teto Estourado! Excedente de {formatCurrency(Math.abs(remaining))}</span>
                  </div>
                </div>
              )}

              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {category.name}
                  </h3>
                </div>

                <button
                  onClick={() => handleOpenEdit(category.id, limit)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>{hasLimit ? 'Ajustar' : 'Definir Teto'}</span>
                </button>
              </div>

              {/* Values Breakdown */}
              <div className="mt-4 flex items-baseline justify-between font-mono text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block font-sans">Gasto Atual</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(spent)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-sans">Limite Estipulado</span>
                  <span className="text-base font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    {hasLimit ? formatCurrency(limit) : 'Não definido'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {hasLimit ? (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        statusColor === 'red'
                          ? 'bg-rose-500'
                          : statusColor === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold font-mono ${
                        statusColor === 'red'
                          ? 'text-rose-600 dark:text-rose-400'
                          : statusColor === 'amber'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {percentage.toFixed(0)}% consumido
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {remaining >= 0
                        ? `Resta ${formatCurrency(remaining)}`
                        : `Excedeu ${formatCurrency(Math.abs(remaining))}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 py-2 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-lg">
                  Nenhum teto configurado para este mês.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Budget Modal */}
      {editingCategoryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Definir Limite de Gastos
              </h3>
              <button
                onClick={() => setEditingCategoryId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Categoria
                </label>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {categories.find((c) => c.id === editingCategoryId)?.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Teto Mensal para {formatMonthYear(selectedMonth)} (R$)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 1200,00"
                  autoFocus
                  value={editLimitStr}
                  onChange={(e) => setEditLimitStr(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base font-mono font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategoryId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Salvar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
