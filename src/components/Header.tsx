import { motion } from 'framer-motion';
import { User, Cpu, Wifi } from 'lucide-react';
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
    <header className="h-16 border-b border-ghost-800/80 bg-ghost-900/60 backdrop-blur-xl flex items-center justify-between px-6 select-none shrink-0 z-20">
      {/* Left indicator status */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-xs font-mono text-ghost-400 bg-ghost-850 px-3 py-1.5 rounded-lg border border-ghost-800">
          <div className="w-2 h-2 rounded-full bg-spectral-mint animate-pulse" />
          <span>ENGINE: TAURI RUST READY</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-ghost-400">
          <Cpu className="w-3.5 h-3.5 text-spectral-cyan" />
          <span>JAVA 21 VM</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-ghost-400">
          <Wifi className="w-3.5 h-3.5 text-spectral-mint" />
          <span>MODRINTH & MOJANG ONLINE</span>
        </div>
      </div>

      {/* Right controls: Account pill & Instant Launch button */}
      <div className="flex items-center gap-4">
        {/* Player Account Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenAccounts}
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-ghost-850/90 hover:bg-ghost-800 border border-ghost-700/60 transition-all text-xs group"
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-spectral-cyan to-spectral-mint flex items-center justify-center text-ghost-950 font-bold font-mono shadow-sm">
            {activeAccount ? activeAccount.username.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
          </div>
          <div className="text-left">
            <div className="font-semibold text-ghost-100 group-hover:text-spectral-cyan transition-colors">
              {activeAccount?.username || 'Sin Cuenta'}
            </div>
            <div className="text-[10px] text-ghost-400 font-mono">
              {activeAccount?.account_type || 'Invitado'}
            </div>
          </div>
        </motion.button>

        {/* Quick Launch CTA */}
        {activeInstance && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onLaunch}
            disabled={isLaunching}
            className="flex items-center gap-2.5 px-5 py-2 rounded-xl bg-gradient-to-r from-spectral-cyan to-spectral-mint text-ghost-950 font-bold text-xs uppercase tracking-wider shadow-lg glow-cyan hover:opacity-95 transition-all disabled:opacity-50"
          >
            {isLaunching ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-ghost-950 border-t-transparent rounded-full animate-spin" />
                <span>INICIANDO...</span>
              </>
            ) : (
              <>
                <span>JUGAR {activeInstance.name}</span>
              </>
            )}
          </motion.button>
        )}
      </div>
    </header>
  );
}
