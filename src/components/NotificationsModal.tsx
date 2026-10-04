import React from 'react';
import {
  Bell,
  BellRing,
  CreditCard as CardIcon,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldAlert,
  Send,
  Sparkles,
  Info,
  Clock,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { soundFX } from '../utils/audio';

export const NotificationsModal: React.FC = () => {
  const {
    isNotificationsModalOpen,
    setIsNotificationsModalOpen,
    financialAlerts,
    unreadAlertsCount,
    dismissAlert,
    markAllAlertsAsRead,
    notificationPermission,
    requestBrowserNotificationPermission,
    triggerTestNotification,
    triggerAlertPushNotifications,
    setActiveTab,
  } = useFinance();

  if (!isNotificationsModalOpen) return null;

  const handleClose = () => {
    soundFX.playClick();
    setIsNotificationsModalOpen(false);
  };

  const handleNavigate = (tab: any) => {
    soundFX.playClick();
    setActiveTab(tab);
    setIsNotificationsModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Central de Notificações & Alertas
                </h2>
                {unreadAlertsCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                    {unreadAlertsCount} novos
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitoramento proativo de faturas de cartão de crédito e tetos orçamentários
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Web Push Notification Status Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Web Notifications API
                  </span>
                  {notificationPermission === 'granted' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Ativadas no Navegador
                    </span>
                  ) : notificationPermission === 'denied' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                      <AlertTriangle className="h-3 w-3" />
                      Bloqueadas no Navegador
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      Aguardando Permissão
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {notificationPermission === 'granted'
                    ? 'O Aura Finance tem permissão para emitir avisos push nativos sobre vencimentos de cartões e estouros de orçamentos.'
                    : notificationPermission === 'denied'
                    ? 'As notificações foram bloqueadas nas configurações do navegador. Desbloqueie no ícone de cadeado da barra de endereço para receber alertas do sistema.'
                    : 'Autorize as notificações do navegador para ser alertado em tempo real sobre faturas que vencem hoje/em breve e categorias no limite.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {notificationPermission === 'granted' ? (
                  <>
                    <button
                      onClick={triggerTestNotification}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Disparar notificação de teste para verificar funcionamento"
                    >
                      <Send className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Testar Push</span>
                    </button>

                    <button
                      onClick={triggerAlertPushNotifications}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
                      title="Checar e enviar notificações de faturas e orçamentos"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>Verificar Alertas</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={requestBrowserNotificationPermission}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    <span>Permitir Notificações Web</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Financial Alerts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Alertas Financeiros Ativos</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {financialAlerts.length}
                </span>
              </h3>

              {financialAlerts.length > 0 && (
                <button
                  onClick={markAllAlertsAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-medium"
                >
                  Marcar todos como lidos
                </button>
              )}
            </div>

            {financialAlerts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tudo sob controle!
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Nenhuma fatura de cartão próxima ao vencimento e nenhum orçamento estourado neste mês.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {financialAlerts.map((alert) => {
                  const isCardDue = alert.type === 'card_due';
                  const isDanger = alert.severity === 'danger';

                  return (
                    <div
                      key={alert.id}
                      className={`rounded-xl border p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDanger
                          ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20'
                          : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 mt-0.5 ${
                            isDanger
                              ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                              : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                          }`}
                        >
                          {isCardDue ? (
                            <CardIcon className="h-5 w-5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {alert.title}
                            </h4>
                            {!alert.read && (
                              <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {alert.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {alert.linkTab && (
                          <button
                            onClick={() => handleNavigate(alert.linkTab)}
                            className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            <span>{alert.linkTab === 'cards' ? 'Ver Fatura' : 'Ver Orçamentos'}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </button>
                        )}

                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition cursor-pointer"
                          title="Dispensar alerta"
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
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-indigo-500" />
            <span>Notificações executadas localmente via Web Notifications API</span>
          </span>

          <button
            onClick={handleClose}
            className="rounded-lg bg-slate-200 px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
