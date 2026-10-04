import React, { useState } from 'react';
import {
  Wallet,
  ArrowLeftRight,
  CreditCard as CardIcon,
  Plus,
  MoreHorizontal,
  PieChart as BudgetsIcon,
  Target,
  Landmark,
  Eye,
  EyeOff,
  Bell,
  FileDown,
  Database,
  X,
  ChevronRight,
  RotateCcw,
  HardDrive,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { ActiveTab } from '../types/finance';
import { soundFX } from '../utils/audio';
import { ConfirmModal } from './ConfirmModal';

export const MobileBottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsQuickAddOpen,
    setIsNotificationsModalOpen,
    setIsBackupModalOpen,
    setIsSqlModalOpen,
    backupsList,
    unreadAlertsCount,
    isFocusMode,
    toggleFocusMode,
    resetToMockData,
  } = useFinance();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleTabClick = (tab: ActiveTab) => {
    soundFX.playClick();
    setActiveTab(tab);
    setIsMoreMenuOpen(false);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Início', icon: Wallet },
    { id: 'transactions', label: 'Extrato', icon: ArrowLeftRight },
    { id: 'cards', label: 'Cartões', icon: CardIcon },
  ];

  return (
    <>
      {/* Slide-up "Mais" Sheet / Drawer for Mobile */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => {
              soundFX.playClick();
              setIsMoreMenuOpen(false);
            }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          {/* Menu Card */}
          <div className="relative z-10 w-full rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Grab Handle */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Menu & Ferramentas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Navegação e configurações do Aura Finance
                </p>
              </div>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Navigation Items */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleTabClick('budgets')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border transition cursor-pointer ${
                  activeTab === 'budgets'
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <BudgetsIcon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold">Orçamentos</span>
              </button>

              <button
                onClick={() => handleTabClick('goals')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border transition cursor-pointer ${
                  activeTab === 'goals'
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Target className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold">Metas</span>
              </button>

              <button
                onClick={() => handleTabClick('accounts')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 border transition cursor-pointer ${
                  activeTab === 'accounts'
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Landmark className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold">Contas</span>
              </button>
            </div>

            {/* Quick Action Rows */}
            <div className="mt-4 space-y-2">
              {/* Focus Mode Row */}
              <button
                onClick={() => {
                  toggleFocusMode();
                  setIsMoreMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      isFocusMode
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isFocusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Modo Foco (Privacidade)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isFocusMode ? 'Ativo · Ocultando valores monetários' : 'Desativado'}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isFocusMode
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {isFocusMode ? 'ATIVO' : 'DESLIGADO'}
                </span>
              </button>

              {/* Notifications Row */}
              <button
                onClick={() => {
                  soundFX.playClick();
                  setIsNotificationsModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Alertas & Notificações Push</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {unreadAlertsCount > 0 ? `${unreadAlertsCount} novo(s) alerta(s)` : 'Tudo em dia'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {/* IndexedDB Backup Row */}
              <button
                onClick={() => {
                  soundFX.playClick();
                  setIsBackupModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Backup no Navegador (IndexedDB)</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Snapshots agendados JSON/CSV · {backupsList.length} salvo(s)
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {/* Supabase Schema Row */}
              <button
                onClick={() => {
                  soundFX.playClick();
                  setIsSqlModalOpen(true);
                  setIsMoreMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Script SQL Supabase</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      DDL, Índices e Políticas de Segurança RLS
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {/* Reset Demo Data */}
              <button
                onClick={() => {
                  soundFX.playClick();
                  setIsResetConfirmOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar dados de demonstração</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Resetting Demo Data on Mobile */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Restaurar dados de demonstração?"
        description="Esta ação recarregará as transações, contas e cartões com a base inicial de demonstração. Quaisquer alterações manuais não salvas serão substituídas."
        confirmLabel="Sim, restaurar dados"
        variant="warning"
        iconType="reset"
        onConfirm={() => {
          resetToMockData();
          setIsResetConfirmOpen(false);
          setIsMoreMenuOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Modern Fixed Bottom Dock for Mobile */}
      <nav
        aria-label="Navegação Principal Mobile"
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 py-2 backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/95 md:hidden shadow-lg safe-area-pb"
      >
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => handleTabClick('dashboard')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Wallet className={`h-5 w-5 ${activeTab === 'dashboard' ? 'stroke-[2.3]' : 'stroke-[1.7]'}`} />
          <span className="text-[10px] leading-tight">Início</span>
        </button>

        {/* Tab 2: Extrato / Transações */}
        <button
          onClick={() => handleTabClick('transactions')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition cursor-pointer ${
            activeTab === 'transactions'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowLeftRight className={`h-5 w-5 ${activeTab === 'transactions' ? 'stroke-[2.3]' : 'stroke-[1.7]'}`} />
          <span className="text-[10px] leading-tight">Extrato</span>
        </button>

        {/* Central Prominent Quick Add Button (+) */}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(true);
            }}
            className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/35 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-white dark:ring-slate-950"
            title="Nova Transação (Atalho N)"
            aria-label="Adicionar Nova Transação"
          >
            <Plus className="h-6 w-6 stroke-[2.7]" />
          </button>
        </div>

        {/* Tab 3: Cartões */}
        <button
          onClick={() => handleTabClick('cards')}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition cursor-pointer ${
            activeTab === 'cards'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CardIcon className={`h-5 w-5 ${activeTab === 'cards' ? 'stroke-[2.3]' : 'stroke-[1.7]'}`} />
          <span className="text-[10px] leading-tight">Cartões</span>
        </button>

        {/* Tab 4: Mais (Drawer) */}
        <button
          onClick={() => {
            soundFX.playClick();
            setIsMoreMenuOpen(!isMoreMenuOpen);
          }}
          className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition cursor-pointer ${
            ['budgets', 'goals', 'accounts'].includes(activeTab) || isMoreMenuOpen
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MoreHorizontal className="h-5 w-5 stroke-[1.8]" />
          <span className="text-[10px] leading-tight">Mais</span>
          {unreadAlertsCount > 0 && (
            <span className="absolute top-0 right-3.5 flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
      </nav>
    </>
  );
};
