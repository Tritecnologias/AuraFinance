import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Landmark,
  Layers,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { SavingsGoal } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';

export const SavingsGoalsView: React.FC = () => {
  const {
    savingsGoals,
    accounts,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    depositToGoal,
    withdrawFromGoal,
  } = useFinance();

  // Modal: Create / Edit Goal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalAccountId, setGoalAccountId] = useState('');
  const [goalColor, setGoalColor] = useState('#6366f1');

  // Modal: Deposit into Goal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [targetGoalId, setTargetGoalId] = useState<string | null>(null);
  const [depositAmountStr, setDepositAmountStr] = useState('');
  const [depositSourceAccId, setDepositSourceAccId] = useState('');

  // Modal: Withdraw from Goal
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  // Account map
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Global KPIs
  const { totalTarget, totalAccumulated, completedGoalsCount, activeGoalsCount } = useMemo(() => {
    let t = 0;
    let a = 0;
    let c = 0;
    savingsGoals.forEach((g) => {
      t += g.target_amount;
      a += g.current_amount;
      if (g.current_amount >= g.target_amount) c++;
    });
    return {
      totalTarget: t,
      totalAccumulated: a,
      completedGoalsCount: c,
      activeGoalsCount: savingsGoals.length - c,
    };
  }, [savingsGoals]);

  const globalProgressPct = totalTarget > 0 ? (totalAccumulated / totalTarget) * 100 : 0;

  // Open Create/Edit
  const handleOpenGoalModal = (goal?: SavingsGoal) => {
    soundFX.playClick();
    if (goal) {
      setEditingGoal(goal);
      setGoalTitle(goal.title);
      setGoalTargetAmount(goal.target_amount.toString());
      setGoalCurrentAmount(goal.current_amount.toString());
      setGoalTargetDate(goal.target_date);
      setGoalAccountId(goal.account_id);
      setGoalColor(goal.color);
    } else {
      setEditingGoal(null);
      setGoalTitle('');
      setGoalTargetAmount('10000');
      setGoalCurrentAmount('0');
      // default 6 months ahead
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 6);
      setGoalTargetDate(nextDate.toISOString().slice(0, 10));
      setGoalAccountId(accounts[0]?.id || '');
      setGoalColor('#6366f1');
    }
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTargetAmount.replace(',', '.'));
    const current = parseFloat(goalCurrentAmount.replace(',', '.')) || 0;

    if (!goalTitle.trim() || isNaN(target) || target <= 0 || !goalTargetDate || !goalAccountId) {
      soundFX.playError();
      toast.error('Preencha os dados da meta corretamente.');
      return;
    }

    if (editingGoal) {
      updateSavingsGoal(editingGoal.id, {
        title: goalTitle.trim(),
        target_amount: target,
        current_amount: current,
        target_date: goalTargetDate,
        account_id: goalAccountId,
        color: goalColor,
      });
    } else {
      addSavingsGoal({
        title: goalTitle.trim(),
        target_amount: target,
        current_amount: current,
        target_date: goalTargetDate,
        account_id: goalAccountId,
        color: goalColor,
      });
    }

    setIsGoalModalOpen(false);
  };

  // Open Deposit Modal
  const handleOpenDepositModal = (goal: SavingsGoal) => {
    soundFX.playClick();
    setTargetGoalId(goal.id);
    setDepositAmountStr('');
    // suggest checking account or linked account
    const defaultAcc = accounts.find((a) => a.type === 'checking') || accounts[0];
    setDepositSourceAccId(defaultAcc?.id || goal.account_id);
    setIsDepositModalOpen(true);
  };

  const handleConfirmDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGoalId) return;

    const val = parseFloat(depositAmountStr.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      soundFX.playError();
      toast.error('Informe um valor de aporte válido maior que zero.');
      return;
    }

    depositToGoal(targetGoalId, val, depositSourceAccId);
    setIsDepositModalOpen(false);
  };

  // Open Withdraw Modal
  const handleOpenWithdrawModal = (goal: SavingsGoal) => {
    soundFX.playClick();
    setTargetGoalId(goal.id);
    setWithdrawAmountStr('');
    setIsWithdrawModalOpen(true);
  };

  const handleConfirmWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetGoalId) return;

    const val = parseFloat(withdrawAmountStr.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      soundFX.playError();
      toast.error('Informe um valor de resgate válido maior que zero.');
      return;
    }

    withdrawFromGoal(targetGoalId, val);
    setIsWithdrawModalOpen(false);
  };

  // Calculate days remaining helper
  const getDaysRemaining = (targetDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = targetDateStr.split('-');
    const target = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Metas de Economia (Savings Goals)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Defina objetivos financeiros, datas alvo e acompanhe o progresso com barras de preenchimento vinculadas às suas contas.
          </p>
        </div>

        <button
          onClick={() => handleOpenGoalModal()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Nova Meta</span>
        </button>
      </div>

      {/* Global Goals Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/70">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Total Acumulado em Metas</span>
            <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(totalAccumulated)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Objetivo Total Consolidado</span>
            <span className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {formatCurrency(totalTarget)}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Progresso Geral</span>
            <span className="text-2xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {globalProgressPct.toFixed(1)}%
            </span>
          </div>

          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Status das Metas</span>
            <div className="mt-1 flex items-center gap-2 text-xs font-medium">
              <span className="text-emerald-600 dark:text-emerald-400">
                {completedGoalsCount} concluídas
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {activeGoalsCount} em progresso
              </span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, globalProgressPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Goals Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {savingsGoals.map((goal) => {
          const linkedAcc = accountMap.get(goal.account_id);
          const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
          const isCompleted = goal.current_amount >= goal.target_amount;
          const remaining = Math.max(0, goal.target_amount - goal.current_amount);
          const daysLeft = getDaysRemaining(goal.target_date);
          const isOverdue = daysLeft < 0 && !isCompleted;

          return (
            <div
              key={goal.id}
              className={`rounded-2xl border bg-white p-5 shadow-2xs transition flex flex-col justify-between dark:bg-slate-900/90 relative overflow-hidden ${
                isCompleted
                  ? 'border-emerald-300 dark:border-emerald-900/60'
                  : isOverdue
                  ? 'border-amber-300 dark:border-amber-900/60'
                  : 'border-slate-200 dark:border-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-500/40'
              }`}
            >
              {/* Header color accent indicator */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: goal.color }}
              />

              <div>
                {/* Top Row: Title, Status Badge & Actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs shrink-0"
                      style={{ backgroundColor: goal.color }}
                    >
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {goal.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <Landmark className="h-3 w-3" />
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {linkedAcc ? linkedAcc.name : 'Conta vinculada'}
                        </span>
                        <span>·</span>
                        <span>Saldo: {linkedAcc ? formatCurrency(linkedAcc.current_balance) : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenGoalModal(goal)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      title="Editar meta"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setGoalToDelete(goal)}
                      className="rounded p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                      title="Excluir meta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="space-y-1.5 my-4">
                  <div className="flex items-baseline justify-between font-mono">
                    <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(goal.current_amount)}
                    </div>
                    <div className="text-xs text-slate-400 font-sans">
                      Alvo: <strong className="font-mono text-slate-600 dark:text-slate-300">{formatCurrency(goal.target_amount)}</strong>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : pct >= 70
                          ? 'bg-indigo-600'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {pct.toFixed(1)}% atingido
                    </span>
                    <span>
                      {isCompleted ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Meta Atingida!
                        </span>
                      ) : (
                        `Faltam ${formatCurrency(remaining)}`
                      )}
                    </span>
                  </div>
                </div>

                {/* Target Date and Timeline Badge */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Data Alvo: <strong>{formatDate(goal.target_date)}</strong></span>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Concluída 🎉
                      </span>
                    ) : isOverdue ? (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Venceu há {Math.abs(daysLeft)} dias
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysLeft === 0 ? 'Vence hoje' : `Faltam ${daysLeft} dias`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-end gap-2">
                {goal.current_amount > 0 && (
                  <button
                    onClick={() => handleOpenWithdrawModal(goal)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                  >
                    Resgatar
                  </button>
                )}

                <button
                  onClick={() => handleOpenDepositModal(goal)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-2xs transition active:scale-98 cursor-pointer"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Aportar na Meta</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Aportar na Meta */}
      {isDepositModalOpen && targetGoalId && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span>Novo Aporte na Meta</span>
              </h3>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeposit} className="mt-4 space-y-4">
              <div className="rounded-xl bg-indigo-50/50 p-3.5 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40">
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">
                  Meta Selecionada:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {savingsGoals.find((g) => g.id === targetGoalId)?.title}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Valor do Aporte (R$)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="0,00"
                  value={depositAmountStr}
                  onChange={(e) => setDepositAmountStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xl font-mono font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Debitar da Conta de Origem
                </label>
                <select
                  value={depositSourceAccId}
                  onChange={(e) => setDepositSourceAccId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.current_balance)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  O valor será transferido para a conta vinculada à meta automaticamente.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resgatar da Meta */}
      {isWithdrawModalOpen && targetGoalId && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Resgatar Valor da Meta
              </h3>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmWithdraw} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Valor a Resgatar (R$)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="0,00"
                  value={withdrawAmountStr}
                  onChange={(e) => setWithdrawAmountStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xl font-mono font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg shadow-xs"
                >
                  Confirmar Resgate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Meta */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingGoal ? 'Editar Meta de Economia' : 'Nova Meta de Economia'}
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Título do Objetivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Reserva de Emergência, Carro Novo, Casamento..."
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Valor Alvo (R$)
                  </label>
                  <input
                    type="text"
                    value={goalTargetAmount}
                    onChange={(e) => setGoalTargetAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="text"
                    value={goalCurrentAmount}
                    onChange={(e) => setGoalCurrentAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Data Alvo
                  </label>
                  <input
                    type="date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Conta Vinculada
                  </label>
                  <select
                    value={goalAccountId}
                    onChange={(e) => setGoalAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Cor da Meta
                </label>
                <div className="flex gap-2">
                  {['#6366F1', '#00C087', '#10B981', '#EC7000', '#F43F5E', '#3B82F6', '#8B5CF6'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGoalColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        goalColor === c ? 'border-white ring-2 ring-indigo-500' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Goal Deletion */}
      <ConfirmModal
        isOpen={!!goalToDelete}
        title="Excluir Meta de Economia?"
        description={
          goalToDelete
            ? `Tem certeza que deseja remover a meta "${goalToDelete.title}"? O saldo já acumulado nesta meta continuará contabilizado no seu patrimônio.`
            : ''
        }
        confirmLabel="Sim, excluir meta"
        variant="danger"
        iconType="trash"
        onConfirm={() => {
          if (goalToDelete) {
            deleteSavingsGoal(goalToDelete.id);
            setGoalToDelete(null);
            toast.success(`Meta "${goalToDelete.title}" removida.`);
          }
        }}
        onCancel={() => setGoalToDelete(null)}
      />
    </div>
  );
};
