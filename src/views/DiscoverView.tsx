import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Check, Sparkles, Filter, ExternalLink, Heart } from 'lucide-react';
import { ModrinthSearchHit, Instance } from '../types';
import { api } from '../services/api';

interface DiscoverViewProps {
  activeInstance: Instance | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

export function DiscoverView({ activeInstance, onShowToast }: DiscoverViewProps) {
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'mod' | 'modpack'>('mod');
  const [loaderFilter, setLoaderFilter] = useState<string>(activeInstance?.loader || 'fabric');
  const [versionFilter, setVersionFilter] = useState<string>(activeInstance?.mc_version || '1.21.4');
  const [results, setResults] = useState<ModrinthSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    handleSearch();
  }, [projectType, loaderFilter, versionFilter]);

  const handleSearch = async () => {
    try {
      setLoading(true);
      const res = await api.searchModrinth(
        query,
        loaderFilter,
        versionFilter,
        projectType,
        24,
        0
      );
      setResults(res.hits);
    } catch (e: any) {
      onShowToast('error', 'Error en búsqueda Modrinth', e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (hit: ModrinthSearchHit) => {
    if (!activeInstance) {
      onShowToast('warning', 'Selecciona una estancia', 'Debes tener una estancia seleccionada para instalar mods.');
      return;
    }

    try {
      setInstallingId(hit.project_id);
      // Fetch latest compatible version files
      const versions = await api.getModrinthVersions(
        hit.project_id,
        activeInstance.loader,
        activeInstance.mc_version
      );

      if (!versions || versions.length === 0 || !versions[0].files.length) {
        onShowToast('warning', 'Sin versión compatible', `No se encontró archivo para ${activeInstance.loader} en ${activeInstance.mc_version}.`);
        return;
      }

      const file = versions[0].files[0];
      await api.installModrinthMod(activeInstance.id, file.url, file.filename);

      setInstalledMap((prev) => ({ ...prev, [hit.project_id]: true }));
      onShowToast('success', 'Mod Instalado', `${hit.title} (${file.filename}) añadido a ${activeInstance.name}.`);
    } catch (e: any) {
      onShowToast('error', 'Error al instalar', e.toString());
    } finally {
      setInstallingId(null);
    }
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-ghost-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-ghost-100">
              Descubrir en Modrinth
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-spectral-cyan/15 text-spectral-cyan border border-spectral-cyan/30">
              API v2 Oficial
            </span>
          </div>
          <p className="text-xs text-ghost-400 mt-1">
            Explora e instala miles de mods, shaders y modpacks con un solo clic en tu estancia activa.
          </p>
        </div>

        {/* Project Type Switcher */}
        <div className="flex p-1 rounded-xl bg-ghost-850 border border-ghost-800 text-xs font-medium">
          <button
            onClick={() => setProjectType('mod')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              projectType === 'mod'
                ? 'bg-ghost-800 text-spectral-cyan font-bold shadow-sm'
                : 'text-ghost-400 hover:text-ghost-200'
            }`}
          >
            Mods
          </button>
          <button
            onClick={() => setProjectType('modpack')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              projectType === 'modpack'
                ? 'bg-ghost-800 text-spectral-cyan font-bold shadow-sm'
                : 'text-ghost-400 hover:text-ghost-200'
            }`}
          >
            Modpacks
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-ghost-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, autor o descripción (ej. Sodium, JEI, Iris)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-ghost-850/90 border border-ghost-750 text-xs text-ghost-100 placeholder-ghost-500 focus:outline-none focus:border-spectral-cyan transition-colors"
          />
        </div>

        {/* Loader Select */}
        <div className="flex items-center gap-2 bg-ghost-850 px-3 py-1.5 rounded-2xl border border-ghost-750 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-spectral-cyan" />
          <select
            value={loaderFilter}
            onChange={(e) => setLoaderFilter(e.target.value)}
            className="bg-transparent text-ghost-200 uppercase font-semibold focus:outline-none cursor-pointer"
          >
            <option value="fabric">Fabric</option>
            <option value="neoforge">NeoForge</option>
            <option value="forge">Forge</option>
            <option value="quilt">Quilt</option>
          </select>
        </div>

        {/* Version Select */}
        <div className="bg-ghost-850 px-3 py-1.5 rounded-2xl border border-ghost-750 text-xs font-mono">
          <select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            className="bg-transparent text-ghost-200 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="1.21.4">1.21.4</option>
            <option value="1.21.1">1.21.1</option>
            <option value="1.20.1">1.20.1</option>
            <option value="1.19.4">1.19.4</option>
            <option value="1.16.5">1.16.5</option>
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 rounded-2xl bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-bold text-ghost-100 transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Target Instance Indicator */}
      {activeInstance && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-ghost-850/60 border border-ghost-800 text-xs font-mono">
          <div className="flex items-center gap-2 text-ghost-400">
            <span>Instalando directamente en:</span>
            <span className="font-bold text-ghost-200">{activeInstance.name}</span>
            <span className="text-spectral-cyan">({activeInstance.loader} {activeInstance.mc_version})</span>
          </div>
          <span className="text-spectral-mint font-semibold">Listo</span>
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-spectral-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-ghost-400 font-mono">Consultando repositorio de Modrinth...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {results.map((hit) => {
            const isInstalled = installedMap[hit.project_id];
            const isThisInstalling = installingId === hit.project_id;

            return (
              <motion.div
                key={hit.project_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl p-5 bg-ghost-900/80 border border-ghost-800/80 hover:border-ghost-700 hover:bg-ghost-850/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Icon, Title, Author */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-ghost-850 border border-ghost-750 overflow-hidden shrink-0 flex items-center justify-center">
                      {hit.icon_url ? (
                        <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                      ) : (
                        <Sparkles className="w-6 h-6 text-spectral-cyan" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-ghost-100 truncate">{hit.title}</h3>
                        <a
                          href={`https://modrinth.com/${hit.project_type}/${hit.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ghost-500 hover:text-ghost-300 transition-colors p-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-[11px] text-ghost-400">por {hit.author}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-ghost-400 line-clamp-2 leading-relaxed mb-4">
                    {hit.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {hit.categories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-md bg-ghost-800 text-ghost-400 border border-ghost-700/60"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom stats and install button */}
                <div className="flex items-center justify-between pt-3 border-t border-ghost-800/80">
                  <div className="flex items-center gap-3 text-[11px] font-mono text-ghost-500">
                    <span className="flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 text-ghost-400" />
                      {formatDownloads(hit.downloads)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-spectral-rose/80" />
                      {hit.follows}
                    </span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleInstall(hit)}
                    disabled={isThisInstalling || isInstalled}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm ${
                      isInstalled
                        ? 'bg-spectral-mint/20 text-spectral-mint border border-spectral-mint/40 cursor-default'
                        : 'bg-spectral-cyan text-ghost-950 glow-cyan hover:opacity-95'
                    }`}
                  >
                    {isThisInstalling ? (
                      <div className="w-3 h-3 border-2 border-ghost-950 border-t-transparent rounded-full animate-spin" />
                    ) : isInstalled ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Instalado</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Instalar</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center rounded-3xl border border-dashed border-ghost-800 bg-ghost-900/40 p-8">
          <Sparkles className="w-10 h-10 mx-auto mb-2 text-ghost-500" />
          <h3 className="font-bold text-sm text-ghost-200">No se encontraron resultados</h3>
          <p className="text-xs text-ghost-400 mt-1">
            Intenta cambiar los filtros de versión o mod loader arriba.
          </p>
        </div>
      )}
    </div>
  );
}
