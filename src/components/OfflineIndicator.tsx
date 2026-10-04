import React from 'react';
import { WifiOff, CloudOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 border border-amber-500/40 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-xl shadow-slate-950/50 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Modo Offline — O cache do Service Worker está ativo com dados locais.</span>
    </div>
  );
};
