import { motion } from 'framer-motion';
import { User, Play } from 'lucide-react';
import { Account, Instance } from '../types';

interface HeaderProps {
  activeAccount: Account | null;
  activeInstance: Instance | null;
  onOpenAccounts: () => void;
  onLaunch: () => void;
  isLaunching: boolean;
}

export function Header({
  activeAccount,
  activeInstance,
  onOpenAccounts,
  onLaunch,
  isLaunching,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-ghost-800/80 bg-ghost-900/60 backdrop-blur-md flex items-center justify-between px-6 select-none shrink-0 z-20">
      {/* Left instance quick breadcrumb */}
      <div className="flex items-center gap-3">
        {activeInstance ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ghost-200">{activeInstance.name}</span>
            <span className="text-[10px] font-mono text-ghost-400 bg-ghost-850 px-2 py-0.5 rounded border border-ghost-750">
              {activeInstance.loader} {activeInstance.mc_version}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ghost-500 font-mono">Sin estancia activa</span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Player Account Button */}
        <button
          onClick={onOpenAccounts}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ghost-850 hover:bg-ghost-800 border border-ghost-750 transition-colors text-xs group"
        >
          <div className="w-5 h-5 rounded-md bg-ghost-750 flex items-center justify-center text-ghost-200 font-bold font-mono text-[11px]">
            {activeAccount ? activeAccount.username.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
          </div>
          <span className="font-medium text-ghost-200 group-hover:text-ghost-100">
            {activeAccount?.username || 'Sin Cuenta'}
          </span>
        </button>

        {/* Quick Launch CTA */}
        {activeInstance && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLaunch}
            disabled={isLaunching}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-spectral-cyan hover:bg-spectral-cyan/90 text-ghost-950 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {isLaunching ? (
              <>
                <div className="w-3 h-3 border-2 border-ghost-950 border-t-transparent rounded-full animate-spin" />
                <span>Iniciando...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Jugar</span>
              </>
            )}
          </motion.button>
        )}
      </div>
    </header>
  );
}
