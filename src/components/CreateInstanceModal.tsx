import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Plus } from 'lucide-react';
import { CreateInstancePayload, MojangManifest } from '../types';
import { AccordionSection } from './AccordionSection';
import { InstanceIcon } from './InstanceIcon';
import { GlassSelect } from './GlassSelect';

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
  const [loader, setLoader] = useState<'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge'>('fabric');
  const [ramGb, setRamGb] = useState(4);
  const [icon] = useState('minecraft');
  const [jvmArgs, setJvmArgs] = useState('-XX:+UseG1GC -XX:+ParallelRefProcEnabled');
  const [preLaunchCmd, setPreLaunchCmd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (manifest?.latest?.release) {
      setMcVersion(manifest.latest.release);
    }
  }, [manifest]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loaderOptions = [
    { id: 'fabric', label: 'Fabric', desc: 'Ligero y modular' },
    { id: 'neoforge', label: 'NeoForge', desc: 'Modding moderno' },
    { id: 'forge', label: 'Forge', desc: 'Clásico compatible' },
    { id: 'quilt', label: 'Quilt', desc: 'Comunitario' },
    { id: 'vanilla', label: 'Vanilla', desc: 'Oficial puro' },
  ];

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
        icon,
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
          <div
            onClick={onClose}
            className="fixed inset-0 modal-scrim"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto glass-panel-strong p-6 text-ghost-100 z-10"
          >
            
            <div className="flex items-center justify-between pb-4 border-b glass-divider">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-control bg-black/25 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                  <InstanceIcon icon="minecraft" />
                </div>
                <div>
                  <h3 className="heading-display text-2xl font-extrabold text-ghost-50">
                    NUEVA ESTANCIA DE MINECRAFT
                  </h3>
                  <p className="text-xs text-ghost-400">
                    Configura versión oficial, Mod Loader y memoria inicial
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              
              <div>
                <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                  Nombre de la Estancia
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ej. Survival Técnico 1.21, Mundo Hardcore..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 glass-control text-xs placeholder:text-ghost-400"
                />
              </div>

              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono text-ghost-300 tabular-nums">
                    Versión de Minecraft ({filteredVersions.length} disponibles)
                  </label>
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    {(['release', 'snapshot', 'all'] as const).map((filterType) => (
                      <button
                        key={filterType}
                        type="button"
                        onClick={() => setVersionTypeFilter(filterType)}
                        className={`btn-tactile px-2 py-0.5 rounded-full transition-colors ${
                          versionTypeFilter === filterType
                            ? 'accent-bg text-white font-semibold'
                            : 'text-ghost-400 hover:text-ghost-200'
                        }`}
                      >
                        {filterType === 'release'
                          ? 'Releases'
                          : filterType === 'snapshot'
                          ? 'Snapshots'
                          : 'Todas'}
                      </button>
                    ))}
                  </div>
                </div>

                <GlassSelect
                  value={mcVersion}
                  onChange={setMcVersion}
                  className="w-full"
                  popoverWidth="w-full"
                  options={[
                    ...(!filteredVersions.some((v) => v.id === '26.3')
                      ? [{ value: '26.3', label: '26.3 (release)' }]
                      : []),
                    ...filteredVersions.map((v) => ({
                      value: v.id,
                      label: `${v.id} (${v.type})`,
                      sublabel: v.releaseTime ? `Lanzado: ${v.releaseTime.split('T')[0]}` : undefined,
                      badge: v.type === 'release' ? 'Release' : v.type,
                    })),
                  ]}
                />
              </div>

              
              <div>
                <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                  Mod Loader
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {loaderOptions.map((opt) => {
                    const active = loader === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLoader(opt.id as any)}
                        className={`btn-tactile p-2.5 rounded-control text-left border transition-colors ${
                          active
                            ? 'accent-pill-tint font-semibold'
                            : 'glass-control text-ghost-300 hover:text-ghost-50'
                        }`}
                      >
                        <div className="text-xs font-semibold capitalize">{opt.label}</div>
                        <div className="text-[10px] opacity-75 truncate">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              
              <div className="pt-2 border-t glass-divider space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-ghost-200 font-medium">
                    <Cpu className="w-3.5 h-3.5 accent-text" />
                    Memoria RAM Asignada
                  </span>
                  <span className="font-mono font-bold accent-text tabular-nums">
                    {ramGb} GB ({ramGb * 1024} MB)
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={ramGb}
                  onChange={(e) => setRamGb(Number(e.target.value))}
                  className="w-full accent-[var(--accent)] cursor-pointer"
                />
              </div>

              
              <AccordionSection
                title="Opciones Avanzadas (Flags JVM y Hook)"
                defaultOpen={false}
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono text-ghost-400 mb-1">
                      Argumentos JVM
                    </label>
                    <input
                      type="text"
                      value={jvmArgs}
                      onChange={(e) => setJvmArgs(e.target.value)}
                      className="w-full px-3 py-1.5 glass-control text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-ghost-400 mb-1">
                      Comando Pre-Lanzamiento
                    </label>
                    <input
                      type="text"
                      value={preLaunchCmd}
                      onChange={(e) => setPreLaunchCmd(e.target.value)}
                      placeholder="ej. gamemoderun, mangohud"
                      className="w-full px-3 py-1.5 glass-control text-xs font-mono"
                    />
                  </div>
                </div>
              </AccordionSection>

              
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t glass-divider">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-tactile px-4 py-2 glass-control text-xs font-medium text-ghost-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="btn-tactile flex items-center gap-1.5 px-5 py-2 rounded-control accent-bg text-white font-semibold text-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Creando...' : 'Crear Estancia'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
