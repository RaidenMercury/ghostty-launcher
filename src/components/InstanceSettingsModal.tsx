import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FolderOpen,
  Sliders,
  Cpu,
  Monitor,
  Image,
  Save,
  Trash2,
  Plus,
  ImagePlus,
  Download,
} from 'lucide-react';
import { Instance } from '../types';
import { api } from '../services/api';
import { InstanceIcon, hasCustomPackIcon } from './InstanceIcon';
import { JavaDownloadModal } from './JavaDownloadModal';
import { useI18n } from '../utils/i18n';

export const MINECRAFT_PRESET_ICONS = [
  { id: 'minecraft', label: 'Bloque de Hierba (3D)' },
  { id: 'ghostty', label: 'Ghostty' },
  { id: '/icons/minecraft/diamond_sword.png', label: 'Espada de Diamante' },
  { id: '/icons/minecraft/diamond_pickaxe.png', label: 'Pico de Diamante' },
  { id: '/icons/minecraft/diamond_axe.png', label: 'Hacha de Diamante' },
  { id: '/icons/minecraft/diamond_shovel.png', label: 'Pala de Diamante' },
  { id: '/icons/minecraft/diamond.png', label: 'Diamante' },
  { id: '/icons/minecraft/netherite_sword.png', label: 'Espada de Netherite' },
  { id: '/icons/minecraft/netherite_ingot.png', label: 'Lingote de Netherite' },
  { id: '/icons/minecraft/golden_apple.png', label: 'Manzana Dorada' },
  { id: '/icons/minecraft/totem_of_undying.png', label: 'Tótem de Inmortalidad' },
  { id: '/icons/minecraft/ender_pearl.png', label: 'Perla de Ender' },
  { id: '/icons/minecraft/enchanted_book.png', label: 'Libro Encantado' },
  { id: '/icons/minecraft/book.png', label: 'Libro' },
  { id: '/icons/minecraft/bow.png', label: 'Arco' },
  { id: '/icons/minecraft/trident.png', label: 'Tridente' },
  { id: '/icons/minecraft/redstone.png', label: 'Redstone' },
  { id: '/icons/minecraft/emerald.png', label: 'Esmeralda' },
  { id: '/icons/minecraft/iron_ingot.png', label: 'Lingote de Hierro' },
  { id: '/icons/minecraft/gold_ingot.png', label: 'Lingote de Oro' },
  { id: '/icons/minecraft/amethyst_shard.png', label: 'Fragmento de Amatista' },
  { id: '/icons/minecraft/nether_star.png', label: 'Estrella del Nether' },
  { id: '/icons/minecraft/heart_of_the_sea.png', label: 'Corazón del Mar' },
  { id: '/icons/minecraft/experience_bottle.png', label: 'Botella de Experiencia' },
  { id: '/icons/minecraft/elytra.png', label: 'Élitros' },
  { id: '/icons/minecraft/firework_rocket.png', label: 'Cohete de Fuegos' },
  { id: '/icons/minecraft/potion.png', label: 'Poción' },
  { id: '/icons/minecraft/splash_potion.png', label: 'Poción Arrojadiza' },
  { id: '/icons/minecraft/tnt_side.png', label: 'TNT' },
  { id: '/icons/minecraft/crafting_table_front.png', label: 'Mesa de Trabajo' },
  { id: '/icons/minecraft/furnace_front.png', label: 'Horno' },
  { id: '/icons/minecraft/bookshelf.png', label: 'Librería' },
  { id: '/icons/minecraft/oak_sapling.png', label: 'Brote de Roble' },
  { id: '/icons/minecraft/chest_minecart.png', label: 'Vagoneta con Cofre' },
  { id: '/icons/minecraft/tnt_minecart.png', label: 'Vagoneta con TNT' },
  { id: '/icons/minecraft/blaze_rod.png', label: 'Vara de Blaze' },
  { id: '/icons/minecraft/apple.png', label: 'Manzana' },
  { id: '/icons/minecraft/bread.png', label: 'Pan' },
  { id: '/icons/minecraft/cookie.png', label: 'Galleta' },
];

interface InstanceSettingsModalProps {
  isOpen: boolean;
  instance: Instance | null;
  onClose: () => void;
  onUpdate: (updated: Instance) => Promise<void>;
  initialTab?: SettingsTab;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

type SettingsTab = 'general' | 'iconos' | 'java' | 'display';

export function InstanceSettingsModal({
  isOpen,
  instance,
  onClose,
  onUpdate,
  onShowToast,
  initialTab,
}: InstanceSettingsModalProps) {
  const { t } = useI18n();
  if (!instance) return null;

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isJavaModalOpen, setIsJavaModalOpen] = useState(false);
  const [name, setName] = useState(instance.name);
  const [selectedIcon, setSelectedIcon] = useState(instance.icon);
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

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (instance) {
      setName(instance.name);
      setSelectedIcon(instance.icon);
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
        icon: selectedIcon,
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
            className="relative w-full max-w-2xl h-[min(88vh,720px)] flex flex-col glass-panel-strong text-ghost-100 z-10 overflow-hidden"
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
                    <InstanceIcon icon={selectedIcon} alt={name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2
                        className="heading-display text-2xl font-extrabold text-ghost-50 truncate"
                        title={instance.name}
                      >
                        {instance.name}
                      </h2>
                    </div>
                    <p className="text-[11px] text-ghost-400 font-mono truncate flex items-center gap-2">
                      <span className="uppercase">{instance.loader}</span>
                      <span className="opacity-40">·</span>
                      <span>{instance.mc_version}</span>
                      <span className="opacity-40">·</span>
                      <span className="truncate">ID: {instance.id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenFolder}
                    className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 glass-control text-xs font-medium text-ghost-200"
                  >
                    <FolderOpen className="w-3.5 h-3.5 accent-text" />
                    <span>{t.inst_settings_folder_btn}</span>
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

            {/* Sub-Tabs de configuración */}
            <div className="flex px-6 border-b glass-divider gap-2 pt-2 text-xs font-mono">
              {(
                [
                  { id: 'general', label: t.inst_settings_tab_general, icon: Sliders },
                  { id: 'iconos', label: t.inst_settings_tab_icons, icon: Image },
                  { id: 'java', label: t.inst_settings_tab_java, icon: Cpu },
                  { id: 'display', label: t.inst_settings_tab_display, icon: Monitor },
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

            {/* Contenido scrolleable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {activeTab === 'general' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      {t.inst_settings_name_label}
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
                        {t.inst_settings_pre_launch}
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
                        {t.inst_settings_post_exit}
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

              {activeTab === 'iconos' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="heading-display text-xl font-bold text-ghost-50">
                      {t.inst_settings_icons_title}
                    </h3>
                    <p className="text-xs text-ghost-400">
                      {t.inst_settings_icons_desc}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                    <label
                      className={`btn-tactile aspect-square rounded-control p-2 border flex flex-col items-center justify-center cursor-pointer transition-all ${
                        selectedIcon && selectedIcon.startsWith('data:image/')
                          ? 'accent-pill-tint border-[var(--accent)] ring-2 ring-[var(--accent)]/50 scale-105'
                          : 'glass-control border-white/10 hover:border-white/20'
                      }`}
                      title={t.inst_settings_upload_png}
                    >
                      <ImagePlus className="w-5 h-5 text-ghost-300 mb-1" />
                      <span className="text-[9px] font-mono text-ghost-400">{t.inst_settings_upload_png}</span>
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setSelectedIcon(String(reader.result));
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {MINECRAFT_PRESET_ICONS.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setSelectedIcon(choice.id)}
                        className={`btn-tactile aspect-square rounded-control p-2 border flex items-center justify-center transition-all ${
                          selectedIcon === choice.id
                            ? 'accent-pill-tint border-[var(--accent)] ring-2 ring-[var(--accent)]/50 scale-105'
                            : 'glass-control border-white/10 hover:border-white/20'
                        }`}
                        title={choice.label}
                      >
                        <InstanceIcon icon={choice.id} alt={choice.label} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'java' && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-mono text-ghost-300">
                        {t.inst_settings_java_path}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsJavaModalOpen(true)}
                        className="btn-tactile text-[11px] font-mono accent-text hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>{t.inst_settings_java_download}</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t.inst_settings_java_placeholder}
                        value={javaPath}
                        onChange={(e) => setJavaPath(e.target.value)}
                        className="flex-1 px-3 py-2 glass-control text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setIsJavaModalOpen(true)}
                        className="btn-tactile px-3 py-2 glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-200 hover:text-ghost-50 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 accent-text" />
                        <span>{t.disc_install}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t glass-divider">
                    <div>
                      <div className="flex justify-between text-xs mb-1 tabular-nums">
                        <span className="text-ghost-300">{t.inst_settings_ram_min}</span>
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
                        <span className="text-ghost-300">{t.inst_settings_ram_max}</span>
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
                      {t.inst_settings_jvm_args}
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
                      {t.inst_settings_env_vars}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t.inst_settings_env_key}
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        className="flex-1 px-3 py-1.5 glass-control text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder={t.inst_settings_env_val}
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
                        {t.inst_settings_res_width}
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
                        {t.inst_settings_res_height}
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
                      {t.inst_settings_fullscreen_opt}
                    </span>
                  </label>

                  <div className="pt-4 border-t glass-divider">
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                      {t.inst_settings_autoconnect}
                    </label>
                    <input
                      type="text"
                      placeholder={t.inst_settings_autoconnect_hint}
                      value={serverConnect}
                      onChange={(e) => setServerConnect(e.target.value)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t glass-divider">
              <button
                type="button"
                onClick={onClose}
                className="btn-tactile px-4 py-2 glass-control text-ghost-300 text-xs font-medium"
              >
                {t.common_cancel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-tactile flex items-center gap-2 px-5 py-2 rounded-control accent-bg text-white font-semibold text-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? t.inst_settings_saving : t.inst_settings_save}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <JavaDownloadModal
        isOpen={isJavaModalOpen}
        onClose={() => setIsJavaModalOpen(false)}
        onJavaInstalled={(info) => {
          setJavaPath(info.path);
        }}
        onShowToast={onShowToast}
      />
    </AnimatePresence>
  );
}
