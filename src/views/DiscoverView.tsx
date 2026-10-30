import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Check, Sparkles, Filter, ExternalLink, ArrowUpDown } from 'lucide-react';
import { ModrinthSearchHit, Instance, ModContentType } from '../types';
import { api } from '../services/api';

interface DiscoverViewProps {
  activeInstance: Instance | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

export function DiscoverView({ activeInstance, onShowToast }: DiscoverViewProps) {
  const [query, setQuery] = useState('');
  const [contentType, setContentType] = useState<ModContentType>('mod');
  const [loaderFilter, setLoaderFilter] = useState<string>(activeInstance?.loader || 'all');
  const [versionFilter, setVersionFilter] = useState<string>(activeInstance?.mc_version || 'all');
  const [sortBy, setSortBy] = useState<'relevance' | 'downloads' | 'follows' | 'updated'>('downloads');
  const [results, setResults] = useState<ModrinthSearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOffset(0);
    handleSearch(0);
  }, [contentType, loaderFilter, versionFilter, sortBy]);

  const handleSearch = async (currentOffset: number = 0) => {
    try {
      setLoading(true);
      const res = await api.searchModrinth(
        query,
        loaderFilter,
        versionFilter,
        contentType,
        24,
        currentOffset,
        sortBy
      );
      if (currentOffset === 0) {
        setResults(res.hits);
      } else {
        setResults((prev) => [...prev, ...res.hits]);
      }
      setTotalHits(res.total_hits);
      setOffset(currentOffset);
    } catch (e: any) {
      onShowToast('error', 'Error en búsqueda Modrinth', e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(offset + 24);
  };

  const handleInstall = async (hit: ModrinthSearchHit) => {
    if (!activeInstance) {
      onShowToast('warning', 'Sin estancia seleccionada', 'Selecciona una estancia para instalar este elemento.');
      return;
    }

    try {
      setInstallingId(hit.project_id);
      const versions = await api.getModrinthVersions(
        hit.project_id,
        activeInstance.loader,
        activeInstance.mc_version
      );

      if (!versions || versions.length === 0 || !versions[0].files.length) {
        onShowToast('warning', 'Versión no encontrada', `No hay archivo compatible con ${activeInstance.loader} en ${activeInstance.mc_version}.`);
        return;
      }

      const file = versions[0].files[0];
      await api.installModrinthMod(activeInstance.id, file.url, file.filename);

      setInstalledMap((prev) => ({ ...prev, [hit.project_id]: true }));
      onShowToast('success', 'Instalación exitosa', `${hit.title} (${file.filename}) añadido a ${activeInstance.name}.`);
    } catch (e: any) {
      onShowToast('error', 'Error instalando', e.toString());
    } finally {
      setInstallingId(null);
    }
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const contentTypes: { id: ModContentType; label: string }[] = [
    { id: 'mod', label: 'Mods' },
    { id: 'modpack', label: 'Modpacks' },
    { id: 'resourcepack', label: 'Resource Packs' },
    { id: 'shader', label: 'Shaders' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-ghost-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ghost-100">
              Descubrir en Vivo
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-ghost-850 text-ghost-300 border border-ghost-750">
              {totalHits.toLocaleString()} resultados en Modrinth
            </span>
          </div>
          <p className="text-xs text-ghost-400 mt-0.5">
            Explora la base de datos oficial completa de mods, modpacks, shaders y resource packs.
          </p>
        </div>

        {/* Content Type Selector */}
        <div className="flex p-1 rounded-xl bg-ghost-850 border border-ghost-750 text-xs font-medium">
          {contentTypes.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setContentType(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                contentType === tab.id
                  ? 'bg-ghost-800 text-spectral-cyan font-semibold shadow-sm'
                  : 'text-ghost-400 hover:text-ghost-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-ghost-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Buscar ${contentType}... (ej. Sodium, JEI, Complementary, Create)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(0)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-ghost-850/90 border border-ghost-750 text-xs text-ghost-100 placeholder-ghost-500 focus:outline-none focus:border-spectral-cyan transition-colors"
          />
        </div>

        {/* Sort Order */}
        <div className="flex items-center gap-1.5 bg-ghost-850 px-2.5 py-1.5 rounded-xl border border-ghost-750 text-xs font-mono">
          <ArrowUpDown className="w-3.5 h-3.5 text-spectral-cyan" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-ghost-300 font-medium focus:outline-none cursor-pointer"
          >
            <option value="downloads">Más Descargados</option>
            <option value="relevance">Relevancia</option>
            <option value="updated">Actualizados</option>
            <option value="follows">Más Seguidos</option>
          </select>
        </div>

        {/* Loader Filter */}
        {(contentType === 'mod' || contentType === 'modpack') && (
          <div className="flex items-center gap-1.5 bg-ghost-850 px-2.5 py-1.5 rounded-xl border border-ghost-750 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-spectral-cyan" />
            <select
              value={loaderFilter}
              onChange={(e) => setLoaderFilter(e.target.value)}
              className="bg-transparent text-ghost-300 font-medium uppercase focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los Loaders</option>
              <option value="fabric">Fabric</option>
              <option value="neoforge">NeoForge</option>
              <option value="forge">Forge</option>
              <option value="quilt">Quilt</option>
            </select>
          </div>
        )}

        {/* Version Filter */}
        <div className="bg-ghost-850 px-2.5 py-1.5 rounded-xl border border-ghost-750 text-xs font-mono">
          <select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            className="bg-transparent text-ghost-300 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las Versiones</option>
            <option value="1.21.4">1.21.4</option>
            <option value="1.21.1">1.21.1</option>
            <option value="1.20.4">1.20.4</option>
            <option value="1.20.1">1.20.1</option>
            <option value="1.19.4">1.19.4</option>
            <option value="1.19.2">1.19.2</option>
            <option value="1.18.2">1.18.2</option>
            <option value="1.16.5">1.16.5</option>
            <option value="1.12.2">1.12.2</option>
            <option value="1.7.10">1.7.10</option>
          </select>
        </div>

        <button
          onClick={() => handleSearch(0)}
          className="px-4 py-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-semibold text-ghost-200 transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Target Active Instance indicator */}
      {activeInstance && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-ghost-850/50 border border-ghost-800 text-xs font-mono">
          <div className="text-ghost-400">
            Destino de instalación:{' '}
            <span className="font-semibold text-ghost-200">{activeInstance.name}</span>{' '}
            <span className="text-spectral-cyan">({activeInstance.loader} {activeInstance.mc_version})</span>
          </div>
          <span className="text-spectral-mint font-semibold text-[11px]">Enlace activo</span>
        </div>
      )}

      {/* Results Grid */}
      {loading && results.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-6 h-6 border-2 border-spectral-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-ghost-400 font-mono">Cargando catálogo en vivo de Modrinth...</p>
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((hit) => {
              const isInstalled = installedMap[hit.project_id];
              const isThisInstalling = installingId === hit.project_id;

              return (
                <motion.div
                  key={hit.project_id}
                  layout
                  className="rounded-2xl p-4 bg-ghost-900/90 border border-ghost-800 hover:border-ghost-700 hover:bg-ghost-850/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="w-10 h-10 rounded-xl bg-ghost-850 border border-ghost-750 overflow-hidden shrink-0 flex items-center justify-center">
                        {hit.icon_url ? (
                          <img src={hit.icon_url} alt={hit.title} className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-spectral-cyan" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-xs text-ghost-100 truncate">{hit.title}</h3>
                          <a
                            href={`https://modrinth.com/${hit.project_type}/${hit.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-ghost-500 hover:text-ghost-300 p-0.5"
                            title="Ver en Modrinth"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-[10px] text-ghost-400 font-mono">por {hit.author}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-ghost-400 line-clamp-2 leading-relaxed mb-3">
                      {hit.description}
                    </p>

                    {/* Categories */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {hit.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-ghost-850 text-ghost-400 border border-ghost-800"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Bar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-ghost-800">
                    <span className="flex items-center gap-1 text-[11px] font-mono text-ghost-400">
                      <Download className="w-3.5 h-3.5 text-ghost-500" />
                      {formatDownloads(hit.downloads)}
                    </span>

                    <button
                      onClick={() => handleInstall(hit)}
                      disabled={isThisInstalling || isInstalled}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                        isInstalled
                          ? 'bg-spectral-mint/20 text-spectral-mint border border-spectral-mint/40 cursor-default'
                          : 'bg-spectral-cyan hover:bg-spectral-cyan/90 text-ghost-950 font-bold'
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
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Load More Button */}
          {results.length < totalHits && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-ghost-850 hover:bg-ghost-800 border border-ghost-750 text-xs font-semibold text-ghost-200 transition-colors"
              >
                {loading ? 'Cargando más...' : 'Cargar más resultados'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center rounded-2xl border border-dashed border-ghost-800 bg-ghost-900/20 p-8">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-ghost-500" />
          <h3 className="font-semibold text-xs text-ghost-200">No se encontraron resultados</h3>
          <p className="text-[11px] text-ghost-400 mt-1">
            Prueba a cambiar el término de búsqueda o selecciona "Todas las Versiones".
          </p>
        </div>
      )}
    </div>
  );
}
