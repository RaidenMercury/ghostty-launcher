import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Play, Layers, Package, Clock, Cpu, Trash2, Download, Search } from 'lucide-react';
import { Instance } from '../types';

interface InstancesViewProps {
  instances: Instance[];
  activeInstance: Instance | null;
  onSelectInstance: (instance: Instance) => void;
  onOpenCreate: () => void;
  onOpenMods: (instance: Instance) => void;
  onLaunch: (instance: Instance) => void;
  onDeleteInstance: (id: string) => void;
  onExportInstance: (id: string) => void;
  isLaunching: boolean;
}

export function InstancesView({
  instances,
  activeInstance,
  onSelectInstance,
  onOpenCreate,
  onOpenMods,
  onLaunch,
  onDeleteInstance,
  onExportInstance,
  isLaunching,
}: InstancesViewProps) {
  const [filter, setFilter] = useState('');

  const filteredInstances = instances.filter(
    (i) =>
      i.name.toLowerCase().includes(filter.toLowerCase()) ||
      i.mc_version.toLowerCase().includes(filter.toLowerCase()) ||
      i.loader.toLowerCase().includes(filter.toLowerCase())
  );

  const getLoaderColor = (loader: string) => {
    switch (loader.toLowerCase()) {
      case 'fabric':
        return 'bg-spectral-cyan/15 text-spectral-cyan border-spectral-cyan/30';
      case 'neoforge':
        return 'bg-spectral-amber/15 text-spectral-amber border-spectral-amber/30';
      case 'forge':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'quilt':
        return 'bg-indigo-400/15 text-indigo-300 border-indigo-400/30';
      default:
        return 'bg-spectral-mint/15 text-spectral-mint border-spectral-mint/30';
    }
  };

  const formatPlaytime = (seconds: number) => {
    if (!seconds) return 'Sin jugar';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none">
      {/* Editorial Header / Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-ghost-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-ghost-100">
              Estancias de Juego
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-ghost-800 text-ghost-400 border border-ghost-700">
              {instances.length} Perfiles
            </span>
          </div>
          <p className="text-xs text-ghost-400 mt-1">
            Administra tus instancias de Minecraft con aislamiento total de configuraciones y mods.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filter Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ghost-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar estancia..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-ghost-850/80 border border-ghost-800 text-xs text-ghost-100 placeholder-ghost-500 focus:outline-none focus:border-spectral-cyan transition-colors"
            />
          </div>

          {/* New Instance Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-spectral-cyan text-ghost-950 font-bold text-xs uppercase tracking-wider shadow-lg glow-cyan hover:opacity-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Estancia</span>
          </motion.button>
        </div>
      </div>

      {/* Grid of Instances */}
      {filteredInstances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredInstances.map((instance) => {
            const isSelected = activeInstance?.id === instance.id;

            return (
              <motion.div
                key={instance.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onSelectInstance(instance)}
                className={`relative rounded-3xl p-5 border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-ghost-850/95 border-spectral-cyan/60 shadow-[0_12px_35px_-10px_rgba(56,189,248,0.25)]'
                    : 'bg-ghost-900/80 border-ghost-800/80 hover:border-ghost-700 hover:bg-ghost-850/50'
                }`}
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-lg border ${getLoaderColor(
                        instance.loader
                      )}`}
                    >
                      {instance.loader}
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-ghost-300 bg-ghost-800 px-2 py-0.5 rounded-lg border border-ghost-700/60">
                      v{instance.mc_version}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="text-[10px] uppercase font-mono font-bold text-spectral-mint flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-spectral-mint animate-pulse" />
                      Activa
                    </span>
                  )}
                </div>

                {/* Instance Name & Icon */}
                <div className="flex items-start gap-3.5 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-ghost-800 border border-ghost-700/60 flex items-center justify-center p-2 shrink-0">
                    <img src="/ghostty.svg" alt="icon" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-ghost-100 truncate">{instance.name}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-ghost-400 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-ghost-500" />
                        {formatPlaytime(instance.total_playtime_secs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-spectral-cyan" />
                        {Math.round(instance.memory_max_mb / 1024)} GB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-ghost-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      title="Ver mods instalados"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMods(instance);
                      }}
                      className="p-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 text-ghost-300 hover:text-spectral-cyan transition-colors"
                    >
                      <Package className="w-4 h-4" />
                    </button>
                    <button
                      title="Exportar estancia a Zip"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportInstance(instance.id);
                      }}
                      className="p-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 text-ghost-300 hover:text-ghost-100 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      title="Eliminar estancia"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteInstance(instance.id);
                      }}
                      className="p-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 text-ghost-400 hover:text-spectral-rose transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunch(instance);
                    }}
                    disabled={isLaunching}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-spectral-cyan to-spectral-mint text-ghost-950 font-bold text-xs uppercase tracking-wider shadow-md hover:opacity-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Jugar</span>
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="py-20 text-center rounded-3xl border border-dashed border-ghost-800 bg-ghost-900/40 p-8">
          <div className="w-14 h-14 rounded-3xl bg-ghost-850 mx-auto flex items-center justify-center text-ghost-500 mb-3 border border-ghost-800">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-ghost-200">No hay estancias que coincidan</h3>
          <p className="text-xs text-ghost-400 mt-1 max-w-sm mx-auto">
            Crea una nueva estancia para empezar a jugar o ajusta los términos de búsqueda.
          </p>
          <button
            onClick={onOpenCreate}
            className="mt-5 px-5 py-2.5 rounded-xl bg-spectral-cyan text-ghost-950 font-bold text-xs uppercase tracking-wider shadow-md"
          >
            Crear Estancia Ahora
          </button>
        </div>
      )}
    </div>
  );
}

