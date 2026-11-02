import React from 'react';
import {
  Gamepad2,
  Compass,
  Package,
  Settings,
  Plus,
  X,
  Square,
  Terminal,
  Download,
} from 'lucide-react';
import { Instance, Account } from '../types';
import { GhosttyMascot, MascotMood } from './GhosttyMascot';
import { InstanceIcon } from './InstanceIcon';
import { useI18n } from '../utils/i18n';

export type MainTabId = 'instances' | 'discover' | 'mods' | 'settings';

export interface LiveActivityInfo {
  mode: 'idle' | 'downloading' | 'playing';
  title: string;
  subtitle?: string;
  progress?: number;
  elapsedSeconds?: number;
}

interface DynamicIslandHeaderProps {
  currentTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
  activeInstance: Instance | null;
  activeAccount: Account | null;
  onOpenAccounts: () => void;
  onOpenCreateInstance: () => void;
  isIslandExpanded: boolean;
  setIsIslandExpanded: (val: boolean) => void;
  liveActivity: LiveActivityInfo;
  onStopGame: () => void;
  onOpenLogs: () => void;
  mascotMood: MascotMood;
  onTriggerMascotReaction: () => void;
}

function formatElapsed(secs: number = 0): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import { PlayerHead, getAccountAvatarUrl } from './PlayerHead';
export { getAccountAvatarUrl };

export const DynamicIslandHeader: React.FC<DynamicIslandHeaderProps> = ({
  currentTab,
  onTabChange,
  activeInstance,
  activeAccount,
  onOpenAccounts,
  onOpenCreateInstance,
  isIslandExpanded,
  setIsIslandExpanded,
  liveActivity,
  onStopGame,
  onOpenLogs,
  mascotMood,
  onTriggerMascotReaction,
}) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'instances', label: t.nav_instances, icon: Gamepad2, shortcut: '1' },
    { id: 'discover', label: t.nav_discover, icon: Compass, shortcut: '2' },
    { id: 'mods', label: t.nav_content, icon: Package, shortcut: '3' },
    { id: 'settings', label: t.nav_settings, icon: Settings, shortcut: '4' },
  ] as const;

  const showClosePill = isIslandExpanded && currentTab !== 'instances';
  const showLiveActivity = liveActivity.mode !== 'idle';

  const handleTabClick = (tabId: MainTabId) => {
    if (tabId === 'instances') {
      onTabChange('instances');
      setIsIslandExpanded(false);
    } else if (currentTab === tabId && isIslandExpanded) {
      onTabChange('instances');
      setIsIslandExpanded(false);
    } else {
      onTabChange(tabId);
      setIsIslandExpanded(true);
    }
  };

  return (
    <header className="relative z-40 w-full h-[58px] pl-1.5 pr-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 shrink-0 mt-0.5">
        <GhosttyMascot
          mood={mascotMood}
          size="sm"
          onClick={onTriggerMascotReaction}
        />

        <div>
          <div className="flex items-center gap-2">
            <h1 className="heading-display font-extrabold text-lg tracking-wider text-ghost-50 leading-none">
              GHOSTTY <span className="accent-text">LAUNCHER</span>
            </h1>
          </div>
          <p className="text-[10px] text-ghost-400 font-mono tracking-wide mt-0.5">
            visionOS Glass • Modding Suite
          </p>
        </div>
      </div>

      <div className="dynamic-island-capsule rounded-full h-10 px-2 flex items-center relative shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id && (tab.id === 'instances' || isIslandExpanded);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`btn-tactile relative h-7 px-3.5 rounded-full text-xs font-medium flex items-center gap-2 ${
                  isActive
                    ? 'accent-bg text-white font-semibold'
                    : 'text-ghost-300 hover:text-ghost-50 hover:bg-[var(--glass-subtle)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            maxWidth: showLiveActivity ? '320px' : '0px',
            opacity: showLiveActivity ? 1 : 0,
            transform: showLiveActivity ? 'scale(1)' : 'scale(0.92)',
            transition:
              'max-width 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease, transform 180ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          className="overflow-hidden flex items-center shrink-0"
        >
          <div className="flex items-center gap-2.5 pl-2.5 pr-1.5 ml-1.5 border-l glass-divider whitespace-nowrap h-7">
            {liveActivity.mode === 'downloading' ? (
              <>
                <Download className="w-3.5 h-3.5 accent-text animate-bounce shrink-0" />
                <div className="w-[155px]">
                  <div className="flex items-center justify-between text-[10px] font-mono leading-tight">
                    <span className="text-ghost-100 truncate max-w-[112px]">
                      {liveActivity.title}
                    </span>
                    <span className="accent-text font-bold tabular-nums">
                      {liveActivity.progress ?? 0}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                    <div
                      style={{
                        width: `${Math.max(4, Math.min(100, liveActivity.progress ?? 0))}%`,
                        transition: 'width 180ms ease-out',
                      }}
                      className="h-full accent-bg rounded-full"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-5 h-5 rounded-md overflow-hidden shrink-0">
                  <InstanceIcon icon={activeInstance?.icon} />
                </div>
                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-spectral-mint animate-pulse shrink-0" />
                    <span className="text-[11px] font-semibold text-ghost-50 truncate max-w-[105px]">
                      {liveActivity.title}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-ghost-300 tabular-nums block">
                    En juego • {formatElapsed(liveActivity.elapsedSeconds)}
                  </span>
                </div>

                <div className="flex items-center gap-1 ml-1 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenLogs}
                    className="btn-tactile h-6 px-2 rounded-full glass-control text-[10px] font-mono flex items-center gap-1 text-ghost-200 hover:text-ghost-50"
                    title="Ver consola de logs en vivo"
                  >
                    <Terminal className="w-3 h-3" />
                    <span className="hidden lg:inline">Logs</span>
                  </button>
                  <button
                    type="button"
                    onClick={onStopGame}
                    className="btn-tactile h-6 px-2 rounded-full bg-spectral-rose/20 hover:bg-spectral-rose/30 border border-spectral-rose/40 text-spectral-rose text-[10px] font-mono font-semibold flex items-center gap-1"
                    title="Detener proceso de Minecraft"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Detener</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            width: showClosePill ? '32px' : '0px',
            opacity: showClosePill ? 1 : 0,
            transform: showClosePill ? 'scale(1)' : 'scale(0.8)',
            pointerEvents: showClosePill ? 'auto' : 'none',
            transition:
              'width 140ms cubic-bezier(0.2, 0, 0, 1), opacity 140ms ease, transform 140ms cubic-bezier(0.2, 0, 0, 1)',
          }}
          className="overflow-hidden flex items-center justify-center shrink-0 h-8"
        >
          <button
            type="button"
            tabIndex={showClosePill ? 0 : -1}
            onClick={() => {
              setIsIslandExpanded(false);
              onTabChange('instances');
            }}
            className="btn-tactile w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-ghost-300 hover:text-ghost-50 flex items-center justify-center shrink-0 border border-white/10"
            title="Cerrar panel flotante (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="dynamic-island-capsule rounded-l-full rounded-r-none pl-1 flex items-center h-10 shrink-0 overflow-hidden">
        <button
          type="button"
          onClick={onOpenCreateInstance}
          className="btn-tactile h-9 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-medium text-ghost-100 hover:bg-[var(--glass-hover)] shrink-0"
          title="Crear una nueva instancia de Minecraft"
        >
          <Plus className="w-3.5 h-3.5 accent-text shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">{t.nav_new_instance}</span>
        </button>

        <div className="w-[1px] h-5 bg-[var(--divider-color)] mx-1 shrink-0" />

        <button
          type="button"
          onClick={onOpenAccounts}
          className="btn-tactile relative h-full pl-3 pr-14 rounded-full flex items-center gap-2 text-xs font-medium text-ghost-100 hover:bg-[var(--glass-hover)] min-w-0"
          title="Perfiles de jugador y administración de Skin"
        >
          <span className="max-w-[150px] truncate whitespace-nowrap">
            {activeAccount ? activeAccount.username : 'Sin Cuenta'}
          </span>
          <div className="absolute right-0 top-0 h-full w-10 overflow-hidden bg-black/25 flex items-center justify-center shrink-0">
            <PlayerHead account={activeAccount} size={40} />
          </div>
        </button>
      </div>
    </header>
  );
};
