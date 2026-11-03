import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Check,
  Calendar,
  Layers,
  ExternalLink,
  FileText,
  ListFilter,
  Image as ImageIcon,
  Code2,
  Scale,
  Maximize2,
} from 'lucide-react';
import { ModrinthSearchHit, ModrinthVersion, Instance } from '../types';
import { api, ProjectFullDetails } from '../services/api';
import { GlassSelect } from './GlassSelect';
import { ImageViewerModal, GalleryImage } from './ImageViewerModal';
import { useI18n } from '../utils/i18n';

interface VersionSelectorModalProps {
  isOpen: boolean;
  hit: ModrinthSearchHit | null;
  initialTab?: 'details' | 'versions';
  activeInstance: Instance | null;
  onClose: () => void;
  onInstallVersion: (hit: ModrinthSearchHit, version: ModrinthVersion, file: any) => Promise<void>;
}

export function VersionSelectorModal({
  isOpen,
  hit,
  initialTab = 'versions',
  activeInstance,
  onClose,
  onInstallVersion,
}: VersionSelectorModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'details' | 'versions'>(initialTab);
  const [details, setDetails] = useState<ProjectFullDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [loaderFilter, setLoaderFilter] = useState<string>(activeInstance?.loader || 'all');
  const [gameVerFilter, setGameVerFilter] = useState<string>(activeInstance?.mc_version || 'all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'release' | 'beta' | 'alpha'>('all');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, hit]);

  useEffect(() => {
    if (hit) {
      loadVersions(hit);
      loadProjectDetails(hit);
    }
  }, [hit]);

  useEffect(() => {
    if (!isOpen || isImageViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImageViewerOpen, onClose]);

  const loadProjectDetails = async (targetHit: ModrinthSearchHit) => {
    try {
      setLoadingDetails(true);
      const d = await api.getProjectDetails(targetHit);
      setDetails(d);
    } catch {
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadVersions = async (targetHit: ModrinthSearchHit) => {
    try {
      setLoading(true);
      const list = await api.getModrinthVersions(targetHit.project_id);
      setVersions(list);
      if (list.length > 0) {
        setSelectedVersion(list[0]);
      }
    } catch (e: any) {
      console.warn('Error fetching versions:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!hit) return null;

  const filteredVersions = versions.filter((v) => {
    if (channelFilter !== 'all' && v.version_type !== channelFilter) return false;
    if (loaderFilter !== 'all' && !v.loaders.includes(loaderFilter.toLowerCase())) return false;
    if (gameVerFilter !== 'all' && !v.game_versions.includes(gameVerFilter)) return false;
    return true;
  });

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const handleInstall = async () => {
    if (!selectedVersion || !selectedVersion.files.length) return;
    try {
      setIsInstalling(true);
      const file = selectedVersion.files.find((f) => f.primary) || selectedVersion.files[0];
      await onInstallVersion(hit, selectedVersion, file);
      onClose();
    } finally {
      setIsInstalling(false);
    }
  };

  const providerLabel =
    hit.provider === 'curseforge'
      ? 'CurseForge'
      : hit.provider === 'ftb'
      ? 'FTB'
      : 'Modrinth';

  const externalPageUrl =
    details?.page_url ||
    hit.page_url ||
    `https://modrinth.com/${hit.project_type}/${hit.slug}`;

  const cleanBodyText = (raw: string) => {
    return raw
      .replace(/<[^>]*>/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .trim();
  };

  const viewerImages: GalleryImage[] =
    details?.gallery && details.gallery.length > 0
      ? details.gallery
      : hit.icon_url
      ? [{ url: hit.icon_url, title: hit.title }]
      : [];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/75"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-full h-full max-h-full flex flex-col glass-panel-strong text-ghost-100 z-10 overflow-hidden"
            >
              <div className="relative overflow-hidden border-b glass-divider px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    onClick={() => {
                      if (hit.icon_url) {
                        setSelectedImageIndex(0);
                        setIsImageViewerOpen(true);
                      }
                    }}
                    className={`w-10 h-10 rounded-control bg-black/30 border border-[var(--glass-border)] overflow-hidden flex items-center justify-center shrink-0 ${
                      hit.icon_url ? 'cursor-pointer hover:border-ghost-300 transition-colors' : ''
                    }`}
                    title={hit.icon_url ? t.gallery_click_to_expand : undefined}
                  >
                    {hit.icon_url ? (
                      <img
                        src={hit.icon_url}
                        alt={hit.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Layers className="w-5 h-5 accent-text" />
                    )}
                  </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="heading-display text-xl sm:text-2xl font-extrabold text-ghost-50 truncate">
                      {hit.title}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full accent-pill-tint border uppercase font-semibold">
                      {hit.project_type}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full glass-control text-ghost-300 uppercase">
                      {providerLabel}
                    </span>
                  </div>
                  <p className="text-xs text-ghost-400 line-clamp-1">
                    por <strong className="text-ghost-200">{hit.author}</strong> •{' '}
                    {(hit.downloads / 1000).toFixed(1)}k descargas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => api.openExternalUrl(externalPageUrl)}
                  className="btn-tactile px-2.5 py-1.5 glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-200 hover:text-ghost-50"
                  title={`Abrir página oficial en ${providerLabel}`}
                >
                  <span>Abrir en {providerLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5 accent-text" />
                </button>

                <button
                  onClick={onClose}
                  className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-2 border-b glass-divider flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 p-1 rounded-full glass-control">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`btn-tactile px-3.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    activeTab === 'details'
                      ? 'accent-bg text-white font-semibold'
                      : 'text-ghost-300 hover:text-ghost-50'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Página del Mod</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('versions')}
                  className={`btn-tactile px-3.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    activeTab === 'versions'
                      ? 'accent-bg text-white font-semibold'
                      : 'text-ghost-300 hover:text-ghost-50'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Versiones ({versions.length})</span>
                </button>
              </div>

              {details && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-ghost-400">
                  {details.source_url && (
                    <button
                      type="button"
                      onClick={() => api.openExternalUrl(details.source_url!)}
                      className="hover:text-ghost-100 flex items-center gap-1"
                    >
                      <Code2 className="w-3 h-3 accent-text" />
                      <span>Código</span>
                    </button>
                  )}
                  <span className="flex items-center gap-1">
                    <Scale className="w-3 h-3" />
                    <span>{details.license}</span>
                  </span>
                </div>
              )}
            </div>

            {activeTab === 'details' ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                {loadingDetails ? (
                  <div className="py-12 text-center text-xs font-mono text-ghost-400">
                    Cargando información del proyecto...
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(details?.categories || hit.categories || []).map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-[var(--glass-subtle)] border border-[var(--glass-border)] text-ghost-300"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>

                    {details?.gallery && details.gallery.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-mono uppercase text-ghost-300 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 accent-text" />
                            <span>{t.gallery_title} ({details.gallery.length})</span>
                          </h4>
                          <span className="text-[11px] text-ghost-400">
                            {t.gallery_click_to_expand}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {details.gallery.map((img, i) => (
                            <div
                              key={i}
                              onClick={() => {
                                setSelectedImageIndex(i);
                                setIsImageViewerOpen(true);
                              }}
                              className="h-28 rounded-control overflow-hidden border border-[var(--glass-border)] bg-black/30 cursor-pointer group relative shadow-sm hover:border-ghost-300 transition-all"
                            >
                              <img
                                src={img.url}
                                alt={img.title || hit.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 className="w-5 h-5 text-ghost-50 drop-shadow" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase text-ghost-300">
                        Descripción del Proyecto
                      </h4>
                      <div className="p-4 rounded-card bg-[var(--glass-subtle)] border border-[var(--glass-border)] text-xs text-ghost-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {cleanBodyText(details?.body || hit.description)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 border-b glass-divider text-xs font-mono shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <GlassSelect
                      value={loaderFilter}
                      onChange={setLoaderFilter}
                      popoverWidth="w-36"
                      options={[
                        { value: 'all', label: 'Loader: Todos' },
                        { value: 'fabric', label: 'Fabric' },
                        { value: 'neoforge', label: 'NeoForge' },
                        { value: 'forge', label: 'Forge' },
                        { value: 'quilt', label: 'Quilt' },
                      ]}
                    />

                    <GlassSelect
                      value={gameVerFilter}
                      onChange={setGameVerFilter}
                      popoverWidth="w-48"
                      options={[
                        { value: 'all', label: 'MC: Cualquiera' },
                        ...(activeInstance
                          ? [{ value: activeInstance.mc_version, label: `${activeInstance.mc_version} (Activa)` }]
                          : []),
                        { value: '26.3', label: '26.3' },
                        { value: '1.21.11', label: '1.21.11' },
                        { value: '1.21.4', label: '1.21.4' },
                        { value: '1.21.1', label: '1.21.1' },
                        { value: '1.20.4', label: '1.20.4' },
                        { value: '1.20.1', label: '1.20.1' },
                        { value: '1.19.2', label: '1.19.2' },
                        { value: '1.18.2', label: '1.18.2' },
                        { value: '1.16.5', label: '1.16.5' },
                        { value: '1.12.2', label: '1.12.2' },
                      ]}
                    />

                    <GlassSelect
                      value={channelFilter}
                      onChange={(val) => setChannelFilter(val as any)}
                      popoverWidth="w-36"
                      options={[
                        { value: 'all', label: 'Canal: Todos' },
                        { value: 'release', label: 'Release' },
                        { value: 'beta', label: 'Beta' },
                        { value: 'alpha', label: 'Alpha' },
                      ]}
                    />
                  </div>

                  <span className="text-ghost-400 text-[11px] tabular-nums">
                    {filteredVersions.length} versiones
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-1.5">
                  {loading ? (
                    <div className="py-12 text-center text-xs font-mono text-ghost-400">
                      Consultando registro de versiones...
                    </div>
                  ) : filteredVersions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-ghost-400">
                      No hay versiones que coincidan con los filtros seleccionados.
                      <button
                        onClick={() => {
                          setLoaderFilter('all');
                          setGameVerFilter('all');
                          setChannelFilter('all');
                        }}
                        className="block mx-auto mt-2 accent-text hover:underline font-mono text-[11px]"
                      >
                        Restablecer filtros
                      </button>
                    </div>
                  ) : (
                    filteredVersions.map((ver) => {
                      const isSelected = selectedVersion?.id === ver.id;
                      const primaryFile = ver.files.find((f) => f.primary) || ver.files[0];

                      return (
                        <div
                          key={ver.id}
                          onClick={() => setSelectedVersion(ver)}
                          className={`py-2.5 px-3.5 rounded-control cursor-pointer transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-[var(--glass-hover)] ring-1 ring-[var(--accent)]/40'
                              : 'bg-[var(--glass-subtle)] hover:bg-[var(--glass-hover)]'
                          }`}
                        >
                          <div className="min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-xs text-ghost-50 truncate">
                                {ver.name || ver.version_number}
                              </span>
                              <span className="text-[10px] font-mono text-ghost-400 tabular-nums">
                                v{ver.version_number}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-ghost-400 tabular-nums">
                              {ver.date_published && (
                                <>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(ver.date_published)}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span>MC: {ver.game_versions.slice(0, 3).join(', ')}</span>
                              <span>•</span>
                              <span className="uppercase text-ghost-200">{ver.loaders.join(', ')}</span>
                              {primaryFile && (
                                <>
                                  <span>•</span>
                                  <span>{(primaryFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full accent-bg text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-[var(--glass-border)]" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className="flex items-center justify-between px-5 py-3 border-t glass-divider shrink-0">
              <div className="text-xs font-mono text-ghost-400 tabular-nums">
                {selectedVersion ? (
                  <span>
                    Versión lista: <strong className="accent-text">{selectedVersion.version_number}</strong>
                  </span>
                ) : (
                  <span>Selecciona una versión para instalar</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-tactile px-4 py-1.5 glass-control text-ghost-300 text-xs font-medium"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={!selectedVersion || isInstalling}
                  className="btn-tactile flex items-center gap-2 px-5 py-1.5 rounded-control accent-bg text-white font-semibold text-xs disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isInstalling
                      ? 'Descargando...'
                      : hit.project_type === 'modpack'
                      ? 'Crear Estancia'
                      : 'Instalar Versión'}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <ImageViewerModal
      isOpen={isImageViewerOpen}
      images={viewerImages}
      initialIndex={selectedImageIndex}
      onClose={() => setIsImageViewerOpen(false)}
    />
  </>
  );
}
