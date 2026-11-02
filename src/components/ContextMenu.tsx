import React, { useEffect } from 'react';
import {
  Play,
  Square,
  Plus,
  Upload,
  Package,
  Compass,
  Sliders,
  FolderOpen,
  UserCheck,
  Terminal,
  Palette,
  Settings,
  Star,
  StarOff,
  FolderPlus,
  Trash2,
  Copy,
  Image,
} from 'lucide-react';
import { Instance } from '../types';
import { THEME_PRESETS, ThemePresetId } from '../utils/theme';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  activeInstance: Instance | null;
  isPlaying: boolean;
  currentThemePreset: ThemePresetId;
  onLaunch: () => void;
  onStopGame: () => void;
  onOpenCreate: () => void;
  onTriggerImportFile: () => void;
  onOpenMods: () => void;
  onOpenDiscover: () => void;
  onOpenInstanceSettings: () => void;
  onOpenInstanceFolder: () => void;
  onOpenAccountsAndSkins: () => void;
  onOpenLogs: () => void;
  onCycleTheme: () => void;
  onOpenGlobalSettings: () => void;
  onToggleFavorite?: () => void;
  onAddToGroup?: () => void;
  onDeleteInstance?: () => void;
  onDuplicateInstance?: () => void;
  context?: 'instance' | 'group' | 'empty';
  contextGroup?: string | null;
  onChangeIcon?: () => void;
  onRenameGroup?: () => void;
  onDeleteGroup?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  onClose,
  activeInstance,
  isPlaying,
  currentThemePreset,
  onLaunch,
  onStopGame,
  onOpenCreate,
  onTriggerImportFile,
  onOpenMods,
  onOpenDiscover,
  onOpenInstanceSettings,
  onOpenInstanceFolder,
  onOpenAccountsAndSkins,
  onOpenLogs,
  onCycleTheme,
  onOpenGlobalSettings,
  onToggleFavorite,
  onAddToGroup,
  onDeleteInstance,
  onDuplicateInstance,
  context = 'instance',
  contextGroup,
  onChangeIcon,
  onRenameGroup,
  onDeleteGroup,
}) => {
  useEffect(() => {
    if (!menu.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScrollOrResize = () => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [menu.isOpen, onClose]);

  const menuWidth = 264;
  const estimatedHeight =
    context === 'empty'
      ? 110
      : context === 'group'
      ? 160
      : 390;

  const safeX =
    typeof window !== 'undefined'
      ? Math.min(Math.max(8, menu.x), window.innerWidth - menuWidth - 12)
      : menu.x;

  let safeY = menu.y;
  if (typeof window !== 'undefined') {
    if (menu.y + estimatedHeight > window.innerHeight - 12) {
      safeY = Math.max(12, menu.y - estimatedHeight);
    } else {
      safeY = Math.max(12, menu.y);
    }
  }

  const runAction = (fn: () => void) => {
    onClose();
    fn();
  };

  if (context !== 'instance') {
    return (
      <>
        {menu.isOpen && (
          <div
            className="fixed inset-0 z-[100]"
            onClick={onClose}
            onContextMenu={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            <div
              style={{ left: safeX, top: safeY, width: menuWidth }}
              onClick={(e) => e.stopPropagation()}
              className="fixed sequoia-context-menu p-1.5 select-none text-xs glass-modal"
            >
              <div className="px-2.5 py-1 text-[10px] font-mono text-ghost-400 truncate">
                {context === 'group' ? `Grupo: ${contextGroup}` : 'GhosttyLauncher'}
              </div>
              <div className="my-1 border-t glass-divider" />

              {context === 'group' ? (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(onOpenCreate)}
                    className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 opacity-80" />
                    <span>Crear instancia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => onRenameGroup?.())}
                    className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 opacity-80" />
                    <span>Renombrar grupo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => onDeleteGroup?.())}
                    className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-spectral-rose hover:bg-spectral-rose hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 opacity-80" />
                    <span>Eliminar grupo</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => runAction(onOpenCreate)}
                    className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 opacity-80" />
                    <span>Nueva Instancia...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(onTriggerImportFile)}
                    className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 opacity-80" />
                    <span>Importar Modpack (.mrpack)...</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {menu.isOpen && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          <div
            style={{
              left: safeX,
              top: safeY,
              width: menuWidth,
              transformOrigin: 'top left',
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed sequoia-context-menu p-1.5 select-none text-xs glass-modal"
          >
            
            <div className="px-2.5 py-1 text-[10px] font-mono text-ghost-400 flex items-center justify-between truncate">
              <span className="truncate">
                {activeInstance ? activeInstance.name : 'GhosttyLauncher'}
              </span>
              {activeInstance && (
                <span className="uppercase opacity-75 ml-2 shrink-0">
                  {activeInstance.loader} {activeInstance.mc_version}
                </span>
              )}
            </div>

            <div className="my-1 border-t glass-divider" />

            
            {isPlaying ? (
              <button
                type="button"
                onClick={() => runAction(onStopGame)}
                className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-spectral-rose hover:bg-spectral-rose hover:text-white transition-colors font-medium group"
              >
                <span className="flex items-center gap-2.5">
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Detener Instancia en Juego</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!activeInstance}
                onClick={() => runAction(onLaunch)}
                className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-50 hover:accent-bg hover:text-white transition-colors font-medium disabled:opacity-40 group"
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Play className="w-3.5 h-3.5 fill-current accent-text group-hover:text-white shrink-0" />
                  <span className="truncate">
                    Jugar {activeInstance ? activeInstance.name : 'Ahora'}
                  </span>
                </span>
                <span className="text-[10px] font-mono opacity-60 ml-2 shrink-0">↵</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => runAction(onOpenCreate)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Plus className="w-3.5 h-3.5 opacity-80" />
                <span>Nueva Instancia...</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">⌥N</span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onTriggerImportFile)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Upload className="w-3.5 h-3.5 opacity-80" />
                <span>Importar Modpack (.mrpack)...</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">⌥I</span>
            </button>

            <div className="my-1 border-t glass-divider" />

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(() => onToggleFavorite?.())}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              {activeInstance?.favorite ? (
                <StarOff className="w-3.5 h-3.5 opacity-80" />
              ) : (
                <Star className="w-3.5 h-3.5 opacity-80" />
              )}
              <span>{activeInstance?.favorite ? 'Quitar de Favoritos' : 'Añadir a Favoritos'}</span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(() => onAddToGroup?.())}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              <FolderPlus className="w-3.5 h-3.5 opacity-80" />
              <span>Añadir a grupo...</span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(() => onChangeIcon?.())}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              <Image className="w-3.5 h-3.5 opacity-80" />
              <span>Cambiar icono...</span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(() => onDuplicateInstance?.())}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              <Copy className="w-3.5 h-3.5 opacity-80" />
              <span>Duplicar Instancia</span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(() => onDeleteInstance?.())}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center gap-2.5 text-spectral-rose hover:bg-spectral-rose hover:text-white transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 opacity-80" />
              <span>Eliminar Instancia</span>
            </button>

            <div className="my-1 border-t glass-divider" />

            
            <button
              type="button"
              onClick={() => runAction(onOpenMods)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Package className="w-3.5 h-3.5 opacity-80" />
                <span>Gestor de Mods</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">⌥3</span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onOpenDiscover)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Compass className="w-3.5 h-3.5 opacity-80" />
                <span>Explorar Modrinth</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">⌥2</span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(onOpenInstanceSettings)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              <span className="flex items-center gap-2.5">
                <Sliders className="w-3.5 h-3.5 opacity-80" />
                <span>Ajustes de la Instancia</span>
              </span>
            </button>

            <button
              type="button"
              disabled={!activeInstance}
              onClick={() => runAction(onOpenInstanceFolder)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors disabled:opacity-40"
            >
              <span className="flex items-center gap-2.5">
                <FolderOpen className="w-3.5 h-3.5 opacity-80" />
                <span>Abrir Carpeta de Archivos</span>
              </span>
            </button>

            <div className="my-1 border-t glass-divider" />

            
            <button
              type="button"
              onClick={() => runAction(onOpenAccountsAndSkins)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <UserCheck className="w-3.5 h-3.5 opacity-80" />
                <span>Cuentas y Estudio de Skin...</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onOpenLogs)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Terminal className="w-3.5 h-3.5 opacity-80" />
                <span>Consola de Logs JVM</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onCycleTheme)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Palette className="w-3.5 h-3.5 opacity-80" />
                <span>Cambiar Tema</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">
                {THEME_PRESETS[currentThemePreset]?.name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => runAction(onOpenGlobalSettings)}
              className="w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-ghost-100 hover:accent-bg hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Settings className="w-3.5 h-3.5 opacity-80" />
                <span>Configuración Global...</span>
              </span>
              <span className="text-[10px] font-mono opacity-60">⌥4</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
