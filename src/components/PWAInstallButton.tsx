import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { soundFX } from '../utils/audio';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    soundFX.playClick();
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  // If neither installable event nor iOS, show prompt that guides installation or triggers install
  if (!isInstallable && !isIOS) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Instale o Aura Finance no seu dispositivo
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acesse suas finanças instantaneamente pela tela de início com suporte offline.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Instalar Aplicativo</span>
          </button>
        </div>

        {/* iOS Safari Guide Modal */}
        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  // Header compact button
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition cursor-pointer"
        title="Instalar aplicativo na tela inicial (PWA)"
      >
        <Download className="h-3.5 w-3.5 stroke-[2.2]" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
      )}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Instalar no iPhone / iPad
            </h3>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
          <p>Siga estes passos simples no navegador Safari para fixar o app na tela inicial:</p>

          <div className="space-y-2.5 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                1
              </span>
              <div>
                Toque no botão de <strong>Compartilhar</strong> (ícone{' '}
                <Share className="inline h-3.5 w-3.5 text-indigo-500" />) na barra inferior do Safari.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                2
              </span>
              <div>
                Role as opções e toque em <strong>Adicionar à Tela de Início</strong> (ícone{' '}
                <PlusSquare className="inline h-3.5 w-3.5 text-indigo-500" />).
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                3
              </span>
              <div>
                Confirme tocando em <strong>Adicionar</strong> no canto superior direito.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
