import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Save,
  RefreshCw,
  Sliders,
  Palette,
  Terminal,
  MemoryStick,
  FolderOpen,
  Check,
  Plus,
  Trash2,
  Download,
} from 'lucide-react';
import { Instance, SystemJavaInfo } from '../types';
import { api } from '../services/api';
import {
  ThemeSettings,
  THEME_PRESETS,
  ACCENT_SWATCHES,
  ThemePresetId,
} from '../utils/theme';
import { AccordionSection } from '../components/AccordionSection';
import { JavaDownloadModal } from '../components/JavaDownloadModal';
import { GlassSelect } from '../components/GlassSelect';
import { useI18n } from '../utils/i18n';

interface SettingsViewProps {
  activeInstance: Instance | null;
  onUpdateInstance: (updated: Instance) => Promise<void>;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
  themeSettings: ThemeSettings;
  onUpdateThemeSettings: (next: ThemeSettings) => void;
}

type SettingsSectionId = 'general' | 'java' | 'memory' | 'discord' | 'appearance' | 'advanced';

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeInstance,
  onUpdateInstance,
  onShowToast,
  themeSettings,
  onUpdateThemeSettings,
}) => {
  const { t, language, setLanguage } = useI18n();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [isJavaModalOpen, setIsJavaModalOpen] = useState(false);

  const [detectedRuntimes, setDetectedRuntimes] = useState<SystemJavaInfo[]>([]);
  const [isScanningJava, setIsScanningJava] = useState(false);
  const [selectedJavaPath, setSelectedJavaPath] = useState(activeInstance?.java_path || '');

  const [minRamMb, setMinRamMb] = useState(activeInstance?.memory_min_mb || 2048);
  const [maxRamMb, setMaxRamMb] = useState(activeInstance?.memory_max_mb || 4096);
  const [jvmArgs, setJvmArgs] = useState(
    activeInstance?.jvm_args || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled'
  );

  const [resWidth, setResWidth] = useState(activeInstance?.resolution?.width || 1920);
  const [resHeight, setResHeight] = useState(activeInstance?.resolution?.height || 1080);
  const [fullscreen, setFullscreen] = useState(activeInstance?.resolution?.fullscreen || false);
  const [serverConnect, setServerConnect] = useState<string>(
    typeof activeInstance?.server_auto_connect === 'string'
      ? activeInstance.server_auto_connect
      : ''
  );
  const [launcherBehavior, setLauncherBehavior] = useState<'keep' | 'minimize' | 'close'>('keep');

  const [discordEnabled, setDiscordEnabled] = useState(true);

  React.useEffect(() => {
    api
      .getConfig()
      .then((cfg) => setDiscordEnabled(Boolean(cfg.enable_discord_rpc)))
      .catch(() => {});
  }, []);
  const [discordDetails, setDiscordDetails] = useState('Jugando en GhosttyLauncher');
  const [discordState, setDiscordState] = useState(
    activeInstance ? `${activeInstance.name} (${activeInstance.loader})` : 'En el menú principal'
  );

  const [preLaunch, setPreLaunch] = useState(activeInstance?.pre_launch_command || '');
  const [postExit, setPostExit] = useState(activeInstance?.post_exit_command || '');
  const [envVars, setEnvVars] = useState<Record<string, string>>(activeInstance?.env_vars || {});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [concurrentDownloads, setConcurrentDownloads] = useState(12);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    scanJavaRuntimes();
  }, []);

  useEffect(() => {
    if (activeInstance) {
      setSelectedJavaPath(activeInstance.java_path || '');
      setMinRamMb(activeInstance.memory_min_mb || 2048);
      setMaxRamMb(activeInstance.memory_max_mb || 4096);
      setJvmArgs(activeInstance.jvm_args || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
      setPreLaunch(activeInstance.pre_launch_command || '');
      setPostExit(activeInstance.post_exit_command || '');
      setResWidth(activeInstance.resolution?.width || 1920);
      setResHeight(activeInstance.resolution?.height || 1080);
      setFullscreen(activeInstance.resolution?.fullscreen || false);
      setServerConnect(
        typeof activeInstance.server_auto_connect === 'string'
          ? activeInstance.server_auto_connect
          : ''
      );
      setEnvVars(activeInstance.env_vars || {});
      setDiscordState(`${activeInstance.name} (${activeInstance.loader})`);
    }
  }, [activeInstance]);

  const scanJavaRuntimes = async () => {
    try {
      setIsScanningJava(true);
      const list = await api.detectJava();
      setDetectedRuntimes(list);
      if (list.length > 0 && !selectedJavaPath) {
        setSelectedJavaPath(list[0].path);
      }
    } catch (e: any) {
      console.warn('Java scan warning:', e);
    } finally {
      setIsScanningJava(false);
    }
  };

  const handleAddEnvVar = () => {
    if (!newEnvKey.trim()) return;
    setEnvVars((prev) => ({ ...prev, [newEnvKey.trim()]: newEnvVal.trim() }));
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const handleRemoveEnvVar = (key: string) => {
    setEnvVars((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleOpenRootFolder = async () => {
    try {
      await api.openLauncherFolder();
      onShowToast('info', 'Carpeta Raíz Abierta', 'Mostrando el directorio principal de GhosttyLauncher.');
    } catch (e: any) {
      onShowToast('error', 'Error al abrir carpeta raíz', e.toString());
    }
  };

  const handleSaveAll = async () => {
    try {
      await api.updateDiscordRpc(discordEnabled, discordDetails, discordState);
    } catch {}

    if (!activeInstance) {
      onShowToast('success', 'Preferencias Globales Guardadas', 'Tema, Discord RPC y ajustes de sistema actualizados.');
      return;
    }

    try {
      setIsSaving(true);
      const updated: Instance = {
        ...activeInstance,
        java_path: selectedJavaPath.trim() || null,
        memory_min_mb: minRamMb,
        memory_max_mb: maxRamMb,
        jvm_args: jvmArgs.trim() || null,
        pre_launch_command: preLaunch.trim() || null,
        post_exit_command: postExit.trim() || null,
        env_vars: envVars,
        server_auto_connect: serverConnect.trim() || null,
        resolution: {
          width: resWidth,
          height: resHeight,
          fullscreen,
        },
      };

      await onUpdateInstance(updated);
      onShowToast('success', 'Ajustes Guardados', `Configuración sincronizada con "${activeInstance.name}".`);
    } catch (e: any) {
      onShowToast('error', 'Error al guardar', e.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const navItems: { id: SettingsSectionId; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'general', label: t.settings_tab_general, icon: Sliders },
    { id: 'java', label: t.settings_tab_java, icon: Cpu },
    { id: 'memory', label: t.settings_tab_memory, icon: MemoryStick },
    { id: 'discord', label: t.settings_tab_discord, icon: Activity },
    { id: 'appearance', label: t.settings_tab_appearance, icon: Palette },
    { id: 'advanced', label: t.settings_tab_advanced, icon: Terminal },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      
      <div className="px-6 py-4 border-b glass-divider flex items-center justify-between shrink-0">
        <div>
          <h2 className="heading-display text-2xl font-extrabold text-ghost-50 tracking-wide">
            {t.settings_title}
          </h2>
          <p className="text-xs text-ghost-400 font-mono">
            {activeInstance
              ? `Perfil vinculado: ${activeInstance.name} (${activeInstance.loader} ${activeInstance.mc_version})`
              : 'Ajustes globales predeterminados'}
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="btn-tactile flex items-center gap-2 px-5 py-2 rounded-control accent-bg text-white font-semibold text-xs shadow-md disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? t.settings_saving : t.settings_save}</span>
        </button>
      </div>

      
      <div className="flex-1 flex overflow-hidden">
        
        <aside className="w-48 sm:w-56 border-r glass-divider p-4 flex flex-col justify-between shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`btn-tactile w-full px-3.5 py-2.5 rounded-control text-xs font-medium flex items-center gap-2.5 transition-colors ${
                    active
                      ? 'accent-bg text-white font-semibold'
                      : 'text-ghost-300 hover:text-ghost-50 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleOpenRootFolder}
            className="btn-tactile w-full px-3 py-2 glass-control text-xs font-mono text-ghost-300 hover:text-ghost-50 flex items-center gap-2 justify-center"
            title="Abrir directorio raíz de datos de GhosttyLauncher"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Carpeta Raíz</span>
          </button>
        </aside>

        
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          
          {activeSection === 'general' && (
            <div className="space-y-6 divide-y glass-divider">
              <div className="space-y-4">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    VENTANA Y RESOLUCIÓN DE JUEGO
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Dimensiones iniciales de la ventana de Minecraft al lanzarse.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                      Ancho (px)
                    </label>
                    <input
                      type="number"
                      value={resWidth}
                      onChange={(e) => setResWidth(Number(e.target.value) || 1280)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                      Alto (px)
                    </label>
                    <input
                      type="number"
                      value={resHeight}
                      onChange={(e) => setResHeight(Number(e.target.value) || 720)}
                      className="w-full px-3 py-2 glass-control text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>

                
                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={fullscreen}
                    onChange={(e) => setFullscreen(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                  />
                  <span className="text-xs text-ghost-100 font-medium">
                    Iniciar Minecraft directamente en Pantalla Completa (<code>--fullscreen</code>)
                  </span>
                </label>
              </div>

              <div className="pt-5 space-y-4">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    CONEXIÓN DIRECTA Y COMPORTAMIENTO
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Servidor automático al entrar y acción de la ventana del launcher.
                  </p>
                </div>

                <div className="max-w-md">
                  <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                    Servidor Auto-Conectar (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. play.hypixel.net:25565"
                    value={serverConnect}
                    onChange={(e) => setServerConnect(e.target.value)}
                    className="w-full px-3 py-2 glass-control text-xs font-mono"
                  />
                </div>

                <div className="max-w-md">
                  <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                    Al iniciar el juego:
                  </label>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        { id: 'keep', label: 'Mantener Abierto' },
                        { id: 'minimize', label: 'Minimizar Isla' },
                        { id: 'close', label: 'Cerrar Launcher' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLauncherBehavior(opt.id)}
                        className={`btn-tactile px-3 py-1.5 rounded-control text-xs border ${
                          launcherBehavior === opt.id
                            ? 'accent-pill-tint font-semibold'
                            : 'glass-control text-ghost-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-5 space-y-2">
                <h3 className="heading-display text-xs font-bold text-ghost-400 tracking-wider">
                  AVISO LEGAL Y MARCA REGISTRADA
                </h3>
                <div className="p-3.5 rounded-control bg-black/25 border border-white/5 space-y-1.5 text-[11px] leading-relaxed text-ghost-400">
                  <p className="font-semibold text-ghost-200">
                    NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
                  </p>
                  <p>
                    NO ES UN PRODUCTO OFICIAL DE MINECRAFT. NO ESTÁ APROBADO POR NI ASOCIADO CON MOJANG O MICROSOFT.
                  </p>
                  <p className="text-[10px] text-ghost-400 pt-0.5">
                    Minecraft es una marca comercial de Mojang Studios / Microsoft Corporation. Ghostty Launcher es un lanzador independiente y de código abierto para la gestión de estancias y modding en Linux, de acuerdo con las Directrices Oficiales de Uso de Minecraft.
                  </p>
                </div>
              </div>
            </div>
          )}

          
          {activeSection === 'java' && (
            <div className="space-y-6 divide-y glass-divider">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="heading-display text-xl font-bold text-ghost-50">
                      SELECCIÓN DE EJECUTABLE JAVA
                    </h3>
                    <p className="text-xs text-ghost-400">
                      Elige una instalación detectada en tu equipo o especifica una ruta manual.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={scanJavaRuntimes}
                    className="btn-tactile px-3 py-1.5 glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningJava ? 'animate-spin' : ''}`} />
                    <span>Detectar JVMs</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                      Instalaciones Detectadas ({detectedRuntimes.length})
                    </label>
                    <GlassSelect
                      value={selectedJavaPath}
                      onChange={setSelectedJavaPath}
                      className="w-full"
                      popoverWidth="w-full"
                      options={[
                        {
                          value: '',
                          label: 'Java predeterminado del sistema (/usr/bin/java)',
                          badge: 'Auto',
                        },
                        ...detectedRuntimes.map((rt) => ({
                          value: rt.path,
                          label: `${rt.version} (Java ${rt.major_version})`,
                          sublabel: rt.path,
                          badge: `Java ${rt.major_version}`,
                        })),
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                      Ruta del Binario Java
                    </label>
                    <input
                      type="text"
                      value={selectedJavaPath}
                      onChange={(e) => setSelectedJavaPath(e.target.value)}
                      placeholder="/usr/lib/jvm/java-21-openjdk/bin/java"
                      className="w-full px-3 py-2 glass-control text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="heading-display text-xl font-bold text-ghost-50">
                      DESCARGAR RUNTIME DE JAVA
                    </h3>
                    <p className="text-xs text-ghost-400">
                      Runtimes oficiales de Mojang, Adoptium Temurin, Azul Zulu e IBM Semeru OpenJ9.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsJavaModalOpen(true)}
                    className="btn-tactile px-5 py-2.5 rounded-xl accent-bg text-white text-xs font-semibold flex items-center gap-2 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Abrir Catálogo de Java...</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'memory' && (
            <div className="space-y-6 divide-y glass-divider">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="heading-display text-xl font-bold text-ghost-50">
                      ASIGNACIÓN DE MEMORIA RAM
                    </h3>
                    <p className="text-xs text-ghost-400">
                      Memoria reservada para el heap de Java (<code>-Xms</code> y <code>-Xmx</code>).
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold accent-text tabular-nums">
                    {(minRamMb / 1024).toFixed(1)} GB – {(maxRamMb / 1024).toFixed(1)} GB
                  </span>
                </div>

                
                <div className="w-full h-2.5 rounded-full bg-black/35 overflow-hidden border border-white/10">
                  <div
                    style={{ width: `${Math.min(100, (maxRamMb / 32768) * 100)}%` }}
                    className="h-full accent-bg transition-all duration-150"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5 tabular-nums">
                      <span className="text-ghost-300">RAM Mínima (-Xms)</span>
                      <span className="text-ghost-50 font-semibold">{minRamMb} MB</span>
                    </div>
                    <input
                      type="range"
                      min="1024"
                      max="16384"
                      step="512"
                      value={minRamMb}
                      onChange={(e) => setMinRamMb(Number(e.target.value))}
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5 tabular-nums">
                      <span className="text-ghost-300">RAM Máxima (-Xmx)</span>
                      <span className="text-ghost-50 font-semibold">{maxRamMb} MB</span>
                    </div>
                    <input
                      type="range"
                      min="1024"
                      max="32768"
                      step="512"
                      value={maxRamMb}
                      onChange={(e) => setMaxRamMb(Number(e.target.value))}
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-5 space-y-3">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    PERFILES DE RECOLECTOR DE BASURA (GC) & FLAGS JVM
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Optimiza los tirones de FPS según el tamaño de tu modpack.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setJvmArgs(
                        '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC'
                      )
                    }
                    className="btn-tactile px-3 py-1.5 glass-control text-xs font-mono"
                  >
                    G1GC (Aikar Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setJvmArgs('-XX:+UseShenandoahGC -XX:+UnlockExperimentalVMOptions -XX:+AlwaysPreTouch')
                    }
                    className="btn-tactile px-3 py-1.5 glass-control text-xs font-mono"
                  >
                    Shenandoah (Baja Latencia)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJvmArgs('-XX:+UseZGC -XX:+ZGenerational -XX:+AlwaysPreTouch')}
                    className="btn-tactile px-3 py-1.5 glass-control text-xs font-mono"
                  >
                    ZGC Generacional (Java 21+)
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={jvmArgs}
                  onChange={(e) => setJvmArgs(e.target.value)}
                  className="w-full px-3.5 py-2.5 glass-control text-xs font-mono resize-none"
                />
              </div>
            </div>
          )}

          
          {activeSection === 'discord' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    DISCORD RICH PRESENCE PERSONALIZADO
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Muestra tu actividad en tiempo real con el icono oficial de GhosttyLauncher.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !discordEnabled;
                    window.dispatchEvent(new CustomEvent('ghostty:discord-changed', { detail: nextVal }));
                    setDiscordEnabled(nextVal);
                    api.updateDiscordRpc(nextVal, discordDetails, discordState).catch(() => {});
                  }}
                  role="switch"
                  aria-checked={discordEnabled}
                  className={`btn-tactile relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
                    discordEnabled ? 'accent-bg border-transparent' : 'bg-black/40 border-white/15'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
                      discordEnabled ? 'translate-x-5' : 'translate-x-1 opacity-60'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                    Línea Principal (Detalles)
                  </label>
                  <input
                    type="text"
                    value={discordDetails}
                    onChange={(e) => setDiscordDetails(e.target.value)}
                    className="w-full px-3 py-2 glass-control text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                    Línea Secundaria (Estado)
                  </label>
                  <input
                    type="text"
                    value={discordState}
                    onChange={(e) => setDiscordState(e.target.value)}
                    className="w-full px-3 py-2 glass-control text-xs"
                  />
                </div>
              </div>

              
              <div className="p-4 rounded-card glass-card max-w-md flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-control bg-black/40 p-2 flex items-center justify-center border border-white/10">
                    <img src="/ghostty.png" alt="Ghostty" className="w-full h-full object-contain" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-spectral-mint border-2 border-obsidian-950" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-mono font-bold text-ghost-400 tracking-wider">
                    Jugando a un juego
                  </div>
                  <div className="text-sm font-bold text-ghost-50 truncate">{discordDetails}</div>
                  <div className="text-xs text-ghost-200 truncate">{discordState}</div>
                  <div className="text-[11px] text-spectral-mint font-mono mt-0.5 tabular-nums">
                    00:42:18 transcurrido
                  </div>
                </div>
              </div>
            </div>
          )}

          
          {activeSection === 'appearance' && (
            <div className="space-y-6 divide-y glass-divider">
              
              <div className="space-y-3">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    {t.settings_language}
                  </h3>
                  <p className="text-xs text-ghost-400">
                    {t.settings_language_desc}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('es')}
                    className={`btn-tactile px-5 py-2.5 rounded-control text-xs font-semibold flex items-center gap-2 border transition-all ${
                      language === 'es'
                        ? 'accent-bg text-white border-transparent shadow-sm'
                        : 'glass-control text-ghost-300 hover:text-ghost-50'
                    }`}
                  >
                    <span>Español</span>
                    {language === 'es' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`btn-tactile px-5 py-2.5 rounded-control text-xs font-semibold flex items-center gap-2 border transition-all ${
                      language === 'en'
                        ? 'accent-bg text-white border-transparent shadow-sm'
                        : 'glass-control text-ghost-300 hover:text-ghost-50'
                    }`}
                  >
                    <span>English</span>
                    {language === 'en' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-5 space-y-3">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    TEMAS DE VIDRIO ESMERILADO (VISIONOS)
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Cambia la atmósfera base de las capas translúcidas del launcher.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((presetKey) => {
                    const meta = THEME_PRESETS[presetKey];
                    const active = themeSettings.preset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() =>
                          onUpdateThemeSettings({ ...themeSettings, preset: presetKey })
                        }
                        className={`btn-tactile p-3 rounded-card text-left border transition-all ${
                          active
                            ? 'accent-ring border-transparent bg-white/[0.08]'
                            : 'glass-control'
                        }`}
                      >
                        <div
                          className="w-full h-10 rounded-lg mb-2.5 border border-white/15 flex items-center justify-end p-1.5"
                          style={{ background: meta.previewBg }}
                        >
                          <div
                            className="w-1/2 h-full rounded border border-white/20"
                            style={{ background: meta.previewGlass }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ghost-50">{meta.name}</span>
                          {active && <Check className="w-3.5 h-3.5 accent-text" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              
              <div className="pt-5 space-y-3">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    COLOR DE ACENTO ÚNICO
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Se aplica con moderación al botón Jugar, selección activa, foco e indicadores.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {ACCENT_SWATCHES.map((swatch) => {
                    const active =
                      themeSettings.accentHex.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        onClick={() =>
                          onUpdateThemeSettings({ ...themeSettings, accentHex: swatch.hex })
                        }
                        className={`btn-tactile px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border ${
                          active
                            ? 'border-white text-ghost-50 bg-white/10 font-semibold'
                            : 'glass-control text-ghost-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span>{swatch.label}</span>
                      </button>
                    );
                  })}

                  
                  <label className="btn-tactile px-3 py-1.5 rounded-full glass-control text-xs font-mono flex items-center gap-2 cursor-pointer">
                    <input
                      type="color"
                      value={themeSettings.accentHex}
                      onChange={(e) =>
                        onUpdateThemeSettings({ ...themeSettings, accentHex: e.target.value })
                      }
                      className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span>{themeSettings.accentHex.toUpperCase()}</span>
                  </label>
                </div>
              </div>

              
              <div className="pt-5 space-y-3">
                <div>
                  <h3 className="heading-display text-xl font-bold text-ghost-50">
                    EFECTOS CINÉTICOS Y PARTÍCULAS
                  </h3>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center justify-between py-1.5 cursor-pointer">
                    <span className="text-xs text-ghost-100">
                      Partículas flotantes de fondo
                    </span>
                    <input
                      type="checkbox"
                      checked={themeSettings.particlesEnabled}
                      onChange={(e) =>
                        onUpdateThemeSettings({
                          ...themeSettings,
                          particlesEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between py-1.5 cursor-pointer">
                    <span className="text-xs text-ghost-100">
                      Explosión de partículas al pulsar Jugar o Instalar
                    </span>
                    <input
                      type="checkbox"
                      checked={themeSettings.launchBurstEnabled}
                      onChange={(e) =>
                        onUpdateThemeSettings({
                          ...themeSettings,
                          launchBurstEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>

                  <label className="flex items-center justify-between py-1.5 cursor-pointer">
                    <span className="text-xs text-ghost-100">
                      Arte del modpack difuminado y animado en el fondo
                    </span>
                    <input
                      type="checkbox"
                      checked={themeSettings.ambientArtworkEnabled}
                      onChange={(e) =>
                        onUpdateThemeSettings({
                          ...themeSettings,
                          ambientArtworkEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          
          {activeSection === 'advanced' && (
            <div className="divide-y glass-divider">
              <AccordionSection
                title="Comandos Pre-Lanzamiento y Post-Salida (Hooks)"
                subtitle="Ejecuta scripts personalizados antes de iniciar o al cerrar Minecraft"
                defaultOpen={true}
              >
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-mono text-ghost-300 mb-1">
                      Comando Pre-Lanzamiento
                    </label>
                    <input
                      type="text"
                      placeholder="ej. gamemoderun, mangohud"
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
              </AccordionSection>

              <AccordionSection
                title="Variables de Entorno"
                subtitle="Variables inyectadas al proceso de Java (ej. MESA_GL_VERSION_OVERRIDE)"
                badge={`${Object.keys(envVars).length}`}
                defaultOpen={true}
              >
                <div className="space-y-3 pt-1">
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
                      onClick={handleAddEnvVar}
                      className="btn-tactile px-3 py-1.5 rounded-control accent-bg text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir</span>
                    </button>
                  </div>

                  {Object.entries(envVars).length > 0 && (
                    <div className="divide-y glass-divider">
                      {Object.entries(envVars).map(([k, v]) => (
                        <div
                          key={k}
                          className="py-2 flex items-center justify-between text-xs font-mono"
                        >
                          <span>
                            <strong className="accent-text">{k}</strong> = {v}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEnvVar(k)}
                            className="text-ghost-400 hover:text-spectral-rose"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionSection>

              <AccordionSection
                title="Red y Concurrencia de Descargas"
                subtitle="Hilos paralelos para descargar assets de Mojang y mods de Modrinth"
                badge={`${concurrentDownloads} hilos`}
                defaultOpen={false}
              >
                <div className="pt-2 max-w-md">
                  <div className="flex justify-between text-xs font-mono mb-1.5 tabular-nums">
                    <span className="text-ghost-300">Descargas Simultáneas</span>
                    <span className="text-ghost-50 font-bold">{concurrentDownloads}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="32"
                    step="2"
                    value={concurrentDownloads}
                    onChange={(e) => setConcurrentDownloads(Number(e.target.value))}
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                </div>
              </AccordionSection>
            </div>
          )}
        </div>
      </div>

      <JavaDownloadModal
        isOpen={isJavaModalOpen}
        onClose={() => setIsJavaModalOpen(false)}
        onJavaInstalled={(info) => {
          setDetectedRuntimes((prev) => [...prev.filter((r) => r.path !== info.path), info]);
          setSelectedJavaPath(info.path);
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
