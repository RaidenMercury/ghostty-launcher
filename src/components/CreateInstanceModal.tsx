import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Cpu, Sliders, ChevronDown } from 'lucide-react';
import { CreateInstancePayload, MojangManifest } from '../types';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateInstancePayload) => Promise<void>;
  manifest: MojangManifest | null;
}

export function CreateInstanceModal({
  isOpen,
  onClose,
  onCreate,
  manifest,
}: CreateInstanceModalProps) {
  const [name, setName] = useState('');
  const [mcVersion, setMcVersion] = useState('1.21.4');
  const [versionTypeFilter, setVersionTypeFilter] = useState<'all' | 'release' | 'snapshot'>('release');
  const [loader, setLoader] = useState<'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'>('fabric');
  const [ramGb, setRamGb] = useState(4);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jvmArgs, setJvmArgs] = useState('-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
  const [preLaunchCmd, setPreLaunchCmd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (manifest?.latest?.release) {
      setMcVersion(manifest.latest.release);
    }
  }, [manifest]);

  const loaderOptions = [
    { id: 'fabric', label: 'Fabric', desc: 'Rendimiento y ecosistema moderno' },
    { id: 'neoforge', label: 'NeoForge', desc: 'Siguiente generación de Forge' },
    { id: 'forge', label: 'Forge', desc: 'Soporte legendario' },
    { id: 'quilt', label: 'Quilt', desc: 'Fork comunitario modular' },
    { id: 'vanilla', label: 'Vanilla', desc: 'Sin loaders' },
  ];

  // Full Mojang Manifest versions (hundreds of versions)
  const allVersions = manifest?.versions || [];
  const filteredVersions = allVersions.filter((v) => {
    if (versionTypeFilter === 'all') return true;
    return v.type === versionTypeFilter;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await onCreate({
        name: name.trim(),
        mc_version: mcVersion,
        loader,
        memory_min_mb: 2048,
        memory_max_mb: ramGb * 1024,
        jvm_args: jvmArgs.trim() || undefined,
        pre_launch_command: preLaunchCmd.trim() || undefined,
      });
      setName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ghost-950/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-ghost-900 border border-ghost-750 shadow-2xl p-6 text-ghost-100 z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ghost-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-spectral-cyan/15 border border-spectral-cyan/30 flex items-center justify-center text-spectral-cyan">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ghost-100">Crear Estancia</h3>
                  <p className="text-xs text-ghost-400">Selecciona entre todas las versiones oficiales de Minecraft</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-ghost-400 hover:text-ghost-200 hover:bg-ghost-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Instance Name */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-ghost-400 mb-1 font-mono">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Hardcore 1.21, Create Modpack, Servidor Privado..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-xs text-ghost-100 transition-colors"
                />
              </div>

              {/* Version Filters and Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-ghost-400 font-mono">
                    Versión de Minecraft ({filteredVersions.length} disponibles)
                  </label>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setVersionTypeFilter('release')}
                      className={`px-2 py-0.5 rounded ${
                        versionTypeFilter === 'release'
                          ? 'bg-spectral-cyan/20 text-spectral-cyan font-bold'
                          : 'text-ghost-400 hover:text-ghost-200'
                      }`}
                    >
                      Releases
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionTypeFilter('snapshot')}
                      className={`px-2 py-0.5 rounded ${
                        versionTypeFilter === 'snapshot'
                          ? 'bg-spectral-cyan/20 text-spectral-cyan font-bold'
                          : 'text-ghost-400 hover:text-ghost-200'
                      }`}
                    >
                      Snapshots
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionTypeFilter('all')}
                      className={`px-2 py-0.5 rounded ${
                        versionTypeFilter === 'all'
                          ? 'bg-spectral-cyan/20 text-spectral-cyan font-bold'
                          : 'text-ghost-400 hover:text-ghost-200'
                      }`}
                    >
                      Todas
                    </button>
                  </div>
                </div>

                <select
                  value={mcVersion}
                  onChange={(e) => setMcVersion(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-xs text-ghost-100 transition-colors font-mono max-h-48"
                >
                  {filteredVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} ({v.type}) {v.releaseTime ? `• ${v.releaseTime.split('T')[0]}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Loader Grid */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-ghost-400 mb-1.5 font-mono">
                  Mod Loader
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {loaderOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLoader(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        loader === opt.id
                          ? 'bg-ghost-800 border-spectral-cyan text-ghost-100 shadow-sm'
                          : 'bg-ghost-850/60 border-ghost-750 text-ghost-400 hover:border-ghost-700'
                      }`}
                    >
                      <div className="font-semibold text-xs capitalize">{opt.label}</div>
                      <div className="text-[10px] text-ghost-400 truncate">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* RAM slider */}
              <div className="p-3.5 rounded-xl bg-ghost-850 border border-ghost-750">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-ghost-300">
                    <Cpu className="w-3.5 h-3.5 text-spectral-cyan" />
                    Memoria RAM Máxima
                  </span>
                  <span className="font-mono font-bold text-spectral-mint">{ramGb} GB</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={ramGb}
                  onChange={(e) => setRamGb(Number(e.target.value))}
                  className="w-full accent-spectral-cyan cursor-pointer"
                />
              </div>

              {/* Advanced Settings Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-ghost-400 hover:text-ghost-200 transition-colors font-mono"
                >
                  <Sliders className="w-3.5 h-3.5 text-spectral-cyan" />
                  <span>Ajustes Avanzados (JVM Flags, Comandos Pre-Launch)</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                </button>

                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-3 pt-3 border-t border-ghost-800"
                  >
                    <div>
                      <label className="block text-[11px] font-mono text-ghost-400 mb-1">
                        Argumentos JVM Adicionales
                      </label>
                      <input
                        type="text"
                        value={jvmArgs}
                        onChange={(e) => setJvmArgs(e.target.value)}
                        placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
                        className="w-full px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-700 text-xs font-mono text-ghost-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-ghost-400 mb-1">
                        Comando Pre-Ejecución (Hook antes de abrir Java)
                      </label>
                      <input
                        type="text"
                        value={preLaunchCmd}
                        onChange={(e) => setPreLaunchCmd(e.target.value)}
                        placeholder="ej. mangohud, gamemoderun, optirun"
                        className="w-full px-3 py-1.5 rounded-lg bg-ghost-850 border border-ghost-700 text-xs font-mono text-ghost-200"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ghost-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-ghost-400 hover:text-ghost-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-5 py-2 rounded-xl bg-spectral-cyan hover:bg-spectral-cyan/90 text-ghost-950 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creando...' : 'Crear Estancia'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
