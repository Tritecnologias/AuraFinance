import React from 'react';
import {
  Wallet,
  ArrowLeftRight,
  CreditCard as CreditCardIcon,
  PieChart as PieChartIcon,
  Landmark,
  Plus,
  Sun,
  Moon,
  Database,
  Calendar,
  RotateCcw,
  Target,
  Bell,
  Eye,
  EyeOff,
  HardDrive,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { ActiveTab } from '../types/finance';
import { formatMonthYear } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { ConfirmModal } from './ConfirmModal';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    isFocusMode,
    toggleFocusMode,
    selectedMonth,
    setSelectedMonth,
    setIsQuickAddOpen,
    setIsSqlModalOpen,
    setIsNotificationsModalOpen,
    setIsBackupModalOpen,
    backupsList,
    unreadAlertsCount,
    resetToMockData,
    profile,
  } = useFinance();

  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Wallet },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
    { id: 'cards', label: 'Cartões', icon: CreditCardIcon },
    { id: 'budgets', label: 'Orçamentos', icon: PieChartIcon },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'accounts', label: 'Contas', icon: Landmark },
  ];

  // Month navigation options (previous 3 months and next 2 months)
  const availableMonths = [
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12',
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    soundFX.playClick();
    setActiveTab(tabId);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm shadow-indigo-500/20">
            <span className="text-base tracking-tighter">A</span>
          </div>
          <button
            onClick={() => handleNavClick('dashboard')}
            className="text-left group cursor-pointer"
          >
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Aura Finance
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800/80 dark:text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Month Selector */}
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => {
                soundFX.playClick();
                setSelectedMonth(e.target.value);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-8 pr-7 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700"
              title="Filtrar competência mensal"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Supabase Schema Modal Button */}
          <button
            onClick={() => {
              soundFX.playClick();
              setIsSqlModalOpen(true);
            }}
            className="hidden sm:flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 cursor-pointer"
            title="Ver Script SQL & RLS para Supabase"
          >
            <Database className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden lg:inline">Supabase SQL</span>
          </button>

          {/* Reset Demo Data Button */}
          <button
            onClick={() => {
              soundFX.playClick();
              setIsResetConfirmOpen(true);
            }}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200 cursor-pointer"
            title="Restaurar dados de demonstração"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* IndexedDB Backup Center */}
          <button
            onClick={() => {
              soundFX.playClick();
              setIsBackupModalOpen(true);
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white cursor-pointer"
            title="Backup no Navegador (IndexedDB) & Exportação Agendada"
          >
            <HardDrive className="h-3.5 w-3.5" />
            {backupsList.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-mono font-bold text-white shadow-2xs">
                {backupsList.length}
              </span>
            )}
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white cursor-pointer"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Privacy Focus Mode Toggle Button */}
          <button
            onClick={toggleFocusMode}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer ${
              isFocusMode
                ? 'border-amber-400 bg-amber-500/10 text-amber-600 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-400 ring-1 ring-amber-400/40'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
            }`}
            title={
              isFocusMode
                ? 'Modo Foco Ativado: Valores com blur (Clique ou pressione F para desativar)'
                : 'Ativar Modo Foco: Ocultar valores com blur em locais públicos (Atalho: F)'
            }
          >
            {isFocusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          {/* Notifications & Push Alerts Center */}
          <button
            onClick={() => {
              soundFX.playClick();
              setIsNotificationsModalOpen(true);
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white cursor-pointer"
            title="Central de Notificações Web e Alertas Financeiros"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-mono font-bold text-white shadow-xs animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Primary Action: New Transaction Button (Desktop / Tablet) */}
          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(true);
            }}
            className="hidden md:flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 active:scale-98 whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Nova Transação</span>
            <kbd className="hidden lg:inline-block ml-1 rounded bg-indigo-700/60 px-1 py-0.5 text-[10px] font-mono opacity-80">
              N
            </kbd>
          </button>

          {/* User Avatar */}
          <div
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 ring-1 border border-slate-300 dark:border-slate-700"
            title={profile.full_name}
          >
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Resetting Demo Data */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Restaurar dados de teste?"
        description="Esta ação recarregará as transações, contas e cartões com a base inicial de demonstração. Quaisquer alterações manuais não salvas serão substituídas."
        confirmLabel="Sim, restaurar dados"
        variant="warning"
        iconType="reset"
        onConfirm={() => {
          resetToMockData();
          setIsResetConfirmOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </header>
  );
};
