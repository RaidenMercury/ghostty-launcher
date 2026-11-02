import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWindowedList } from '../hooks/useWindowedList';
import {
  Search,
  Download,
  Layers,
  Box,
  Image,
  SunMedium,
  Eye,
  Sparkles,
  SlidersHorizontal,
  FileText,
  Globe,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { ModrinthSearchHit, Instance, MojangManifest, ModProvider } from '../types';
import { api } from '../services/api';
import { VersionSelectorModal } from '../components/VersionSelectorModal';
import { triggerInstallSuccessConfetti } from '../utils/confetti';
import { SpotlightCard } from '../components/SpotlightCard';
import { GhosttyMascot } from '../components/GhosttyMascot';
import { GlassSelect } from '../components/GlassSelect';
import { useI18n } from '../utils/i18n';

interface DiscoverViewProps {
  activeInstance: Instance | null;
  manifest: MojangManifest | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
  onModpackInstalled: (instance: Instance) => void;
  onStartDownloadActivity?: (title: string) => void;
  onEndDownloadActivity?: () => void;
}

type ProjectTypeFilter = 'mod' | 'modpack' | 'resourcepack' | 'shader';

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  activeInstance,
  manifest,
  onShowToast,
  onModpackInstalled,
  onStartDownloadActivity,
  onEndDownloadActivity,
}) => {
  const { t, language } = useI18n();
  const [provider, setProvider] = useState<ModProvider>('modrinth');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalHits, setTotalHits] = useState(0);

  const [gameVersion, setGameVersion] = useState<string>(activeInstance?.mc_version || 'all');
  const [loader, setLoader] = useState<string>(activeInstance?.loader || 'all');
  const [sortBy, setSortBy] = useState<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'>('downloads');
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const [selectedHitForModal, setSelectedHitForModal] = useState<ModrinthSearchHit | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'details' | 'versions'>('versions');

  useEffect(() => {
    if (activeInstance) {
      setGameVersion(activeInstance.mc_version);
      setLoader(activeInstance.loader);
    }
  }, [activeInstance]);

  useEffect(() => {
    if (provider === 'ftb' && projectType !== 'modpack') {
      setProjectType('modpack');
    }
  }, [provider]);

  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      executeSearch();
    }, 220);
    return () => clearTimeout(delayDebounce);
  }, [query, projectType, gameVersion, loader, sortBy, provider]);

  const executeSearch = async () => {
    try {
      setLoading(true);
      const res = await api.searchModrinth(
        query.trim(),
        loader === 'all' ? undefined : loader,
        gameVersion === 'all' ? undefined : gameVersion,
        projectType,
        48,
        0,
        sortBy,
        provider
      );
      setHits(res.hits || []);
      setTotalHits(res.total_hits || 0);
    } catch (e: any) {
      console.warn('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || hits.length >= totalHits) return;
    try {
      setLoadingMore(true);
      const res = await api.searchModrinth(
        query.trim(),
        loader === 'all' ? undefined : loader,
        gameVersion === 'all' ? undefined : gameVersion,
        projectType,
        36,
        hits.length,
        sortBy,
        provider
      );
      if (res.hits && res.hits.length > 0) {
        setHits((prev) => [...prev, ...res.hits]);
      }
    } catch (e: any) {
      console.warn('Load more error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const manifestVersions = (manifest?.versions || []).filter(
    (v) => showSnapshots || v.type === 'release'
  );

  const openHitModal = (hit: ModrinthSearchHit, tab: 'details' | 'versions') => {
    setModalInitialTab(tab);
    setSelectedHitForModal(hit);
  };

  const handleInstallLatest = async (hit: ModrinthSearchHit) => {
    try {
      onStartDownloadActivity?.(`Instalando ${hit.title}`);
      if (hit.project_type === 'modpack') {
        onShowToast('info', 'Creando Estancia de Modpack', `Descargando perfil ${hit.title}...`);
        const versions = await api.getModrinthVersions(hit.project_id);
        const latest = versions[0];
        if (!latest || !latest.files.length) {
          throw new Error('No se encontraron archivos descargables para este modpack.');
        }
        const primaryFile = latest.files.find((f) => f.primary) || latest.files[0];
        const newInst = await api.installOnlineModpack(
          primaryFile.url,
          hit.title,
          hit.icon_url || undefined
        );
        triggerInstallSuccessConfetti();
        onShowToast('success', 'Modpack Instalado', `Se creó la estancia "${newInst.name}".`);
        onModpackInstalled(newInst);
      } else {
        if (!activeInstance) {
          onShowToast('warning', 'Selecciona una estancia', 'Elige una estancia para instalar este recurso.');
          return;
        }
        onShowToast('info', 'Descargando recurso', `Instalando ${hit.title} en ${activeInstance.name}...`);
        const versions = await api.getModrinthVersions(hit.project_id);
        const match =
          versions.find((v) => {
            const matchLoader = v.loaders.includes(activeInstance.loader.toLowerCase());
            const matchVer = v.game_versions.includes(activeInstance.mc_version);
            return matchLoader && matchVer;
          }) || versions[0];

        if (!match || !match.files.length) {
          throw new Error('No hay versión compatible disponible.');
        }

        const primaryFile = match.files.find((f) => f.primary) || match.files[0];
        await api.installModrinthMod(activeInstance.id, primaryFile.url, primaryFile.filename, match.id);
        triggerInstallSuccessConfetti();
        onShowToast('success', 'Recurso Instalado', `${hit.title} añadido con éxito.`);
      }
    } catch (e: any) {
      onShowToast('error', 'Error al instalar', e.toString());
    } finally {
      onEndDownloadActivity?.();
    }
  };

  const providers = [
    { id: 'modrinth', label: 'Modrinth', badgeColor: 'text-spectral-mint' },
    { id: 'curseforge', label: 'CurseForge', badgeColor: 'text-spectral-amber' },
    { id: 'ftb', label: 'FTB', badgeColor: 'text-spectral-cyan' },
  ] as const;

  const categories = [
    { id: 'mod', label: 'Mods', icon: Box },
    { id: 'modpack', label: 'Modpacks', icon: Layers },
    { id: 'resourcepack', label: 'Resource Packs', icon: Image },
    { id: 'shader', label: 'Shaders', icon: SunMedium },
  ] as const;

  const featuredHits = !query.trim() ? hits.slice(0, 3) : [];
  const catalogHits = !query.trim() ? hits.slice(3) : hits;

  const windowedCatalog = useWindowedList(catalogHits.length, 66);
  return (
    <div className="relative flex-1 flex flex-col overflow-hidden select-none">
      <div className="px-6 pt-4 pb-3.5 border-b glass-divider space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-full glass-control">
              {providers.map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`btn-tactile px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 ${
                      active
                        ? 'accent-bg text-white font-semibold'
                        : 'text-ghost-300 hover:text-ghost-50'
                    }`}
                  >
                    <Globe className={`w-3 h-3 ${active ? 'text-white' : p.badgeColor}`} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-full glass-control">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const active = projectType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setProjectType(cat.id)}
                    className={`btn-tactile px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                      active ? 'accent-bg text-white font-semibold' : 'text-ghost-300 hover:text-ghost-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial sm:w-72">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-ghost-400" />
              <input
                type="text"
                placeholder={`${t.disc_search_placeholder} ${provider.toUpperCase()}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 glass-control text-xs placeholder:text-ghost-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersExpanded((v) => !v)}
              className={`btn-tactile p-2 glass-control text-xs ${
                filtersExpanded ? 'accent-text accent-border' : 'text-ghost-300'
              }`}
              title={language === 'es' ? 'Mostrar/ocultar filtros de versión y loader' : 'Show/hide version and loader filters'}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filtersExpanded && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-ghost-400 text-[10px] uppercase">Loader:</span>
                <GlassSelect
                  value={loader}
                  onChange={setLoader}
                  popoverWidth="w-36"
                  options={[
                    { value: 'all', label: language === 'es' ? 'Todos' : 'All' },
                    { value: 'fabric', label: 'Fabric' },
                    { value: 'neoforge', label: 'NeoForge' },
                    { value: 'forge', label: 'Forge' },
                    { value: 'quilt', label: 'Quilt' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-ghost-400 text-[10px] uppercase">
                  {language === 'es' ? 'Versión MC:' : 'MC Version:'}
                </span>
                <GlassSelect
                  value={gameVersion}
                  onChange={setGameVersion}
                  popoverWidth="w-56"
                  options={[
                    { value: 'all', label: language === 'es' ? 'Todas las versiones' : 'All versions' },
                    ...(!manifestVersions.some((v) => v.id === '26.3')
                      ? [{ value: '26.3', label: '26.3' }]
                      : []),
                    ...manifestVersions.map((v) => ({
                      value: v.id,
                      label: v.id,
                      badge:
                        activeInstance?.mc_version === v.id
                          ? (language === 'es' ? 'Activa' : 'Active')
                          : v.type !== 'release'
                          ? v.type
                          : undefined,
                    })),
                  ]}
                />

                <button
                  type="button"
                  onClick={() => setShowSnapshots((s) => !s)}
                  className={`btn-tactile px-2 py-1 rounded-control text-[10px] border ${
                    showSnapshots ? 'accent-pill-tint' : 'glass-control text-ghost-400'
                  }`}
                >
                  Snapshots
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-ghost-400 text-[10px] uppercase">
                  {language === 'es' ? 'Orden:' : 'Sort:'}
                </span>
                <GlassSelect
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  popoverWidth="w-40"
                  options={[
                    { value: 'downloads', label: t.disc_popular },
                    { value: 'relevance', label: language === 'es' ? 'Relevancia' : 'Relevance' },
                    { value: 'follows', label: language === 'es' ? 'Tendencia' : 'Trending' },
                    { value: 'updated', label: language === 'es' ? 'Actualizados' : 'Updated' },
                    { value: 'newest', label: language === 'es' ? 'Nuevos' : 'Newest' },
                  ]}
                />
              </div>
            </div>

            <span className="text-[11px] text-ghost-400 tabular-nums">
              {totalHits.toLocaleString()} {language === 'es' ? 'recursos' : 'resources'} ({provider.toUpperCase()})
            </span>
          </div>
        )}
      </div>

      <div ref={windowedCatalog.ref} onScroll={windowedCatalog.onScroll} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <GhosttyMascot
              mood="loading"
              size="md"
              caption={`Consultando catálogo de ${provider.toUpperCase()}...`}
            />
          </div>
        ) : hits.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <GhosttyMascot
              mood="sad"
              size="md"
              caption="No encontramos resultados con estos filtros. Prueba cambiando la versión."
            />
          </div>
        ) : (
          <>
            {featuredHits.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="heading-display text-lg font-extrabold text-ghost-50 flex items-center gap-2 tracking-wider">
                    <Sparkles className="w-4 h-4 accent-text" />
                    <span>{t.disc_featured} {provider.toUpperCase()}</span>
                  </h3>
                  <span className="text-[11px] font-mono text-ghost-400">
                    {language === 'es' ? 'Haz clic en un proyecto para ver su página completa' : 'Click on a project to view full page'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {featuredHits.map((hit) => (
                    <SpotlightCard
                      key={hit.project_id}
                      className="glass-card p-4 flex flex-col justify-between min-h-[155px]"
                    >
                      <div
                        className="relative z-10 cursor-pointer"
                        onClick={() => openHitModal(hit, 'details')}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-11 h-11 rounded-control bg-black/30 border border-[var(--glass-border)] overflow-hidden p-1 shrink-0 flex items-center justify-center">
                            {hit.icon_url ? (
                              <img
                                src={hit.icon_url}
                                alt={hit.title}
                                className="w-full h-full object-cover rounded-[8px]"
                              />
                            ) : (
                              <Box className="w-5 h-5 accent-text" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="heading-display text-lg font-bold text-ghost-50 truncate hover:accent-text transition-colors">
                              {hit.title}
                            </h4>
                            <span className="text-[10px] font-mono text-ghost-300 block truncate">
                              {language === 'es' ? 'por' : 'by'} {hit.author}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-ghost-200 line-clamp-2 leading-relaxed">
                          {hit.description}
                        </p>
                      </div>

                      <div className="relative z-10 mt-3 pt-2.5 border-t glass-divider flex items-center justify-between text-[11px] font-mono gap-2">
                        <span className="text-ghost-300 tabular-nums truncate">
                          {(hit.downloads / 1000).toFixed(0)}k {t.disc_downloads}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openHitModal(hit, 'details')}
                            className="btn-tactile p-1.5 rounded-control glass-control flex items-center justify-center text-ghost-200 hover:text-ghost-50"
                            title={language === 'es' ? 'Ver página del proyecto' : 'View project page'}
                          >
                            <FileText className="w-3.5 h-3.5 accent-text" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openHitModal(hit, 'versions')}
                            className="btn-tactile p-1.5 rounded-control glass-control flex items-center justify-center text-ghost-300 hover:text-ghost-50"
                            title={language === 'es' ? 'Seleccionar versión específica' : 'Select specific version'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInstallLatest(hit)}
                            className="btn-tactile px-2.5 py-1 rounded-control accent-bg text-white font-semibold flex items-center gap-1 shrink-0"
                            title={hit.project_type === 'modpack' ? (language === 'es' ? 'Crear estancia' : 'Create instance') : (language === 'es' ? 'Instalar última versión' : 'Install latest version')}
                          >
                            <Download className="w-3 h-3" />
                            <span>{hit.project_type === 'modpack' ? (language === 'es' ? 'Crear' : 'Create') : t.disc_install}</span>
                          </button>
                        </div>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="heading-display text-lg font-extrabold text-ghost-50 tracking-wider">
                  {query.trim() ? `${language === 'es' ? 'RESULTADOS PARA' : 'RESULTS FOR'} "${query.toUpperCase()}"` : t.disc_catalog}
                </h3>
                {activeInstance && projectType !== 'modpack' && (
                  <span className="text-[11px] font-mono text-ghost-300">
                    {language === 'es' ? 'Destino:' : 'Target:'} <strong className="text-ghost-50">{activeInstance.name}</strong>
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {windowedCatalog.padTop > 0 && <div style={{ height: windowedCatalog.padTop }} />}
                {catalogHits.slice(windowedCatalog.start, windowedCatalog.end).map((hit, index) => (
                  <motion.div
                    key={hit.project_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.01, 0.4), duration: 0.16 }}
                    className="row-deferred py-2.5 px-3.5 flex items-center justify-between gap-4 bg-[var(--glass-subtle)] hover:bg-[var(--glass-hover)] transition-colors rounded-control"
                  >
                    <div
                      onClick={() => openHitModal(hit, 'details')}
                      className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-control bg-black/25 border border-[var(--glass-border)] overflow-hidden p-1 shrink-0 flex items-center justify-center">
                        {hit.icon_url ? (
                          <img
                            src={hit.icon_url}
                            alt={hit.title}
                            className="w-full h-full object-cover rounded-[8px]"
                          />
                        ) : (
                          <Box className="w-5 h-5 text-ghost-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-ghost-50 truncate group-hover:accent-text transition-colors">
                            {hit.title}
                          </h4>
                          <span className="text-[10px] font-mono text-ghost-400">
                            por {hit.author}
                          </span>
                        </div>
                        <p className="text-xs text-ghost-300 line-clamp-1 mt-0.5">
                          {hit.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-[11px] text-ghost-400 tabular-nums hidden sm:inline">
                        {(hit.downloads / 1000).toFixed(1)}k
                      </span>

                      <button
                        type="button"
                        onClick={() => openHitModal(hit, 'details')}
                        className="btn-tactile p-2 rounded-control glass-control flex items-center justify-center text-ghost-200 hover:text-ghost-50"
                        title={language === 'es' ? 'Ver página de información del mod' : 'View project details page'}
                      >
                        <FileText className="w-3.5 h-3.5 accent-text" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openHitModal(hit, 'versions')}
                        className="btn-tactile px-2.5 py-1.5 glass-control text-xs flex items-center gap-1.5 text-ghost-200"
                        title={language === 'es' ? 'Elegir versión específica' : 'Select specific version'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{language === 'es' ? 'Versiones' : 'Versions'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInstallLatest(hit)}
                        className="btn-tactile px-3.5 py-1.5 rounded-control accent-bg text-white font-semibold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{hit.project_type === 'modpack' ? (language === 'es' ? 'Crear' : 'Create') : t.disc_install}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
                {windowedCatalog.padBottom > 0 && (
                  <div style={{ height: windowedCatalog.padBottom }} />
                )}
              </div>

              {hits.length < totalHits && (
                <div className="pt-3 pb-6 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="btn-tactile px-6 py-2.5 rounded-control glass-control hover:border-[var(--accent)] text-xs font-mono font-semibold flex items-center gap-2 text-ghost-200 hover:text-ghost-50"
                  >
                    {loadingMore ? (
                      <RefreshCw className="w-4 h-4 animate-spin accent-text" />
                    ) : (
                      <ChevronDown className="w-4 h-4 accent-text" />
                    )}
                    <span>
                      {loadingMore
                        ? 'Cargando más...'
                        : `Cargar más recursos (${hits.length} de ${totalHits.toLocaleString()})`}
                    </span>
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <VersionSelectorModal
        isOpen={!!selectedHitForModal}
        hit={selectedHitForModal}
        initialTab={modalInitialTab}
        activeInstance={activeInstance}
        onClose={() => setSelectedHitForModal(null)}
        onInstallVersion={async (hit, version, file) => {
          try {
            onStartDownloadActivity?.(`Instalando ${hit.title} ${version.version_number}`);
            if (hit.project_type === 'modpack') {
              onShowToast('info', 'Creando Estancia', `Instalando versión ${version.version_number}...`);
              const newInst = await api.installOnlineModpack(
                file.url,
                hit.title,
                hit.icon_url || undefined
              );
              triggerInstallSuccessConfetti();
              onShowToast('success', 'Modpack Creado', `Se creó "${newInst.name}".`);
              onModpackInstalled(newInst);
            } else {
              if (!activeInstance) {
                onShowToast('warning', 'Selecciona una estancia', 'Elige una estancia activa.');
                return;
              }
              await api.installModrinthMod(activeInstance.id, file.url, file.filename, version.id);
              triggerInstallSuccessConfetti();
              onShowToast(
                'success',
                'Versión Instalada',
                `${file.filename} añadida a ${activeInstance.name}.`
              );
            }
          } catch (e: any) {
            onShowToast('error', 'Error en instalación', e.toString());
          } finally {
            onEndDownloadActivity?.();
          }
        }}
      />
    </div>
  );
};
