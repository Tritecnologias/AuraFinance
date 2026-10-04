import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
  Layers,
  Tag,
  Wallet,
  CreditCard as CardIcon,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinance } from '../context/FinanceContext';
import { TransactionStatus, TransactionType } from '../types/finance';
import { formatCurrency, formatDate } from '../utils/formatters';
import { soundFX } from '../utils/audio';
import { requestCategorySuggestion, CategorySuggestionResponse } from '../utils/aiCategorizer';

export const QuickAddModal: React.FC = () => {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    accounts,
    creditCards,
    categories,
    addTransaction,
  } = useFinance();

  // AI Free Text State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [showAiBox, setShowAiBox] = useState(true);

  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<TransactionStatus>('completed');
  
  // Payment destination/source
  const [paymentMode, setPaymentMode] = useState<'account' | 'card'>('account');
  const [accountId, setAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');

  // Installments
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [isRecurring, setIsRecurring] = useState(false);

  // Smart Categorization with Gemini State
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestionResponse | null>(null);
  const [lastCategorizedDesc, setLastCategorizedDesc] = useState('');
  const [isAutoCategoryEnabled, setIsAutoCategoryEnabled] = useState(true);

  // Trigger smart category inference via Gemini
  const handleSmartCategorization = async (descToCategorize?: string, showNotification = true) => {
    const targetDesc = (descToCategorize !== undefined ? descToCategorize : description).trim();
    if (!targetDesc || targetDesc.length < 2) return;
    if (targetDesc.toLowerCase() === lastCategorizedDesc.toLowerCase() && !showNotification) return;

    try {
      setIsSuggestingCategory(true);
      const result = await requestCategorySuggestion(targetDesc, categories, txType);
      setLastCategorizedDesc(targetDesc);
      setCategorySuggestion(result);

      // Auto select category if found in categories list
      const matched = categories.find((c) => c.id === result.category_id);
      if (matched) {
        setCategoryId(matched.id);
        // If the LLM indicates a different transaction type and user hasn't typed transfer
        if (result.suggested_type && result.suggested_type !== txType && txType !== 'transfer') {
          setTxType(result.suggested_type);
        }
        if (showNotification) {
          soundFX.playSuccess();
          toast.success(`Categoria sugerida: ${result.category_name}`, {
            description: `${result.confidence_percent}% de certeza · ${result.reasoning}`,
          });
        }
      }
    } catch (e) {
      console.error('Categorização inteligente falhou:', e);
      if (showNotification) {
        toast.error('Não foi possível obter sugestão da IA para esta descrição.');
      }
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  // Debounced auto-categorization when description changes
  useEffect(() => {
    if (!isAutoCategoryEnabled) return;
    const trimmed = description.trim();
    if (trimmed.length < 3) {
      setCategorySuggestion(null);
      return;
    }

    const timer = setTimeout(() => {
      handleSmartCategorization(trimmed, false);
    }, 650);

    return () => clearTimeout(timer);
  }, [description, isAutoCategoryEnabled]);

  // Initialize sensible defaults when modal opens
  useEffect(() => {
    if (isQuickAddOpen) {
      if (accounts.length > 0 && !accountId) setAccountId(accounts[0].id);
      if (accounts.length > 1 && !destinationAccountId) setDestinationAccountId(accounts[1].id);
      if (creditCards.length > 0 && !creditCardId) setCreditCardId(creditCards[0].id);
      
      const filteredCats = categories.filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'));
      if (filteredCats.length > 0 && !categoryId) setCategoryId(filteredCats[0].id);
    }
  }, [isQuickAddOpen, txType, accounts, creditCards, categories, accountId, destinationAccountId, creditCardId, categoryId]);

  // AI Parser Caller
  const handleParseWithAi = async (textToParse?: string) => {
    const query = (textToParse || aiPrompt).trim();
    if (!query) {
      toast.error('Digite ou selecione uma descrição em texto livre para a IA analisar.');
      return;
    }

    soundFX.playClick();
    setIsAiLoading(true);
    setAiExplanation(null);

    try {
      const response = await fetch('/api/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: query,
          categories,
          accounts,
          creditCards,
          currentDate: new Date().toISOString().slice(0, 10),
        }),
      });

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Não foi possível processar a transação.');
      }

      const data = result.data;

      // Populate extracted fields
      if (data.amount !== undefined && data.amount !== null) {
        setAmountStr(data.amount.toString().replace('.', ','));
      }
      if (data.description) {
        setDescription(data.description);
      }
      if (data.date) {
        setDate(data.date);
      }

      // Type
      const parsedType: TransactionType =
        data.type === 'income' || data.type === 'transfer' ? data.type : 'expense';
      setTxType(parsedType);

      // Category matching
      if (data.category_id && categories.some((c) => c.id === data.category_id)) {
        setCategoryId(data.category_id);
      } else if (data.category_name) {
        const found = categories.find(
          (c) =>
            c.name.toLowerCase().includes(data.category_name.toLowerCase()) &&
            c.type === (parsedType === 'income' ? 'income' : 'expense')
        );
        if (found) setCategoryId(found.id);
      }

      // Payment method
      if (parsedType === 'transfer') {
        setPaymentMode('account');
        if (data.account_id && accounts.some((a) => a.id === data.account_id)) {
          setAccountId(data.account_id);
        }
        if (data.destination_account_id && accounts.some((a) => a.id === data.destination_account_id)) {
          setDestinationAccountId(data.destination_account_id);
        }
      } else if (data.payment_method === 'card' || data.credit_card_id) {
        setPaymentMode('card');
        if (data.credit_card_id && creditCards.some((c) => c.id === data.credit_card_id)) {
          setCreditCardId(data.credit_card_id);
        } else if (creditCards.length > 0) {
          setCreditCardId(creditCards[0].id);
        }
      } else {
        setPaymentMode('account');
        if (data.account_id && accounts.some((a) => a.id === data.account_id)) {
          setAccountId(data.account_id);
        }
      }

      // Installments
      if (data.installments && data.installments > 1) {
        setIsInstallment(true);
        setInstallmentsCount(data.installments);
        setPaymentMode('card');
      } else {
        setIsInstallment(false);
      }

      setAiExplanation(data.explanation || 'Transação extraída e preenchida automaticamente.');
      soundFX.playSuccess();
      toast.success('Campos identificados pela IA!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Falha ao processar texto com IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Update categories when type changes
  const handleTypeChange = (newType: TransactionType) => {
    soundFX.playClick();
    setTxType(newType);
    const filteredCats = categories.filter((c) => c.type === (newType === 'income' ? 'income' : 'expense'));
    if (filteredCats.length > 0) {
      setCategoryId(filteredCats[0].id);
    }
    if (newType === 'income' || newType === 'transfer') {
      setPaymentMode('account');
      setIsInstallment(false);
    }
  };

  const parsedAmount = useMemo(() => {
    const clean = amountStr.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.max(0, val);
  }, [amountStr]);

  // Installment breakdown preview
  const installmentPreviews = useMemo(() => {
    if (!isInstallment || installmentsCount <= 1 || parsedAmount <= 0 || !date) {
      return [];
    }
    const [yearStr, monthStr, dayStr] = date.split('-');
    let baseYear = parseInt(yearStr, 10);
    let baseMonth = parseInt(monthStr, 10);
    const baseDay = parseInt(dayStr, 10);

    const baseVal = Number((parsedAmount / installmentsCount).toFixed(2));
    const items = [];

    for (let i = 1; i <= installmentsCount; i++) {
      let curMonth = baseMonth + (i - 1);
      let curYear = baseYear;
      while (curMonth > 12) {
        curMonth -= 12;
        curYear += 1;
      }
      const maxDays = new Date(curYear, curMonth, 0).getDate();
      const targetDay = Math.min(baseDay, maxDays);
      const targetDate = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      const itemAmount =
        i === installmentsCount
          ? Number((parsedAmount - baseVal * (installmentsCount - 1)).toFixed(2))
          : baseVal;

      items.push({
        num: i,
        date: targetDate,
        amount: itemAmount,
      });
    }
    return items;
  }, [isInstallment, installmentsCount, parsedAmount, date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      soundFX.playError();
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!description.trim()) {
      soundFX.playError();
      toast.error('Informe uma descrição para a transação.');
      return;
    }

    if (txType === 'expense') {
      addTransaction({
        description: description.trim(),
        amount: parsedAmount,
        type: 'expense',
        category_id: categoryId || categories.find((c) => c.type === 'expense')?.id || 'cat_exp_01',
        date,
        status,
        account_id: paymentMode === 'account' ? accountId : null,
        credit_card_id: paymentMode === 'card' ? creditCardId : null,
        installments: isInstallment ? installmentsCount : 1,
        is_recurring: isRecurring,
      });
    } else if (txType === 'income') {
      addTransaction({
        description: description.trim(),
        amount: parsedAmount,
        type: 'income',
        category_id: categoryId || categories.find((c) => c.type === 'income')?.id || 'cat_inc_01',
        date,
        status,
        account_id: accountId,
        credit_card_id: null,
        is_recurring: isRecurring,
      });
    } else if (txType === 'transfer') {
      if (accountId === destinationAccountId) {
        soundFX.playError();
        toast.error('A conta de origem e destino não podem ser as mesmas.');
        return;
      }
      addTransaction({
        description: description.trim() || 'Transferência entre contas',
        amount: parsedAmount,
        type: 'transfer',
        category_id: categories[0]?.id || 'cat_exp_01',
        date,
        status: 'completed',
        account_id: accountId,
        destination_account_id: destinationAccountId,
      });
    }

    // Reset and close
    setAmountStr('');
    setDescription('');
    setAiPrompt('');
    setAiExplanation(null);
    setIsInstallment(false);
    setIsQuickAddOpen(false);
  };

  if (!isQuickAddOpen) return null;

  const quickPromptExamples = [
    'Almoço restaurante R$ 85,50 no cartão Nubank',
    'Recebi 4.500 de salário no Itaú',
    'Gasolina posto Shell 180 reais',
    'Monitor Dell 1.200 em 4x no cartão XP',
    'Transferi 500 para reserva Sofisa',
  ];

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center items-end sm:p-4 p-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Handle */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Nova Transação</span>
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Sparkles className="h-3 w-3" />
                AI Gateway
              </span>
            </h2>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Atalho [N]
            </span>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              setIsQuickAddOpen(false);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* AI Free Text Smart Input Section */}
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Descrever em Texto Livre com IA
              </span>
              <button
                type="button"
                onClick={() => setShowAiBox(!showAiBox)}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showAiBox ? 'Recolher' : 'Expandir'}
              </button>
            </div>

            {showAiBox && (
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleParseWithAi();
                      }
                    }}
                    placeholder="Ex: Paguei 85,50 no almoço no cartão Nubank..."
                    disabled={isAiLoading}
                    className="w-full rounded-lg border border-indigo-200 bg-white py-2 pl-3 pr-24 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-indigo-900 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleParseWithAi()}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[11px] font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isAiLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>{isAiLoading ? 'Analisando...' : 'Identificar'}</span>
                  </button>
                </div>

                {/* Quick Examples Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Sugestões rápidas:</span>
                  {quickPromptExamples.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAiPrompt(ex);
                        handleParseWithAi(ex);
                      }}
                      className="rounded-md border border-indigo-200/60 bg-white/70 px-2 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 dark:border-indigo-900/60 dark:bg-slate-900/80 dark:text-indigo-300 dark:hover:bg-slate-800 transition truncate max-w-[220px]"
                      title={ex}
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                {/* AI Explanation feedback */}
                {aiExplanation && (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                    <span className="text-[11px] leading-relaxed">{aiExplanation}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Segmented Type Selector */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
                txType === 'expense'
                  ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Despesa</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
                txType === 'income'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Receita</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('transfer')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
                txType === 'transfer'
                  ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Transferir</span>
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Valor da Operação
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-lg font-mono font-semibold text-slate-400">
                R$
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-12 pr-4 text-2xl font-mono font-bold tracking-tight text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Descrição
              </label>
              {description.trim().length >= 2 && txType !== 'transfer' && (
                <button
                  type="button"
                  onClick={() => handleSmartCategorization(description, true)}
                  disabled={isSuggestingCategory}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                  title="Sugerir categoria automaticamente usando IA Gemini"
                >
                  <Sparkles className={`h-3 w-3 ${isSuggestingCategory ? 'animate-spin' : ''}`} />
                  <span>{isSuggestingCategory ? 'Analisando...' : 'Sugerir Categoria com IA'}</span>
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: Almoço Restaurante, Uber, Supermercado, Salário..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description.trim().length >= 3 && txType !== 'transfer') {
                    handleSmartCategorization(description, false);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              {isSuggestingCategory && (
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Category & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {txType !== 'transfer' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Categoria
                  </label>
                  {categorySuggestion && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>{categorySuggestion.confidence_percent}% certeza</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    {categories
                      .filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'))
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* AI Smart Categorization Feedback Card */}
                {categorySuggestion && (
                  <div className="mt-2 rounded-xl border border-indigo-200/80 bg-indigo-50/70 p-2.5 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/40 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-[11px]">Sugerido: {categorySuggestion.category_name}</span>
                      </div>
                      <span className="rounded bg-indigo-100 dark:bg-indigo-900/70 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                        GEMINI
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-indigo-700/90 dark:text-indigo-300/80 leading-relaxed">
                      {categorySuggestion.reasoning}
                    </p>
                    {categorySuggestion.alternatives && categorySuggestion.alternatives.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-indigo-500 dark:text-indigo-400">Alternativas:</span>
                        {categorySuggestion.alternatives.map((alt) => (
                          <button
                            key={alt.category_id}
                            type="button"
                            onClick={() => {
                              soundFX.playClick();
                              setCategoryId(alt.category_id);
                            }}
                            className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800 cursor-pointer transition"
                          >
                            {alt.category_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={txType === 'transfer' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Data
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Payment Method / Account Selector */}
          {txType === 'expense' && (
            <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Meio de Pagamento
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setPaymentMode('account');
                    setIsInstallment(false);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition ${
                    paymentMode === 'account'
                      ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700 dark:border-indigo-500/80 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50/40 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  <span>Conta Corrente / Débito</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setPaymentMode('card');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition ${
                    paymentMode === 'card'
                      ? 'border-indigo-500 bg-indigo-50/30 text-indigo-700 dark:border-indigo-500/80 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50/40 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400'
                  }`}
                >
                  <CardIcon className="h-4 w-4" />
                  <span>Cartão de Crédito</span>
                </button>
              </div>

              {paymentMode === 'account' ? (
                <div>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Saldo: {formatCurrency(acc.current_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <select
                    value={creditCardId}
                    onChange={(e) => setCreditCardId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Limite: {formatCurrency(c.limit_amount)} · Fecha dia {c.closing_day})
                      </option>
                    ))}
                  </select>

                  {/* Installment Toggle */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInstallment}
                          onChange={(e) => {
                            soundFX.playClick();
                            setIsInstallment(e.target.checked);
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>Despesa Parcelada</span>
                      </label>

                      {isInstallment && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Parcelas:</span>
                          <select
                            value={installmentsCount}
                            onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10))}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                              <option key={n} value={n}>
                                {n}x
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Automatic Installment Calculation Preview */}
                    {isInstallment && installmentPreviews.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
                          <span>Cronograma das parcelas</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                            {installmentsCount}x de {formatCurrency(parsedAmount / installmentsCount)}
                          </span>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                          {installmentPreviews.map((p) => (
                            <div
                              key={p.num}
                              className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded"
                            >
                              <span>
                                {p.num}ª parcela · {formatDate(p.date)}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {formatCurrency(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Income Source Account */}
          {txType === 'income' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Conta de Destino
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Saldo: {formatCurrency(acc.current_balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Transfer Accounts */}
          {txType === 'transfer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Conta de Origem (Debitar)
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Conta de Destino (Creditar)
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.current_balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Status & Recurring (for non-transfers) */}
          {txType !== 'transfer' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setStatus('completed');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  Concluído (Efetivado)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setStatus('pending');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    status === 'pending'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  Pendente
                </button>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 h-3.5 w-3.5"
                />
                <span>Repetir mensalmente</span>
              </label>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                setIsQuickAddOpen(false);
              }}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition active:scale-98"
            >
              Confirmar Transação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
