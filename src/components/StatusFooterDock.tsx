import React from 'react';
import { Cpu, ShieldCheck, FolderOpen, Sliders, Terminal } from 'lucide-react';
import { Instance, Account } from '../types';
import { InstanceIcon } from './InstanceIcon';

interface StatusFooterDockProps {
  activeInstance: Instance | null;
  activeAccount: Account | null;
  instancesCount: number;
  onOpenInstanceSettings: (inst: Instance) => void;
  onOpenInstanceFolder: (id: string) => void;
  onOpenAccounts: () => void;
  onOpenLogs?: () => void;
}

export const StatusFooterDock: React.FC<StatusFooterDockProps> = ({
  activeInstance,
  activeAccount,
  instancesCount,
  onOpenInstanceSettings,
  onOpenInstanceFolder,
  onOpenAccounts,
  onOpenLogs,
}) => {
  return (
    <footer className="relative z-30 w-full px-6 py-2 bg-[var(--glass-surface-strong)] border-t glass-divider flex items-center justify-between text-xs font-mono text-ghost-400 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-spectral-mint animate-pulse" />
          <span className="text-ghost-200 font-medium text-[11px]">DISCORD RPC ACTIVO</span>
        </div>

        <span className="opacity-30">•</span>

        <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
          <Cpu className="w-3.5 h-3.5 text-ghost-300" />
          <span>RAM:</span>
          <span className="text-ghost-100 font-semibold">
            {activeInstance ? `${((activeInstance.memory_max_mb || 4096) / 1024).toFixed(1)} GB` : '4.0 GB'}
          </span>
        </div>

        <span className="opacity-30 hidden md:inline">•</span>

        <div className="hidden md:flex items-center gap-1.5 text-[11px] tabular-nums">
          <ShieldCheck className="w-3.5 h-3.5 text-ghost-300" />
          <span>PERFILES:</span>
          <span className="text-ghost-100 font-semibold">{instancesCount}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {activeAccount && (
          <button
            onClick={onOpenAccounts}
            className="hover:text-ghost-100 transition-colors text-[11px] truncate max-w-[120px]"
          >
            @{activeAccount.username}
          </button>
        )}

        {activeInstance && (
          <div className="flex items-center gap-2.5 border-l glass-divider pl-3">
            <div className="w-4 h-4 rounded overflow-hidden shrink-0">
              <InstanceIcon icon={activeInstance.icon} />
            </div>
            <span className="text-ghost-200 font-medium text-[11px] truncate max-w-[140px]">
              {activeInstance.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded glass-control text-ghost-300 uppercase tabular-nums">
              {activeInstance.loader} {activeInstance.mc_version}
            </span>

            <div className="flex items-center gap-1">
              {onOpenLogs && (
                <button
                  onClick={onOpenLogs}
                  className="btn-tactile p-1 rounded hover:bg-white/10 text-ghost-400 hover:text-ghost-100"
                  title="Ver consola de salida"
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onOpenInstanceFolder(activeInstance.id)}
                className="btn-tactile p-1 rounded hover:bg-white/10 text-ghost-400 hover:text-ghost-100"
                title="Abrir directorio de la estancia"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onOpenInstanceSettings(activeInstance)}
                className="btn-tactile p-1 rounded hover:bg-white/10 text-ghost-400 hover:text-ghost-100"
                title="Ajustes de la estancia"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};
