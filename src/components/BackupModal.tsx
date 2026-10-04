import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  HardDrive,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Upload,
  FileSpreadsheet,
  FileJson,
  X,
  Plus,
  RefreshCw,
  Sliders,
  Check,
  Info,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  BackupRecord,
  BackupFrequency,
  BackupFormat,
  getFrequencyLabel,
  downloadFile,
  getStorageEstimate,
  FinanceDataSnapshot,
} from '../utils/indexedDBBackup';
import { soundFX } from '../utils/audio';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'history' | 'schedule' | 'import_export';

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const {
    accounts,
    creditCards,
    categories,
    transactions,
    budgets,
    savingsGoals,
    profile,
    backupScheduleConfig,
    updateBackupScheduleConfig,
    createManualBackup,
    restoreFromBackupData,
    backupsList,
    refreshBackupsList,
    deleteBackup,
    clearAllBackups,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    usageFormatted: string;
    quotaFormatted: string;
    percentage: number;
  }>({
    usageFormatted: '0 B',
    quotaFormatted: 'N/D',
    percentage: 0,
  });

  // Modal confirmation states
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<BackupRecord | null>(null);
  const [pendingRestoreData, setPendingRestoreData] = useState<FinanceDataSnapshot | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load storage estimation and refresh list when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshBackupsList();
      getStorageEstimate().then((info) => {
        setStorageInfo({
          usageFormatted: info.usageFormatted,
          quotaFormatted: info.quotaFormatted,
          percentage: info.percentage,
        });
      });
    }
  }, [isOpen, refreshBackupsList]);

  if (!isOpen) return null;

  const handleCreateNow = async () => {
    try {
      setIsCreatingBackup(true);
      soundFX.playClick();
      const record = await createManualBackup();
      toast.success('Backup manual criado com sucesso!', {
        description: `Snapshot de ${record.sizeFormatted} salvo com segurança no IndexedDB.`,
      });
      // Refresh storage
      const info = await getStorageEstimate();
      setStorageInfo({
        usageFormatted: info.usageFormatted,
        quotaFormatted: info.quotaFormatted,
        percentage: info.percentage,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar backup.';
      toast.error('Erro ao gerar backup', { description: msg });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDownloadJson = (backup: BackupRecord) => {
    soundFX.playClick();
    const jsonStr = JSON.stringify(backup.jsonData, null, 2);
    const dateFormatted = new Date(backup.timestamp).toISOString().slice(0, 10);
    const filename = `aura_finance_backup_${dateFormatted}_${backup.type}.json`;
    downloadFile(jsonStr, filename, 'application/json');
    toast.success('Arquivo JSON baixado com sucesso!');
  };

  const handleDownloadCsv = (backup: BackupRecord, type: 'transactions' | 'accounts' | 'cards') => {
    soundFX.playClick();
    const dateFormatted = new Date(backup.timestamp).toISOString().slice(0, 10);
    let content = '';
    let filename = '';

    if (type === 'transactions') {
      content = backup.csvData.transactionsCsv;
      filename = `aura_transacoes_${dateFormatted}.csv`;
    } else if (type === 'accounts') {
      content = backup.csvData.accountsCsv;
      filename = `aura_contas_${dateFormatted}.csv`;
    } else {
      content = backup.csvData.cardsCsv;
      filename = `aura_cartoes_${dateFormatted}.csv`;
    }

    downloadFile(content, filename, 'text/csv;charset=utf-8;');
    toast.success(`Planilha CSV (${type}) baixada com sucesso!`);
  };

  const handleConfirmRestore = () => {
    if (pendingRestoreBackup) {
      restoreFromBackupData(pendingRestoreBackup.jsonData);
      setPendingRestoreBackup(null);
      onClose();
    } else if (pendingRestoreData) {
      restoreFromBackupData(pendingRestoreData);
      setPendingRestoreData(null);
      onClose();
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation
        if (!parsed.transactions || !parsed.accounts || !parsed.creditCards) {
          throw new Error('Arquivo de backup inválido ou em formato incompatível.');
        }

        setPendingRestoreData(parsed);
      } catch (err: unknown) {
        soundFX.playError();
        const msg = err instanceof Error ? err.message : 'Arquivo corrompido';
        toast.error('Erro ao ler arquivo de backup', { description: msg });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        onClick={() => {
          soundFX.playClick();
          onClose();
        }}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
      />

      {/* Main Modal Dialog */}
      <div className="relative z-10 flex h-[90vh] max-h-[720px] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Backup no Navegador (IndexedDB)
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  Offline & Seguro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Snapshots periódicos em JSON e CSV armazenados diretamente no seu dispositivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNow}
              disabled={isCreatingBackup}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {isCreatingBackup ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              )}
              <span className="hidden sm:inline">Criar Backup Agora</span>
              <span className="sm:hidden">Novo</span>
            </button>
            <button
              onClick={() => {
                soundFX.playClick();
                onClose();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('history');
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Histórico de Snapshots</span>
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-mono dark:bg-slate-800">
              {backupsList.length}
            </span>
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('schedule');
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'schedule'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Agendamento Automático</span>
            {backupScheduleConfig.enabled && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              setActiveTab('import_export');
            }}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'import_export'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importar & Exportar Arquivo</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Storage Quick Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Armazenamento Local IndexedDB
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Uso atual: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{storageInfo.usageFormatted}</span> · {backupsList.length} snapshot(s) preservado(s)
                    </p>
                  </div>
                </div>

                {backupsList.length > 0 && (
                  <button
                    onClick={() => setIsConfirmClearOpen(true)}
                    className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Limpar histórico</span>
                  </button>
                )}
              </div>

              {/* Backups List */}
              {backupsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center dark:border-slate-800">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                    Nenhum snapshot de backup salvo ainda
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Crie seu primeiro snapshot agora ou configure o agendamento automático para gravar cópias de segurança diárias no seu navegador.
                  </p>
                  <button
                    onClick={handleCreateNow}
                    disabled={isCreatingBackup}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Criar Snapshot Inicial</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {backupsList.map((b) => {
                    const dateObj = new Date(b.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={b.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                      >
                        {/* Info Column */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {formattedDate}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                b.type === 'scheduled'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                  : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                              }`}
                            >
                              {b.type === 'scheduled' ? `Agendado (${getFrequencyLabel(b.frequency)})` : 'Manual'}
                            </span>

                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {b.sizeFormatted}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{b.itemCounts.transactions} transações</span>
                            <span>·</span>
                            <span>{b.itemCounts.accounts} contas</span>
                            <span>·</span>
                            <span>{b.itemCounts.creditCards} cartões</span>
                            <span>·</span>
                            <span>{b.itemCounts.savingsGoals} metas</span>
                          </div>
                        </div>

                        {/* Action Buttons Column */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* JSON Download */}
                          <button
                            onClick={() => handleDownloadJson(b)}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                            title="Baixar snapshot JSON completo"
                          >
                            <FileJson className="h-3.5 w-3.5 text-amber-500" />
                            <span>JSON</span>
                          </button>

                          {/* CSV Download */}
                          <button
                            onClick={() => handleDownloadCsv(b, 'transactions')}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                            title="Baixar planilha CSV de transações"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                            <span>CSV</span>
                          </button>

                          {/* Restore */}
                          <button
                            onClick={() => {
                              soundFX.playClick();
                              setPendingRestoreBackup(b);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40 cursor-pointer"
                            title="Restaurar dados deste backup"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restaurar</span>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDeleteId(b.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 cursor-pointer"
                            title="Excluir do IndexedDB"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULE CONFIGURATION */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {/* Master Switch Card */}
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Exportação Automática Agendada para IndexedDB
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Quando ativado, o aplicativo realiza snapshots periódicos no banco de dados local do seu navegador em segundo plano, sem interrupções e com retenção configurável.
                    </p>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    updateBackupScheduleConfig({ enabled: !backupScheduleConfig.enabled });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    backupScheduleConfig.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={backupScheduleConfig.enabled}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      backupScheduleConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Frequency Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Frequência de Execução
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'daily', label: 'Diário (A cada 24 horas)', desc: 'Ideal para uso diário contínuo' },
                    { id: 'every_3_days', label: 'A cada 3 dias', desc: 'Equilíbrio entre histórico e espaço' },
                    { id: 'weekly', label: 'Semanal (A cada 7 dias)', desc: 'Recomendado para uso moderado' },
                    { id: 'every_session', label: 'A cada nova sessão', desc: 'Ao inicializar o app se decorrido > 1h' },
                  ].map((freq) => {
                    const isSelected = backupScheduleConfig.frequency === freq.id;
                    return (
                      <button
                        key={freq.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          updateBackupScheduleConfig({ frequency: freq.id as BackupFrequency });
                        }}
                        className={`flex items-start justify-between rounded-xl border p-3 text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <p className={`text-xs font-bold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                            {freq.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {freq.desc}
                          </p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Retention Policy */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Política de Retenção (Máximo de Snapshots Preservados)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Quando o limite for atingido, os snapshots mais antigos serão reciclados automaticamente para manter o armazenamento enxuto.
                </p>
                <div className="flex items-center gap-2">
                  {[10, 20, 30, 50].map((count) => {
                    const isSelected = backupScheduleConfig.maxRetentionBackups === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          updateBackupScheduleConfig({ maxRetentionBackups: count });
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {count} backups
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notification & Options */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Notificar ao concluir backup agendado
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Exibe um aviso discreto (toast) quando o snapshot de segundo plano for gravado.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      updateBackupScheduleConfig({ notifyOnBackup: !backupScheduleConfig.notifyOnBackup });
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      backupScheduleConfig.notifyOnBackup ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        backupScheduleConfig.notifyOnBackup ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Security Details Card */}
              <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 dark:border-indigo-950/40 dark:bg-indigo-950/20">
                <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">
                  <strong>Privacidade Absoluta:</strong> Os dados armazenados no IndexedDB residem exclusivamente no seu computador/celular. Nenhuma informação financeira é transmitida para servidores de terceiros sem seu consentimento expresso.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: IMPORT & EXPORT */}
          {activeTab === 'import_export' && (
            <div className="space-y-6">
              {/* Quick Export Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Exportação Direta para o Computador
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Export Full JSON */}
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                        <FileJson className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Arquivo JSON Completo
                        </h4>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Exporta perfil, contas, cartões, faturas, orçamentos, metas e transações.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        soundFX.playClick();
                        const fullSnapshot: FinanceDataSnapshot = {
                          version: '2.0',
                          app: 'Aura Finance',
                          exportedAt: new Date().toISOString(),
                          profile,
                          accounts,
                          creditCards,
                          categories,
                          transactions,
                          budgets,
                          savingsGoals,
                        };
                        const dateFormatted = new Date().toISOString().slice(0, 10);
                        downloadFile(
                          JSON.stringify(fullSnapshot, null, 2),
                          `aura_finance_backup_completo_${dateFormatted}.json`,
                          'application/json'
                        );
                        toast.success('Arquivo JSON baixado!');
                      }}
                      className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar JSON Agora</span>
                    </button>
                  </div>

                  {/* Export CSV Spreadsheets */}
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Extrato de Transações (CSV)
                        </h4>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          Compatível com Excel, Google Planilhas e LibreOffice (padrão Brasil ;).
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        soundFX.playClick();
                        const dummyRecord = {
                          csvData: {
                            transactionsCsv: '',
                            accountsCsv: '',
                            cardsCsv: '',
                          },
                          jsonData: {
                            transactions,
                            categories,
                            accounts,
                            creditCards,
                          },
                        };
                        // We can use the existing exportTransactionsToCSV or generate
                        handleDownloadCsv(
                          {
                            id: 'temp',
                            timestamp: Date.now(),
                            createdAt: new Date().toISOString(),
                            type: 'manual',
                            frequency: 'manual',
                            itemCounts: {
                              transactions: transactions.length,
                              accounts: accounts.length,
                              creditCards: creditCards.length,
                              budgets: budgets.length,
                              savingsGoals: savingsGoals.length,
                              categories: categories.length,
                            },
                            sizeBytes: 0,
                            sizeFormatted: '0 B',
                            jsonData: fullSnapshotFromCurrent(),
                            csvData: {
                              transactionsCsv: dummyRecord.csvData.transactionsCsv,
                              accountsCsv: dummyRecord.csvData.accountsCsv,
                              cardsCsv: dummyRecord.csvData.cardsCsv,
                            },
                          } as BackupRecord,
                          'transactions'
                        );
                      }}
                      className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Baixar Planilha CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Import External Backup */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Importar e Restaurar Backup
                </h3>
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Upload className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    Carregar arquivo .json de backup
                  </h4>
                  <p className="mt-1 max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
                    Selecione um arquivo de backup previamente gerado pelo Aura Finance para restaurar instantaneamente suas contas e transações.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Selecionar Arquivo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Motor IndexedDB v1 Ativo no Navegador</span>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Single Backup Deletion */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir snapshot de backup?"
        description="Esta ação removerá este snapshot do IndexedDB do seu navegador. Essa exclusão é permanente."
        confirmLabel="Sim, excluir snapshot"
        variant="danger"
        iconType="trash"
        onConfirm={async () => {
          if (confirmDeleteId) {
            await deleteBackup(confirmDeleteId);
            setConfirmDeleteId(null);
            toast.success('Snapshot excluído do IndexedDB.');
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Confirmation Modal for Clearing All Backups */}
      <ConfirmModal
        isOpen={isConfirmClearOpen}
        title="Limpar todos os snapshots salvos?"
        description="Todos os backups armazenados no IndexedDB serão removidos permanentemente. Seus dados atuais continuarão intactos."
        confirmLabel="Limpar todo o histórico"
        variant="danger"
        iconType="trash"
        onConfirm={async () => {
          await clearAllBackups();
          setIsConfirmClearOpen(false);
          toast.success('Todos os backups foram removidos do IndexedDB.');
        }}
        onCancel={() => setIsConfirmClearOpen(false)}
      />

      {/* Confirmation Modal for Restoring Backup */}
      <ConfirmModal
        isOpen={!!pendingRestoreBackup || !!pendingRestoreData}
        title="Restaurar dados do snapshot?"
        description="Seus dados atuais serão substituídos pelos registros deste backup. Recomendamos criar um backup prévio antes de prosseguir."
        confirmLabel="Sim, restaurar dados"
        variant="warning"
        iconType="reset"
        onConfirm={handleConfirmRestore}
        onCancel={() => {
          setPendingRestoreBackup(null);
          setPendingRestoreData(null);
        }}
      />
    </div>
  );

  function fullSnapshotFromCurrent(): FinanceDataSnapshot {
    return {
      version: '2.0',
      app: 'Aura Finance',
      exportedAt: new Date().toISOString(),
      profile,
      accounts,
      creditCards,
      categories,
      transactions,
      budgets,
      savingsGoals,
    };
  }
};
