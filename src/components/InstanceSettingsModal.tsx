import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FolderOpen,
  Sliders,
  Cpu,
  Package,
  Monitor,
  Save,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Instance, ModFileInfo } from '../types';
import { api } from '../services/api';
import { InstanceIcon, hasCustomPackIcon } from './InstanceIcon';

interface InstanceSettingsModalProps {
  isOpen: boolean;
  instance: Instance | null;
  onClose: () => void;
  onUpdate: (updated: Instance) => Promise<void>;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

type SettingsTab = 'general' | 'mods' | 'java' | 'display';

export function InstanceSettingsModal({
  isOpen,
  instance,
  onClose,
  onUpdate,
  onShowToast,
}: InstanceSettingsModalProps) {
  if (!instance) return null;

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(instance.name);
  const [ramMinMb, setRamMinMb] = useState(instance.memory_min_mb || 2048);
  const [ramMaxMb, setRamMaxMb] = useState(instance.memory_max_mb || 4096);
  const [javaPath, setJavaPath] = useState(instance.java_path || '');
  const [jvmArgs, setJvmArgs] = useState(instance.jvm_args || '-XX:+UseG1GC');
  const [preLaunch, setPreLaunch] = useState(instance.pre_launch_command || '');
  const [postExit, setPostExit] = useState(instance.post_exit_command || '');
  const [resWidth, setResWidth] = useState(instance.resolution?.width || 1920);
  const [resHeight, setResHeight] = useState(instance.resolution?.height || 1080);
  const [fullscreen, setFullscreen] = useState(instance.resolution?.fullscreen || false);

  const formatServerConnect = (val?: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.host ? `${val.host}${val.port ? `:${val.port}` : ''}` : '';
  };

  const [serverConnect, setServerConnect] = useState(formatServerConnect(instance.server_auto_connect));
  const [envVars, setEnvVars] = useState<Record<string, string>>(instance.env_vars || {});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');

  const [mods, setMods] = useState<ModFileInfo[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setRamMinMb(instance.memory_min_mb || 2048);
      setRamMaxMb(instance.memory_max_mb || 4096);
      setJavaPath(instance.java_path || '');
      setJvmArgs(instance.jvm_args || '-XX:+UseG1GC');
      setPreLaunch(instance.pre_launch_command || '');
      setPostExit(instance.post_exit_command || '');
      setResWidth(instance.resolution?.width || 1920);
      setResHeight(instance.resolution?.height || 1080);
      setFullscreen(instance.resolution?.fullscreen || false);
      setServerConnect(formatServerConnect(instance.server_auto_connect));
      setEnvVars(instance.env_vars || {});
      loadMods();
    }
  }, [instance]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadMods = async () => {
    if (!instance) return;
    try {
      setLoadingMods(true);
      const list = await api.getInstanceMods(instance.id);
      setMods(list);
    } catch (e: any) {
      console.warn('Error loading mods in settings:', e);
    } finally {
      setLoadingMods(false);
    }
  };

  const handleToggleMod = async (mod: ModFileInfo) => {
    if (!instance) return;
    try {
      const updatedMod = await api.toggleInstanceMod(instance.id, mod.filename);
      setMods((prev) =>
        prev.map((m) =>
          m.filename.replace(/(\.disabled)+$/, '') === mod.filename.replace(/(\.disabled)+$/, '')
            ? updatedMod
            : m
        )
      );
      onShowToast(
        'info',
        updatedMod.enabled ? 'Mod Activado' : 'Mod Desactivado',
        updatedMod.filename
      );
    } catch (e: any) {
      onShowToast('error', 'Error al alternar mod', e.toString());
    }
  };

  const handleOpenFolder = async () => {
    try {
      await api.openInstanceFolder(instance.id);
      onShowToast('info', 'Carpeta abierta', `Mostrando archivos de la estancia en el explorador.`);
    } catch (e: any) {
      onShowToast('error', 'Error abriendo carpeta', e.toString());
    }
  };

  const handleAddEnv = () => {
    if (!newEnvKey.trim()) return;
    setEnvVars((prev) => ({ ...prev, [newEnvKey.trim()]: newEnvVal.trim() }));
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const handleRemoveEnv = (key: string) => {
    setEnvVars((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated: Instance = {
        ...instance,
        name: name.trim() || instance.name,
        memory_min_mb: ramMinMb,
        memory_max_mb: ramMaxMb,
        java_path: javaPath.trim() || null,
        jvm_args: jvmArgs.trim() || null,
        env_vars: envVars,
        pre_launch_command: preLaunch.trim() || null,
        post_exit_command: postExit.trim() || null,
        resolution: {
          width: resWidth,
          height: resHeight,
          fullscreen,
        },
        server_auto_connect: serverConnect.trim() || null,
      };

      await onUpdate(updated);
      onShowToast('success', 'Ajustes de Estancia Guardados', `Configuración actualizada para ${name}.`);
      onClose();
    } catch (e: any) {
      onShowToast('error', 'Error al guardar ajustes', e.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const isPackArt = hasCustomPackIcon(instance.icon);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={onClose}
            className="fixed inset-0 modal-scrim"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-2xl max-h-[88vh] flex flex-col glass-panel-strong text-ghost-100 z-10 overflow-hidden"
          >
            <div className="relative overflow-hidden border-b glass-divider">
              {isPackArt && (
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 20% 50%, rgba(var(--accent-rgb), 0.35), transparent 65%)',
                  }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-control bg-black/30 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                    <InstanceIcon icon={instance.icon} alt={instance.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="heading-display text-2xl font-extrabold text-ghost-50 truncate">
                        {instance.name}
                      </h2>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full accent-pill-tint border uppercase tabular-nums">
                        {instance.loader} {instance.mc_version}
                      </span>
                    </div>
                    <p className="text-[11px] text-ghost-400 font-mono truncate">
                      ID: {instance.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenFolder}
                    className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 glass-control text-xs font-medium text-ghost-200"
                  >
                    <FolderOpen className="w-3.5 h-3.5 accent-text" />
                    <span>Directorio</span>
                  </button>

                  <button
                    onClick={onClose}
                    className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            
            <div className="flex px-6 border-b glass-divider gap-2 pt-2 text-xs font-mono">
              {(
                [
                  { id: 'general', label: 'General & Hooks', icon: Sliders },
                  { id: 'mods', label: `Mods (${mods.length})`, icon: Package },
                  { id: 'java', label: 'Java & Memoria', icon: Cpu },
                  { id: 'display', label: 'Pantalla & Red', icon: Monitor },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`btn-tactile flex items-center gap-2 pb-2.5 pt-1.5 px-3 border-b-2 font-medium transition-colors tabular-nums ${
                      active
                        ? 'accent-border accent-text font-semibold'
                        : 'border-transparent text-ghost-400 hover:text-ghost-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      Nombre de la Estancia
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2 glass-control text-xs"
                    />
                  </div>

                  <div className="space-y-3.5 pt-4 border-t glass-divider">
                    <div>
                      <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                        Comando Pre-Lanzamiento
                      </label>
                      <input
                        type="text"
                        placeholder="ej. gamemoderun"
                        value={preLaunch}
                        onChange={(e) => setPreLaunch(e.target.value)}
                        className="w-full px-3 py-2 glass-control text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                        Comando Post-Salida
                      </label>
                      <input
                        type="text"
                        placeholder="ej. backup-world.sh"
                        value={postExit}
                        onChange={(e) => setPostExit(e.target.value)}
                        className="w-full px-3 py-2 glass-control text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'mods' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ghost-200">
                      Mods instalados ({mods.length})
                    </span>
                    <button
                      onClick={loadMods}
                      className="btn-tactile flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono glass-control"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingMods ? 'animate-spin' : ''}`} />
                      <span>Refrescar</span>
                    </button>
                  </div>

                  {loadingMods ? (
                    <div className="py-10 text-center text-xs text-ghost-400 font-mono">
                      Escaneando carpeta mods/...
                    </div>
                  ) : mods.length === 0 ? (
                    <div className="py-10 text-center text-xs text-ghost-400">
                      No hay mods instalados en esta estancia todavía.
                    </div>
                  ) : (
                    <div className="divide-y glass-divider border-t border-b glass-divider">
                      {mods.map((mod) => {
                        const cleanName = mod.filename.replace(/(\.disabled)+$/, '');
                        return (
                          <div
                            key={mod.filename}
                            className="flex items-center justify-between py-2.5 px-2"
                          >
                            <div className="min-w-0 pr-4">
                              <span
                                className={`text-xs font-mono truncate block ${
                                  mod.enabled ? 'text-ghost-50 font-medium' : 'text-ghost-400 line-through'
                                }`}
                              >
                                {cleanName}
                              </span>
                              <span className="text-[10px] text-ghost-400 font-mono tabular-nums">
                                {(mod.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleMod(mod)}
                              role="switch"
                              aria-checked={mod.enabled}
                              className={`btn-tactile relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-100 ${
                                mod.enabled
                                  ? 'accent-bg border-transparent'
                                  : 'bg-black/40 border-white/15'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-100 mt-0.5 ${
                                  mod.enabled ? 'translate-x-4' : 'translate-x-0.5 opacity-60'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'java' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      Ruta Ejecutable de Java
                    </label>
                    <input
                      type="text"
                      placeholder="Dejar vacío para heredar el Java global"
                      value={javaPath}
                      onChange={(e) => setJavaPath(e.target.value)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t glass-divider">
                    <div>
                      <div className="flex justify-between text-xs mb-1 tabular-nums">
                        <span className="text-ghost-300">RAM Mínima (-Xms)</span>
                        <span className="font-mono font-bold text-ghost-50">{ramMinMb} MB</span>
                      </div>
                      <input
                        type="range"
                        min="1024"
                        max="16384"
                        step="512"
                        value={ramMinMb}
                        onChange={(e) => setRamMinMb(parseInt(e.target.value, 10))}
                        className="w-full accent-[var(--accent)] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1 tabular-nums">
                        <span className="text-ghost-300">RAM Máxima (-Xmx)</span>
                        <span className="font-mono font-bold accent-text">{ramMaxMb} MB</span>
                      </div>
                      <input
                        type="range"
                        min="1024"
                        max="32768"
                        step="512"
                        value={ramMaxMb}
                        onChange={(e) => setRamMaxMb(parseInt(e.target.value, 10))}
                        className="w-full accent-[var(--accent)] cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t glass-divider">
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      Argumentos JVM
                    </label>
                    <textarea
                      rows={2}
                      value={jvmArgs}
                      onChange={(e) => setJvmArgs(e.target.value)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono resize-none"
                    />
                  </div>

                  <div className="space-y-3 pt-3 border-t glass-divider">
                    <label className="block text-[11px] font-mono text-ghost-300">
                      Variables de Entorno
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="CLAVE"
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        className="flex-1 px-3 py-1.5 glass-control text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="VALOR"
                        value={newEnvVal}
                        onChange={(e) => setNewEnvVal(e.target.value)}
                        className="flex-1 px-3 py-1.5 glass-control text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddEnv}
                        className="btn-tactile px-3 py-1.5 glass-control text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {Object.entries(envVars).length > 0 && (
                      <div className="divide-y glass-divider">
                        {Object.entries(envVars).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between py-1.5 text-xs font-mono"
                          >
                            <span>
                              <strong className="accent-text">{k}</strong> = {v}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnv(k)}
                              className="text-ghost-400 hover:text-spectral-rose"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'display' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                        Ancho de Ventana (px)
                      </label>
                      <input
                        type="number"
                        value={resWidth}
                        onChange={(e) => setResWidth(parseInt(e.target.value, 10) || 1280)}
                        className="w-full px-3 py-2 glass-control text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                        Alto de Ventana (px)
                      </label>
                      <input
                        type="number"
                        value={resHeight}
                        onChange={(e) => setResHeight(parseInt(e.target.value, 10) || 720)}
                        className="w-full px-3 py-2 glass-control text-xs font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fullscreen}
                      onChange={(e) => setFullscreen(e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-xs text-ghost-100 font-medium">
                      Iniciar siempre en modo Pantalla Completa (--fullscreen)
                    </span>
                  </label>

                  <div className="pt-4 border-t glass-divider">
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      Auto-Conectar a Servidor al Iniciar (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="ej. play.hypixel.net:25565"
                      value={serverConnect}
                      onChange={(e) => setServerConnect(e.target.value)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t glass-divider">
              <button
                type="button"
                onClick={onClose}
                className="btn-tactile px-4 py-2 glass-control text-ghost-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-tactile flex items-center gap-2 px-5 py-2 rounded-control accent-bg text-white font-semibold text-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Ajustes'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
