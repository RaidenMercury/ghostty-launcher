import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Cpu } from 'lucide-react';
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
  const [loader, setLoader] = useState<'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'>('fabric');
  const [ramGb, setRamGb] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loaderOptions = [
    { id: 'fabric', label: 'Fabric', desc: 'Rápido, ligero, ideal para mods modernos' },
    { id: 'neoforge', label: 'NeoForge', desc: 'El sucesor moderno de Forge' },
    { id: 'forge', label: 'Forge', desc: 'El modloader clásico con soporte histórico' },
    { id: 'quilt', label: 'Quilt', desc: 'Fork comunitario avanzado de Fabric' },
    { id: 'vanilla', label: 'Vanilla', desc: 'Minecraft puro sin modificaciones' },
  ];

  const availableVersions = manifest?.versions
    .filter((v) => v.type === 'release')
    .slice(0, 30) || [
    { id: '1.21.4', type: 'release', releaseTime: '2024-12-03', time: '', url: '' },
    { id: '1.21.1', type: 'release', releaseTime: '2024-08-08', time: '', url: '' },
    { id: '1.20.1', type: 'release', releaseTime: '2023-06-12', time: '', url: '' },
    { id: '1.19.4', type: 'release', releaseTime: '2023-03-14', time: '', url: '' },
    { id: '1.16.5', type: 'release', releaseTime: '2021-01-15', time: '', url: '' },
    { id: '1.12.2', type: 'release', releaseTime: '2017-09-18', time: '', url: '' },
  ];

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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ghost-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative w-full max-w-xl rounded-3xl bg-ghost-900 border border-ghost-700/80 shadow-2xl p-6 text-ghost-100 z-10 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ghost-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-spectral-cyan/15 border border-spectral-cyan/30 flex items-center justify-center text-spectral-cyan">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ghost-100">Crear Nueva Estancia</h3>
                  <p className="text-xs text-ghost-400">Configura tu perfil de Minecraft Java</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-ghost-400 hover:text-ghost-200 hover:bg-ghost-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {/* Instance Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ghost-300 mb-1.5 font-mono">
                  Nombre de la Estancia
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Survival 1.21 Mods, Pixelmon, Hardcore..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-sm text-ghost-100 transition-colors"
                />
              </div>

              {/* Version & Loader Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Version Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ghost-300 mb-1.5 font-mono">
                    Versión de Minecraft
                  </label>
                  <select
                    value={mcVersion}
                    onChange={(e) => setMcVersion(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-sm text-ghost-100 transition-colors font-mono"
                  >
                    {availableVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id} (Release)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mod Loader Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ghost-300 mb-1.5 font-mono">
                    Mod Loader
                  </label>
                  <select
                    value={loader}
                    onChange={(e) => setLoader(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-sm text-ghost-100 transition-colors uppercase font-mono font-medium"
                  >
                    {loaderOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RAM Allocation Slider */}
              <div className="p-4 rounded-2xl bg-ghost-850/80 border border-ghost-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-ghost-300">
                    <Cpu className="w-4 h-4 text-spectral-cyan" />
                    <span>ASIGNACIÓN DE MEMORIA RAM</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-spectral-mint">{ramGb} GB</span>
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
                <div className="flex justify-between text-[10px] font-mono text-ghost-500 mt-1">
                  <span>2 GB (Mínimo)</span>
                  <span>4-8 GB (Recomendado)</span>
                  <span>16 GB (Extremo)</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-ghost-400 hover:text-ghost-200 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-spectral-cyan to-spectral-mint text-ghost-950 font-bold text-xs uppercase tracking-wider shadow-lg glow-cyan disabled:opacity-50"
                >
                  {isSubmitting ? 'Creando...' : 'Crear Estancia'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
