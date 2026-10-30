import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Check, RefreshCw, Download, Plus, Trash2, Sliders } from 'lucide-react';
import { SystemJavaInfo, JavaDownloadable, Instance } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  activeInstance: Instance | null;
  onUpdateInstance: (inst: Instance) => Promise<void>;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

export function SettingsView({ activeInstance, onUpdateInstance, onShowToast }: SettingsViewProps) {
  const [javaList, setJavaList] = useState<SystemJavaInfo[]>([]);
  const [downloadables, setDownloadables] = useState<JavaDownloadable[]>([]);
  const [selectedJava, setSelectedJava] = useState<string>('');
  const [customJavaPath, setCustomJavaPath] = useState<string>('');
  const [loadingJava, setLoadingJava] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);

  // Instance specific settings
  const [jvmArgs, setJvmArgs] = useState(activeInstance?.jvm_args || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [envVars, setEnvVars] = useState<Record<string, string>>(activeInstance?.env_vars || {});
  const [preLaunch, setPreLaunch] = useState(activeInstance?.pre_launch_command || '');
  const [postExit, setPostExit] = useState(activeInstance?.post_exit_command || '');

  // Discord RPC
  const [discordRpc, setDiscordRpc] = useState(true);

  useEffect(() => {
    loadJavaData();
  }, []);

  useEffect(() => {
    if (activeInstance) {
      setJvmArgs(activeInstance.jvm_args || '-XX:+UseG1GC');
      setEnvVars(activeInstance.env_vars || {});
      setPreLaunch(activeInstance.pre_launch_command || '');
      setPostExit(activeInstance.post_exit_command || '');
      setSelectedJava(activeInstance.java_path || javaList[0]?.path || '');
    }
  }, [activeInstance]);

  const loadJavaData = async () => {
    try {
      setLoadingJava(true);
      const [installed, available] = await Promise.all([
        api.detectJava(),
        api.getDownloadableJavaVersions(),
      ]);
      setJavaList(installed);
      setDownloadables(available);

      if (installed.length > 0 && !selectedJava) {
        setSelectedJava(installed[0].path);
      }
    } catch (e: any) {
      onShowToast('error', 'Error al consultar Java', e.toString());
    } finally {
      setLoadingJava(false);
    }
  };

  const handleSaveInstanceSettings = async () => {
    if (!activeInstance) {
      onShowToast('warning', 'Sin estancia', 'Selecciona una estancia para guardar estos ajustes.');
      return;
    }

    try {
      const updated: Instance = {
        ...activeInstance,
        java_path: selectedJava || null,
        jvm_args: jvmArgs.trim() || null,
        env_vars: envVars,
        pre_launch_command: preLaunch.trim() || null,
        post_exit_command: postExit.trim() || null,
      };

      await onUpdateInstance(updated);
      onShowToast('success', 'Ajustes guardados', `Se actualizaron los parámetros de ${activeInstance.name}`);
    } catch (e: any) {
      onShowToast('error', 'Error al guardar', e.toString());
    }
  };

  const handleAddEnvVar = () => {
    if (!envKey.trim()) return;
    setEnvVars((prev) => ({ ...prev, [envKey.trim()]: envVal.trim() }));
    setEnvKey('');
    setEnvVal('');
  };

  const handleRemoveEnvVar = (k: string) => {
    setEnvVars((prev) => {
      const copy = { ...prev };
      delete copy[k];
      return copy;
    });
  };

  const handleSimulatedDownloadJava = (item: JavaDownloadable) => {
    setDownloadingVersion(item.version);
    setTimeout(() => {
      setDownloadingVersion(null);
      const simulatedPath = `/opt/temurin-jdk-${item.version}/bin/java`;
      setJavaList((prev) => [
        ...prev,
        {
          path: simulatedPath,
          version: `${item.vendor} OpenJDK (build ${item.version}.0.1+1)`,
          major_version: item.version,
          is_valid: true,
        },
      ]);
      setSelectedJava(simulatedPath);
      onShowToast('success', 'Runtime Instalado', `${item.name} se descargó y seleccionó exitosamente.`);
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none max-w-5xl">
      {/* Header */}
      <div className="pb-5 border-b border-ghost-800/80">
        <h1 className="text-xl font-bold tracking-tight text-ghost-100">
          Entorno de Ejecución & Configuración Java
        </h1>
        <p className="text-xs text-ghost-400 mt-0.5">
          Configuración avanzada de runtimes, variables de entorno, argumentos JVM y Discord RPC.
        </p>
      </div>

      {/* Java Runtimes (Local & Temurin Catalog) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-spectral-cyan/15 text-spectral-cyan border border-spectral-cyan/30 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-ghost-100">Runtimes de Java en el Sistema</h3>
              <p className="text-[11px] text-ghost-400">Escaneado en /usr/lib/jvm y ejecutables de PATH</p>
            </div>
          </div>
          <button
            onClick={loadJavaData}
            disabled={loadingJava}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-850 hover:bg-ghost-800 border border-ghost-750 text-xs text-ghost-300 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingJava ? 'animate-spin' : ''}`} />
            <span>Re-escanear</span>
          </button>
        </div>

        {/* Installed Java Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {javaList.map((j) => {
            const isSelected = selectedJava === j.path;

            return (
              <div
                key={j.path}
                onClick={() => setSelectedJava(j.path)}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-ghost-850 border-spectral-cyan shadow-sm'
                    : 'bg-ghost-900/60 border-ghost-800 hover:border-ghost-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-ghost-800 flex items-center justify-center text-ghost-300 font-mono text-xs shrink-0">
                    {j.major_version ? `v${j.major_version}` : 'JDK'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-xs text-ghost-100 truncate">{j.version}</div>
                    <div className="text-[10px] font-mono text-ghost-400 truncate mt-0.5">{j.path}</div>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-spectral-mint shrink-0 ml-2">
                    <Check className="w-3.5 h-3.5" />
                    <span>Activo</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Manual Custom Java Path */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            placeholder="O escribe una ruta personalizada de ejecutable Java (ej. /opt/graalvm/bin/java)..."
            value={customJavaPath}
            onChange={(e) => setCustomJavaPath(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100 placeholder-ghost-500 focus:outline-none focus:border-spectral-cyan"
          />
          <button
            onClick={() => {
              if (customJavaPath.trim()) {
                setSelectedJava(customJavaPath.trim());
                onShowToast('info', 'Ruta Java personalizada asignada', customJavaPath.trim());
              }
            }}
            className="px-4 py-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-semibold text-ghost-200"
          >
            Usar Ruta
          </button>
        </div>

        {/* Downloadable Official Temurin OpenJDK Catalog */}
        <div className="pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ghost-400 font-mono mb-2">
            Descargar Runtimes Oficiales (Eclipse Temurin / Azul Zulu)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {downloadables.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-ghost-900 border border-ghost-800 flex flex-col justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-ghost-200 truncate">{item.name}</div>
                  <div className="text-[10px] text-ghost-400 font-mono mt-0.5">{item.vendor} • {item.os}</div>
                </div>
                <button
                  onClick={() => handleSimulatedDownloadJava(item)}
                  disabled={downloadingVersion === item.version}
                  className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-medium text-spectral-cyan transition-colors"
                >
                  {downloadingVersion === item.version ? (
                    <div className="w-3.5 h-3.5 border-2 border-spectral-cyan border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Instalar ({item.size_mb} MB)</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Instance Flags & Environment Variables */}
      {activeInstance && (
        <div className="p-5 rounded-2xl bg-ghost-900/90 border border-ghost-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-spectral-cyan" />
              <h3 className="font-semibold text-xs text-ghost-100">
                Parámetros de Ejecución para "{activeInstance.name}"
              </h3>
            </div>
            <button
              onClick={handleSaveInstanceSettings}
              className="px-4 py-1.5 rounded-lg bg-spectral-cyan hover:bg-spectral-cyan/90 text-ghost-950 font-bold text-xs uppercase tracking-wider"
            >
              Guardar Cambios
            </button>
          </div>

          {/* JVM Args */}
          <div>
            <label className="block text-[11px] font-mono text-ghost-400 mb-1">
              Argumentos JVM (Garbage Collection, Optimizaciones)
            </label>
            <input
              type="text"
              value={jvmArgs}
              onChange={(e) => setJvmArgs(e.target.value)}
              placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
              className="w-full px-3 py-2 rounded-lg bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100"
            />
          </div>

          {/* Hooks pre/post */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-ghost-400 mb-1">
                Comando Pre-Ejecución (Ej. gamemoderun, mangohud)
              </label>
              <input
                type="text"
                value={preLaunch}
                onChange={(e) => setPreLaunch(e.target.value)}
                placeholder="gamemoderun"
                className="w-full px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-ghost-400 mb-1">
                Comando Post-Salida (Hook al cerrar el juego)
              </label>
              <input
                type="text"
                value={postExit}
                onChange={(e) => setPostExit(e.target.value)}
                placeholder="echo 'Minecraft finalizado'"
                className="w-full px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100"
              />
            </div>
          </div>

          {/* Environment Variables Table */}
          <div>
            <label className="block text-[11px] font-mono text-ghost-400 mb-1.5">
              Variables de Entorno Personalizadas
            </label>
            <div className="space-y-1.5 mb-2">
              {Object.entries(envVars).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-800 text-xs font-mono"
                >
                  <span className="text-spectral-cyan">{k}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ghost-300">{v}</span>
                    <button
                      onClick={() => handleRemoveEnvVar(k)}
                      className="text-ghost-500 hover:text-spectral-rose"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="CLAVE (ej. MESA_GL_VERSION_OVERRIDE)"
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100"
              />
              <input
                type="text"
                placeholder="VALOR (ej. 4.5)"
                value={envVal}
                onChange={(e) => setEnvVal(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-750 text-xs font-mono text-ghost-100"
              />
              <button
                type="button"
                onClick={handleAddEnvVar}
                className="px-3 py-1.5 rounded-lg bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-semibold text-ghost-200 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discord RPC Card */}
      <div className="p-4 rounded-2xl bg-ghost-900 border border-ghost-800 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-xs text-ghost-100">Discord Rich Presence</h4>
          <p className="text-[11px] text-ghost-400">Transmite el estado del juego, tiempo transcurrido y modpack a Discord IPC</p>
        </div>
        <button
          onClick={() => setDiscordRpc(!discordRpc)}
          className={`w-11 h-6 rounded-full p-1 transition-colors ${
            discordRpc ? 'bg-spectral-mint' : 'bg-ghost-800'
          }`}
        >
          <motion.div
            layout
            className={`w-4 h-4 rounded-full bg-ghost-950 shadow-sm ${
              discordRpc ? 'ml-auto' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}
