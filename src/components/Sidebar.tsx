import { motion } from 'framer-motion';
import { Layers, Compass, Package, Settings, Sparkles } from 'lucide-react';
import { Instance } from '../types';

export type TabId = 'instances' | 'discover' | 'mods' | 'settings';

interface SidebarProps {
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  activeInstance: Instance | null;
}

export function Sidebar({ currentTab, onTabChange, activeInstance }: SidebarProps) {
  const navItems = [
    { id: 'instances' as TabId, label: 'Estancias', icon: Layers, badge: null },
    { id: 'discover' as TabId, label: 'Descubrir Mods', icon: Compass, badge: 'Modrinth' },
    { id: 'mods' as TabId, label: 'Mods Activos', icon: Package, badge: null },
    { id: 'settings' as TabId, label: 'Ajustes & Java', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 border-r border-ghost-800/80 bg-ghost-900/80 backdrop-blur-2xl flex flex-col justify-between p-4 select-none shrink-0 z-30">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-ghost-800 to-ghost-850 border border-ghost-700/60 flex items-center justify-center shadow-lg">
            <img src="/ghostty.svg" alt="Ghostty" className="w-7 h-7 drop-shadow-md animate-float" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-spectral-mint border-2 border-ghost-900 shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-ghost-100">Ghostty</span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-spectral-cyan bg-spectral-cyan/10 px-1.5 py-0.5 rounded border border-spectral-cyan/20">
                CORE
              </span>
            </div>
            <p className="text-[11px] text-ghost-400 font-medium">Minecraft Java Launcher</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-ghost-100 font-semibold'
                    : 'text-ghost-400 hover:text-ghost-200 hover:bg-ghost-850/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-ghost-800/90 border border-ghost-700/80 rounded-xl shadow-md -z-10"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}

                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-spectral-cyan' : 'text-ghost-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[9px] font-mono uppercase bg-spectral-cyan/15 text-spectral-cyan px-1.5 py-0.5 rounded border border-spectral-cyan/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Instance Snapshot Card */}
      <div className="pt-4 border-t border-ghost-800/80">
        {activeInstance ? (
          <div className="p-3.5 rounded-2xl bg-ghost-850/90 border border-ghost-700/60 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-mono text-ghost-400">
                Estancia Seleccionada
              </span>
              <span className="w-2 h-2 rounded-full bg-spectral-mint shadow-sm" />
            </div>
            <div className="font-semibold text-ghost-100 truncate mb-1">{activeInstance.name}</div>
            <div className="flex items-center justify-between text-[11px] text-ghost-400 font-mono">
              <span className="text-spectral-cyan">{activeInstance.mc_version}</span>
              <span className="uppercase">{activeInstance.loader}</span>
              <span>{Math.round(activeInstance.memory_max_mb / 1024)}GB RAM</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-ghost-850/40 border border-ghost-800/50 text-center text-xs text-ghost-500">
            <Sparkles className="w-4 h-4 mx-auto mb-1 text-ghost-600" />
            <span>Sin estancia activa</span>
          </div>
        )}
      </div>
    </aside>
  );
}
