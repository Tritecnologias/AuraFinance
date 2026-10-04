import React, { useState } from 'react';
import { Database, Copy, Check, X, Shield, Terminal } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { SUPABASE_SQL_SCRIPT } from '../utils/supabaseSql';
import { soundFX } from '../utils/audio';

export const SupabaseModal: React.FC = () => {
  const { isSqlModalOpen, setIsSqlModalOpen } = useFinance();
  const [copied, setCopied] = useState(false);

  if (!isSqlModalOpen) return null;

  const handleCopy = () => {
    soundFX.playClick();
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Schema Supabase & PostgreSQL (RLS Habilitado)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Script DDL com isolamento por usuário (auth.uid() = user_id)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copiado para Área de Transferência!' : 'Copiar Script SQL'}</span>
            </button>

            <button
              onClick={() => setIsSqlModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 dark:bg-slate-950/50 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Como conectar ao seu projeto Supabase:</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-slate-500 dark:text-slate-400">
              <li>Acesse o painel do seu projeto no Supabase (supabase.com).</li>
              <li>Navegue até <strong>SQL Editor</strong> no menu lateral.</li>
              <li>Cole o script abaixo e clique em <strong>Run</strong>.</li>
              <li>
                Todas as 6 tabelas (<code className="text-indigo-400 font-mono">profiles</code>, <code className="text-indigo-400 font-mono">accounts</code>, <code className="text-indigo-400 font-mono">credit_cards</code>, <code className="text-indigo-400 font-mono">categories</code>, <code className="text-indigo-400 font-mono">transactions</code>, <code className="text-indigo-400 font-mono">budgets</code>) serão criadas com integridade referencial, índices e políticas de Row Level Security (RLS) automáticas.
              </li>
            </ol>
          </div>

          <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-2 border-b border-slate-800/80 mb-2">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-3 w-3 text-emerald-400" />
                <span>supabase_schema_rls.sql</span>
              </div>
              <span>PostgreSQL 15+</span>
            </div>
            <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre leading-relaxed max-h-96">
              {SUPABASE_SQL_SCRIPT}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
