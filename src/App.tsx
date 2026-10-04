/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Toaster } from 'sonner';
import { Plus } from 'lucide-react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { CardsView } from './components/CardsView';
import { BudgetsView } from './components/BudgetsView';
import { SavingsGoalsView } from './components/SavingsGoalsView';
import { AccountsView } from './components/AccountsView';
import { QuickAddModal } from './components/QuickAddModal';
import { SupabaseModal } from './components/SupabaseModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BackupModal } from './components/BackupModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileBottomNav } from './components/MobileBottomNav';
import { soundFX } from './utils/audio';

const MainContent: React.FC = () => {
  const {
    activeTab,
    setIsQuickAddOpen,
    theme,
    isBackupModalOpen,
    setIsBackupModalOpen,
  } = useFinance();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Header />

      {/* Main Viewport Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-5 pb-24 md:pb-8">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'transactions' && <TransactionsView />}
        {activeTab === 'cards' && <CardsView />}
        {activeTab === 'budgets' && <BudgetsView />}
        {activeTab === 'goals' && <SavingsGoalsView />}
        {activeTab === 'accounts' && <AccountsView />}
      </main>

      {/* Desktop Footer (Hidden on mobile to yield space to bottom dock) */}
      <footer className="mt-auto border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-400 dark:border-slate-800/80 dark:bg-slate-950/60 hidden md:block">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Aura Finance · Gestão Financeira Pessoal & Planejamento</span>
          <span className="font-mono text-[11px] text-slate-500">
            Pressione <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 border border-slate-200 dark:border-slate-700">N</kbd> nova transação · <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 border border-slate-200 dark:border-slate-700">F</kbd> modo foco
          </span>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Dock */}
      <MobileBottomNav />

      {/* Modals */}
      <QuickAddModal />
      <SupabaseModal />
      <NotificationsModal />
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Sonner Toast Notifications */}
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        closeButton
      />
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <MainContent />
    </FinanceProvider>
  );
}
