import React, { useState, useMemo } from 'react';
import {
  Landmark,
  Plus,
  ArrowLeftRight,
  TrendingUp,
  Wallet,
  PiggyBank,
  Banknote,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Account, AccountType } from '../types/finance';
import { formatCurrency } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';

export const AccountsView: React.FC = () => {
  const {
    accounts,
    addAccount,
    updateAccount,
    deleteAccount,
    setIsQuickAddOpen,
  } = useFinance();

  // Add / Edit Account Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('checking');
  const [accInitialBalance, setAccInitialBalance] = useState('');
  const [accColor, setAccColor] = useState('#820AD1');

  // Metrics
  const { totalChecking, totalInvestments, totalSavings, totalCash } = useMemo(() => {
    let checking = 0;
    let inv = 0;
    let sav = 0;
    let cash = 0;

    accounts.forEach((a) => {
      if (a.type === 'checking') checking += a.current_balance;
      if (a.type === 'investment') inv += a.current_balance;
      if (a.type === 'savings') sav += a.current_balance;
      if (a.type === 'cash') cash += a.current_balance;
    });

    return { totalChecking: checking, totalInvestments: inv, totalSavings: sav, totalCash: cash };
  }, [accounts]);

  const handleOpenModal = (account?: Account) => {
    soundFX.playClick();
    if (account) {
      setEditingAccount(account);
      setAccName(account.name);
      setAccType(account.type);
      setAccInitialBalance(account.initial_balance.toString());
      setAccColor(account.color);
    } else {
      setEditingAccount(null);
      setAccName('');
      setAccType('checking');
      setAccInitialBalance('1000');
      setAccColor('#820AD1');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(accInitialBalance.replace(',', '.'));
    if (!accName.trim() || isNaN(balance)) {
      soundFX.playError();
      toast.error('Preencha os dados da conta corretamente.');
      return;
    }

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        name: accName.trim(),
        type: accType,
        color: accColor,
      });
    } else {
      addAccount({
        name: accName.trim(),
        type: accType,
        initial_balance: balance,
        current_balance: balance,
        color: accColor,
      });
    }

    setIsModalOpen(false);
  };

  const getTypeIcon = (type: AccountType) => {
    switch (type) {
      case 'checking':
        return <Landmark className="h-4 w-4" />;
      case 'investment':
        return <TrendingUp className="h-4 w-4" />;
      case 'savings':
        return <PiggyBank className="h-4 w-4" />;
      case 'cash':
        return <Banknote className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'checking':
        return 'Conta Corrente';
      case 'investment':
        return 'Investimentos';
      case 'savings':
        return 'Poupança / Reserva';
      case 'cash':
        return 'Dinheiro Físico';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Contas Bancárias & Carteiras
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gerencie saldos em contas correntes, corretoras de investimento e reservas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
            <span>Transferir entre Contas</span>
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Nova Conta</span>
          </button>
        </div>
      </div>

      {/* Account Type Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Contas Correntes</span>
            <Landmark className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(totalChecking)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Investimentos</span>
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(totalInvestments)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Reserva de Emergência</span>
            <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(totalSavings)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Dinheiro em Espécie</span>
            <Banknote className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-2 text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(totalCash)}
          </div>
        </div>
      </div>

      {/* Accounts List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/90 dark:hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: acc.color }}
                  >
                    {getTypeIcon(acc.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {acc.name}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {getTypeLabel(acc.type)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(acc)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Editar conta"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => setAccountToDelete(acc)}
                      className="rounded p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Excluir conta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400">Saldo Atual Disponível</span>
                <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(acc.current_balance)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 text-[11px] text-slate-400 flex justify-between font-mono">
              <span>Saldo Inicial:</span>
              <span>{formatCurrency(acc.initial_balance)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingAccount ? 'Editar Conta' : 'Nova Conta Bancária'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nome da Conta / Instituição
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank, Itaú, Banco Inter, XP..."
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Tipo de Conta
                </label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as AccountType)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="checking">Conta Corrente</option>
                  <option value="investment">Investimentos / Corretora</option>
                  <option value="savings">Poupança / Reserva de Emergência</option>
                  <option value="cash">Dinheiro em Espécie (Físico)</option>
                </select>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Saldo Inicial (R$)
                  </label>
                  <input
                    type="text"
                    value={accInitialBalance}
                    onChange={(e) => setAccInitialBalance(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Cor da Identidade
                </label>
                <div className="flex gap-2">
                  {['#820AD1', '#EC7000', '#E6A100', '#00C087', '#3B82F6', '#64748B'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        accColor === c ? 'border-white ring-2 ring-indigo-500' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Account Deletion */}
      <ConfirmModal
        isOpen={!!accountToDelete}
        title="Excluir Conta Bancária?"
        description={
          accountToDelete
            ? `Tem certeza que deseja remover a conta "${accountToDelete.name}"? O saldo consolidado será recalculado.`
            : ''
        }
        confirmLabel="Sim, excluir conta"
        variant="danger"
        iconType="trash"
        onConfirm={() => {
          if (accountToDelete) {
            deleteAccount(accountToDelete.id);
            setAccountToDelete(null);
            toast.success(`Conta "${accountToDelete.name}" removida.`);
          }
        }}
        onCancel={() => setAccountToDelete(null)}
      />
    </div>
  );
};
