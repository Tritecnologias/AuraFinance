import React, { useState } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { CreditCard } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';

export const CardsView: React.FC = () => {
  const {
    creditCards,
    accounts,
    categories,
    getCardInvoiceSummary,
    payCreditCardInvoice,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
  } = useFinance();

  const [selectedCardId, setSelectedCardId] = useState<string>(() => creditCards[0]?.id || '');
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<'open' | 'closed' | 'future'>('open');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Pay Invoice Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payCardId, setPayCardId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paySourceAccountId, setPaySourceAccountId] = useState('');

  // Add/Edit Card Modal State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('20');
  const [cardDueDay, setCardDueDay] = useState('28');
  const [cardColor, setCardColor] = useState('#6366f1');

  const activeCard = creditCards.find((c) => c.id === selectedCardId) || creditCards[0];
  const summary = activeCard ? getCardInvoiceSummary(activeCard.id) : null;

  const handleOpenPayModal = (cardId: string, amount: number) => {
    soundFX.playClick();
    setPayCardId(cardId);
    setPayAmount(amount);
    if (accounts.length > 0) {
      setPaySourceAccountId(accounts[0].id);
    }
    setIsPayModalOpen(true);
  };

  const handleConfirmPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCardId || payAmount <= 0 || !paySourceAccountId) return;
    payCreditCardInvoice(payCardId, payAmount, paySourceAccountId);
    setIsPayModalOpen(false);
  };

  const handleOpenCardModal = (card?: CreditCard) => {
    soundFX.playClick();
    if (card) {
      setEditingCard(card);
      setCardName(card.name);
      setCardLimit(card.limit_amount.toString());
      setCardClosingDay(card.closing_day.toString());
      setCardDueDay(card.due_day.toString());
      setCardColor(card.color);
    } else {
      setEditingCard(null);
      setCardName('');
      setCardLimit('5000');
      setCardClosingDay('15');
      setCardDueDay('25');
      setCardColor('#6366f1');
    }
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(cardLimit.replace(',', '.'));
    const closing = parseInt(cardClosingDay, 10);
    const due = parseInt(cardDueDay, 10);

    if (!cardName.trim() || isNaN(limit) || limit <= 0) {
      soundFX.playError();
      toast.error('Preencha os dados do cartão corretamente.');
      return;
    }

    if (editingCard) {
      updateCreditCard(editingCard.id, {
        name: cardName.trim(),
        limit_amount: limit,
        closing_day: closing,
        due_day: due,
        color: cardColor,
      });
    } else {
      addCreditCard({
        name: cardName.trim(),
        limit_amount: limit,
        closing_day: closing,
        due_day: due,
        color: cardColor,
      });
    }
    setIsCardModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cartões de Crédito & Faturas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhe limites comprometidos, fechamentos e pague faturas diretamente por débito em conta.
          </p>
        </div>

        <button
          onClick={() => handleOpenCardModal()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Novo Cartão</span>
        </button>
      </div>

      {/* Credit Cards Horizontal Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {creditCards.map((card) => {
          const cardSummary = getCardInvoiceSummary(card.id);
          const isSelected = card.id === (activeCard?.id || '');
          const usedPct = Math.min(100, (cardSummary.totalUsedLimit / card.limit_amount) * 100);

          return (
            <div
              key={card.id}
              onClick={() => {
                soundFX.playClick();
                setSelectedCardId(card.id);
              }}
              className={`cursor-pointer rounded-2xl p-5 transition-all relative overflow-hidden flex flex-col justify-between h-48 shadow-md border ${
                isSelected
                  ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950 border-slate-700'
                  : 'border-slate-800 opacity-85 hover:opacity-100 hover:border-slate-700'
              }`}
              style={{
                background: `linear-gradient(135deg, ${card.color}dd 0%, #090d16 100%)`,
              }}
            >
              {/* Card Header: Chip & Bank Name */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  {/* EMV Chip Representation */}
                  <div className="h-6 w-8 rounded-xs bg-amber-200/80 border border-amber-300/60 flex items-center justify-center">
                    <div className="h-3 w-5 border border-amber-500/50 rounded-xs" />
                  </div>
                  <ShieldCheck className="h-4 w-4 text-white/60" />
                </div>
                <span className="text-xs font-semibold tracking-wide uppercase text-white/90">
                  {card.name}
                </span>
              </div>

              {/* Card Center: Masked Numbers */}
              <div className="my-2">
                <span className="font-mono text-sm tracking-widest text-white/80">
                  •••• •••• •••• {card.closing_day.toString().padStart(2, '0')}{card.due_day.toString().padStart(2, '0')}
                </span>
              </div>

              {/* Card Footer: Limits & Gauge */}
              <div className="space-y-1.5 text-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70">Fatura Aberta:</span>
                  <span className="font-mono font-bold">{formatCurrency(cardSummary.openAmount)}</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      usedPct > 85 ? 'bg-rose-400' : usedPct > 65 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-white/70">
                  <span>Disp: {formatCurrency(cardSummary.availableLimit)}</span>
                  <span>Limite: {formatCurrency(card.limit_amount)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Card Deep Dive Section */}
      {activeCard && summary && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800/80 dark:bg-slate-900/90 overflow-hidden">
          {/* Card Management Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeCard.name}
                </h2>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Fecha todo dia {activeCard.closing_day} · Vence dia {activeCard.due_day}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenCardModal(activeCard)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                <Edit2 className="h-3 w-3" />
                <span>Editar Cartão</span>
              </button>
              {creditCards.length > 1 && (
                <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Excluir</span>
                </button>
              )}
            </div>
          </div>

          {/* Invoices 3-Box Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/80 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
            {/* 1. Fatura Aberta */}
            <div
              onClick={() => {
                soundFX.playClick();
                setActiveInvoiceTab('open');
              }}
              className={`p-5 cursor-pointer transition ${
                activeInvoiceTab === 'open'
                  ? 'bg-white dark:bg-slate-900 border-b-2 border-indigo-500'
                  : 'hover:bg-slate-100/50 dark:hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Clock className="h-3.5 w-3.5" />
                  Fatura Aberta
                </span>
                <span>Vence dia {activeCard.due_day}</span>
              </div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(summary.openAmount)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {summary.openTransactions.length} lançamentos neste ciclo
              </p>
            </div>

            {/* 2. Fatura Fechada (Pronta para Pagar) */}
            <div
              onClick={() => {
                soundFX.playClick();
                setActiveInvoiceTab('closed');
              }}
              className={`p-5 cursor-pointer transition ${
                activeInvoiceTab === 'closed'
                  ? 'bg-white dark:bg-slate-900 border-b-2 border-indigo-500'
                  : 'hover:bg-slate-100/50 dark:hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Fatura Fechada
                </span>
                {summary.closedAmount > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPayModal(activeCard.id, summary.closedAmount);
                    }}
                    className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500 transition shadow-2xs"
                  >
                    Pagar Fatura
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-500 font-medium">Liquidada</span>
                )}
              </div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(summary.closedAmount)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {summary.closedAmount > 0
                  ? 'Aguardando pagamento'
                  : 'Nenhuma pendência fechada'}
              </p>
            </div>

            {/* 3. Faturas Futuras (Parcelamentos) */}
            <div
              onClick={() => {
                soundFX.playClick();
                setActiveInvoiceTab('future');
              }}
              className={`p-5 cursor-pointer transition ${
                activeInvoiceTab === 'future'
                  ? 'bg-white dark:bg-slate-900 border-b-2 border-indigo-500'
                  : 'hover:bg-slate-100/50 dark:hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-semibold flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Calendar className="h-3.5 w-3.5" />
                  Faturas Futuras
                </span>
                <span>Parcelamentos programados</span>
              </div>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(summary.futureAmount)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Comprometimento nos próximos meses
              </p>
            </div>
          </div>

          {/* Invoice Transactions Detail List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {activeInvoiceTab === 'open'
                  ? 'Lançamentos da Fatura Aberta'
                  : activeInvoiceTab === 'closed'
                  ? 'Lançamentos da Fatura Fechada'
                  : 'Parcelamentos em Aberto'}
              </h3>
              {activeInvoiceTab === 'closed' && summary.closedAmount > 0 && (
                <button
                  onClick={() => handleOpenPayModal(activeCard.id, summary.closedAmount)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500 transition cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Pagar Fatura de {formatCurrency(summary.closedAmount)}</span>
                </button>
              )}
            </div>

            {/* List */}
            {activeInvoiceTab === 'open' && (
              summary.openTransactions.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.openTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white">
                          {tx.description}
                        </p>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(tx.date)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Nenhum lançamento registrado nesta fatura até o momento.
                </p>
              )
            )}

            {activeInvoiceTab === 'closed' && (
              summary.closedTransactions.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.closedTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white">
                          {tx.description}
                        </p>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(tx.date)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Todas as faturas fechadas anteriores já foram pagas!
                  </p>
                </div>
              )
            )}

            {activeInvoiceTab === 'future' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs">
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  Total programado de compras parceladas para faturas subsequentes:{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {formatCurrency(summary.futureAmount)}
                  </strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  As parcelas serão cobradas automaticamente na virada de cada ciclo no dia {activeCard.closing_day}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pagar Fatura de Cartão
              </h3>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPay} className="mt-4 space-y-4">
              <div className="rounded-xl bg-indigo-50/50 p-4 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40">
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Valor Total da Fatura:
                </span>
                <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(payAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Conta de Débito (Origem dos Fundos)
                </label>
                <select
                  value={paySourceAccountId}
                  onChange={(e) => setPaySourceAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatCurrency(acc.current_balance)}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ao confirmar, o valor de {formatCurrency(payAmount)} será debitado instantaneamente da conta escolhida e o limite do cartão será liberado.
              </p>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Card Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingCard ? 'Editar Cartão' : 'Novo Cartão de Crédito'}
              </h3>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Nome do Cartão
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nubank Ultravioleta, C6 Carbon..."
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Limite Total (R$)
                </label>
                <input
                  type="text"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Dia Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cardClosingDay}
                    onChange={(e) => setCardClosingDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Dia Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cardDueDay}
                    onChange={(e) => setCardDueDay(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Cor de Destaque
                </label>
                <div className="flex gap-2">
                  {['#7C3AED', '#0F172A', '#EA580C', '#2563EB', '#059669', '#E11D48'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCardColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        cardColor === c ? 'border-white ring-2 ring-indigo-500' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs"
                >
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Card Deletion */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Excluir Cartão de Crédito?"
        description={
          activeCard
            ? `Tem certeza que deseja remover o cartão "${activeCard.name}"? As transações associadas a ele continuarão no extrato histórico.`
            : ''
        }
        confirmLabel="Sim, excluir cartão"
        variant="danger"
        iconType="trash"
        onConfirm={() => {
          if (activeCard) {
            deleteCreditCard(activeCard.id);
            setIsDeleteConfirmOpen(false);
            toast.success(`Cartão "${activeCard.name}" removido.`);
          }
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
};
