import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, Reorder } from 'framer-motion';
import {
  Play,
  Sliders,
  Package,
  Trash2,
  Clock,
  Terminal,
  Search,
  Upload,
  FolderOpen,
  Cpu,
  GripVertical,
  Loader2,
  FolderPlus,
  Folder,
  Star,
  Share2,
  X,
  Check,
} from 'lucide-react';
import { Instance } from '../types';
import { triggerLaunchConfetti } from '../utils/confetti';
import { InstanceIcon } from '../components/InstanceIcon';
import { PreblurImage } from '../components/PreblurImage';
import { SpotlightCard } from '../components/SpotlightCard';
import { AccordionSection } from '../components/AccordionSection';
import { GhosttyMascot } from '../components/GhosttyMascot';

interface InstancesViewProps {
  instances: Instance[];
  activeInstance: Instance | null;
  onSelectInstance: (instance: Instance) => void;
  onOpenCreate: () => void;
  onImportModpack: (fileOrPath: File | string) => void;
  onOpenMods: (instance: Instance) => void;
  onOpenSettings: (instance: Instance) => void;
  onOpenFolder?: (id: string) => void;
  onExportInstance?: (id: string, format: 'mrpack' | 'prism' | 'curseforge') => void;
  onAssignGroup?: (instance: Instance, group: string | null) => void;
  onToggleFavorite?: (instance: Instance) => void;
  onOpenLogs?: (instance: Instance) => void;
  onLaunch: (instance: Instance) => void;
  onDeleteInstance: (id: string) => void;
  isLaunching: boolean;
  playingInstanceId?: string | null;
  launchBurstEnabled?: boolean;
  ambientArtworkEnabled?: boolean;
}

function formatPlaytime(secs: number = 0): string {
  if (!secs) return 'Sin registros';
  const hours = (secs / 3600).toFixed(1);
  return `${hours} h jugadas`;
}

export const InstancesView: React.FC<InstancesViewProps> = ({
  instances,
  activeInstance,
  onSelectInstance,
  onOpenCreate,
  onImportModpack,
  onOpenMods,
  onOpenSettings,
  onOpenFolder,
  onExportInstance,
  onToggleFavorite,
  onAssignGroup: _onAssignGroup,
  onOpenLogs,
  onLaunch,
  onDeleteInstance,
  isLaunching,
  playingInstanceId,
  launchBurstEnabled = true,
  ambientArtworkEnabled = true,
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [dragOverGroup] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportBar, setShowImportBar] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [exportMenuFor, setExportMenuFor] = useState<string | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  const [customGroups, setCustomGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ghostty_launcher_groups');
      return saved ? JSON.parse(saved) : ['Todos', 'Favoritos', 'Vanilla', 'Modpacks'];
    } catch {
      return ['Todos', 'Favoritos', 'Vanilla', 'Modpacks'];
    }
  });

  useEffect(() => {
    const onDelete = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      setCustomGroups((prev) => {
        const next = prev.filter((g) => g !== name);
        localStorage.setItem('ghostty_launcher_groups', JSON.stringify(next));
        return next;
      });
      setActiveGroup((prev) => (prev === name ? 'Todos' : prev));
    };

    const onRename = (event: Event) => {
      const { from, to } = (event as CustomEvent<{ from: string; to: string }>).detail;
      setCustomGroups((prev) => {
        const next = prev.map((g) => (g === from ? to : g));
        localStorage.setItem('ghostty_launcher_groups', JSON.stringify(next));
        return next;
      });
      setActiveGroup((prev) => (prev === from ? to : prev));
    };

    window.addEventListener('ghostty:delete-group', onDelete);
    window.addEventListener('ghostty:rename-group', onRename);
    return () => {
      window.removeEventListener('ghostty:delete-group', onDelete);
      window.removeEventListener('ghostty:rename-group', onRename);
    };
  }, []);

  const [activeGroup, setActiveGroup] = useState<string>('Todos');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [instanceGroups] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ghostty_instance_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ghostty_instances_order');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleReorder = (newFilteredOrder: Instance[]) => {
    const newFilteredIds = newFilteredOrder.map((i) => i.id);
    setOrderedIds((prev) => {
      // Si estamos en la vista global sin búsqueda, el orden es directo
      if (activeGroup === 'Todos' && !searchQuery.trim()) {
        const remaining = prev.filter((id) => !newFilteredIds.includes(id));
        const next = [...newFilteredIds, ...remaining];
        localStorage.setItem('ghostty_instances_order', JSON.stringify(next));
        return next;
      }

      // Si estamos en un grupo (Favoritos, Modpacks, etc.) o con búsqueda,
      // preservamos las posiciones relativas exactas sin mover las instancias del grupo al inicio:
      const fullOrder = prev.length > 0 ? [...prev] : instances.map((i) => i.id);
      const indices: number[] = [];
      for (const id of newFilteredIds) {
        const idx = fullOrder.indexOf(id);
        if (idx !== -1) indices.push(idx);
      }
      indices.sort((a, b) => a - b);

      const next = [...fullOrder];
      for (let i = 0; i < indices.length && i < newFilteredIds.length; i++) {
        next[indices[i]] = newFilteredIds[i];
      }

      localStorage.setItem('ghostty_instances_order', JSON.stringify(next));
      return next;
    });
  };

  const sortedInstances = useMemo(() => {
    const list = [...instances];
    if (orderedIds.length > 0) {
      list.sort((a, b) => {
        const idxA = orderedIds.indexOf(a.id);
        const idxB = orderedIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    return list;
  }, [instances, orderedIds]);

  const filteredInstances = useMemo(() => {
    return sortedInstances.filter((inst) => {
      const matchesSearch = inst.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeGroup === 'Todos') return true;
      if (activeGroup === 'Favoritos') return Boolean(inst.favorite);
      const assigned =
        inst.group || instanceGroups[inst.id] || (inst.loader === 'vanilla' ? 'Vanilla' : 'Modpacks');
      return assigned.toLowerCase() === activeGroup.toLowerCase();
    });
  }, [sortedInstances, searchQuery, activeGroup, instanceGroups]);

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setIsCreatingGroup(false);
      return;
    }
    if (!customGroups.includes(trimmed)) {
      const next = [...customGroups, trimmed];
      setCustomGroups(next);
      localStorage.setItem('ghostty_launcher_groups', JSON.stringify(next));
    }
    setActiveGroup(trimmed);
    setNewGroupName('');
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = (groupName: string) => {
    const next = customGroups.filter((g) => g !== groupName);
    setCustomGroups(next);
    localStorage.setItem('ghostty_launcher_groups', JSON.stringify(next));
    if (activeGroup === groupName) {
      setActiveGroup('Todos');
    }
  };

  const handleLaunchClick = (e: React.MouseEvent, inst: Instance) => {
    if (launchBurstEnabled) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;
      triggerLaunchConfetti(x, y);
    }
    onLaunch(inst);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImportFile) {
      onImportModpack(selectedImportFile);
      setSelectedImportFile(null);
      setImportPath('');
      setShowImportBar(false);
      return;
    }
    if (!importPath.trim()) return;
    onImportModpack(importPath.trim());
    setImportPath('');
    setShowImportBar(false);
  };

  const currentHero = activeInstance || sortedInstances[0] || null;
  const currentHeroGroup = currentHero
    ? instanceGroups[currentHero.id] || (currentHero.loader === 'vanilla' ? 'Vanilla' : 'Modpacks')
    : null;

  return (
    <div className="flex-1 flex overflow-hidden px-6 py-4 gap-6 select-none relative z-10">
      <div className="w-80 lg:w-[350px] flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-ghost-400" />
            <input
              type="text"
              placeholder="Buscar estancias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 glass-control text-xs placeholder:text-ghost-400 font-sans"
            />
          </div>

          <button
            onClick={() => setShowImportBar((v) => !v)}
            className={`btn-tactile p-2 rounded-control accent-bg text-white text-xs font-medium flex items-center gap-1.5 ${
              showImportBar ? 'ring-2 ring-white/40' : ''
            }`}
            title="Importar archivo Modpack (.mrpack o .zip)"
          >
            <Upload className="w-4 h-4" />
          </button>

        </div>

        {showImportBar && (
            <form onSubmit={handleImportSubmit} className="glass-modal">
              <div className="p-3 glass-card space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-ghost-300">
                  <span>Importar Modpack (.mrpack / .zip)</span>
                  <label className="accent-text hover:underline cursor-pointer font-semibold">
                    Seleccionar archivo...
                    <input
                      type="file"
                      accept=".mrpack,.zip"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedImportFile(file);
                          const path = (file as any).path || file.name;
                          setImportPath(path);
                          onImportModpack(file);
                          setShowImportBar(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={importPath}
                    onChange={(e) => {
                      setSelectedImportFile(null);
                      setImportPath(e.target.value);
                    }}
                    placeholder="/ruta/al/modpack.mrpack"
                    className="flex-1 px-2.5 py-1.5 glass-control text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!importPath.trim() && !selectedImportFile}
                    className="btn-tactile px-3 py-1.5 rounded-control accent-bg text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Importar
                  </button>
                </div>
              </div>
            </form>
        )}

        <div
          ref={tabsRef}
          onWheel={(e) => {
            if (tabsRef.current) tabsRef.current.scrollLeft += e.deltaY;
          }}
          className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-1 text-[11px] font-mono overscroll-x-contain"
          style={{ scrollbarWidth: 'thin' }}
        >
          {customGroups.map((g) => {
            const active = activeGroup === g;
            const count = sortedInstances.filter((inst) => {
              if (g === 'Todos') return true;
              if (g === 'Favoritos') return Boolean(inst.favorite);
              const assigned =
                inst.group ||
                instanceGroups[inst.id] ||
                (inst.loader === 'vanilla' ? 'Vanilla' : 'Modpacks');
              return assigned.toLowerCase() === g.toLowerCase();
            }).length;

            return (
              <div
                key={g}
                data-group-tab={g}
                className={`relative group/tab shrink-0 rounded-full ${
                  dragOverGroup === g ? 'ring-2 ring-[var(--accent)]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveGroup(g)}
                  className={`btn-tactile px-3 py-1 rounded-full uppercase transition-colors border flex items-center gap-1.5 ${
                    active
                      ? 'accent-pill-tint font-bold'
                      : 'glass-control text-ghost-300 hover:text-ghost-50'
                  }`}
                  title={`Filtrar por grupo "${g}" o arrastra una estancia aquí`}
                >
                  <span>{g}</span>
                  <span className="opacity-60 text-[9px] tabular-nums">({count})</span>
                </button>
                {g !== 'Todos' && g !== 'Favoritos' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(g);
                    }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-spectral-rose text-white text-[9px] items-center justify-center hidden group-hover/tab:flex font-bold"
                    title={`Eliminar grupo "${g}"`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {isCreatingGroup ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                autoFocus
                placeholder="Nombre grupo..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup();
                  if (e.key === 'Escape') {
                    setIsCreatingGroup(false);
                    setNewGroupName('');
                  }
                }}
                className="w-28 px-2 py-0.5 rounded-full glass-control text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleCreateGroup}
                className="btn-tactile p-1 rounded-full accent-bg text-white"
                title="Guardar grupo"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingGroup(false);
                  setNewGroupName('');
                }}
                className="btn-tactile p-1 rounded-full glass-control text-ghost-300"
                title="Cancelar"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingGroup(true)}
              className="btn-tactile px-2.5 py-1 rounded-full border border-dashed border-white/20 text-ghost-400 hover:text-ghost-50 hover:border-white/40 flex items-center gap-1 shrink-0 text-[10px]"
              title="Crear nuevo grupo para organizar tus modpacks"
            >
              <FolderPlus className="w-3 h-3" />
              <span>+ Grupo</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 px-3 -mx-3 py-1.5">
          {filteredInstances.length === 0 ? (
            <div className="py-16 text-center glass-card p-6">
              <GhosttyMascot
                mood="sad"
                size="md"
                caption="No encontramos estancias en este grupo."
              />
            </div>
          ) : (
            <>
              <Reorder.Group
                axis="y"
                values={filteredInstances}
                onReorder={handleReorder}
                className="space-y-2.5"
              >
                {filteredInstances.map((inst) => {
                  const isSelected = currentHero?.id === inst.id;
                  const isFavorite = Boolean(inst.favorite);
                  const isDragging = draggingId === inst.id;

                  return (
                    <Reorder.Item
                      key={inst.id}
                      value={inst}
                      onDragStart={() => setDraggingId(inst.id)}
                      onDragEnd={() => setDraggingId(null)}
                      whileDrag={{
                        scale: 1.025,
                        zIndex: 50,
                        boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.85)',
                        cursor: 'grabbing',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      className="relative cursor-pointer select-none"
                    >
                      <SpotlightCard
                        onClick={() => {
                          if (draggingId) return;
                          onSelectInstance(inst);
                        }}
                        isSelected={isSelected && !isDragging}
                        className={`glass-card instance-card p-3.5 cursor-pointer group relative transition-all duration-150 ${
                          isDragging
                            ? 'shadow-2xl brightness-105 border-white/25'
                            : isSelected
                            ? 'ring-2 ring-[var(--accent)]/70 bg-[var(--glass-hover)] shadow-md'
                            : 'hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 relative z-10">
                          <div
                            className="cursor-grab active:cursor-grabbing text-ghost-500 hover:text-ghost-300 transition-colors shrink-0 -ml-1 p-0.5"
                            title="Arrastra para reordenar"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          <div className="w-11 h-11 rounded-control glass-control p-1.5 flex items-center justify-center shrink-0">
                            <InstanceIcon icon={inst.icon} alt={inst.name} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3
                                className={`text-sm font-semibold truncate transition-colors ${
                                  isSelected ? 'text-ghost-50' : 'text-ghost-200 group-hover:text-ghost-50'
                                }`}
                              >
                                {inst.name}
                              </h3>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full accent-bg shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-ghost-400 tabular-nums truncate">
                                <span className="uppercase text-ghost-200 font-medium">
                                  {inst.loader}
                                </span>
                                <span>•</span>
                                <span>{inst.mc_version}</span>
                                <span>•</span>
                                <span>{inst.memory_max_mb ? (inst.memory_max_mb / 1024).toFixed(0) : '4'}G</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {inst.group && (
                                  <span
                                    className="p-0.5 text-ghost-400"
                                    title={`Grupo: ${inst.group}`}
                                  >
                                    <Folder className="w-3.5 h-3.5" />
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite?.(inst);
                                  }}
                                  className={`p-0.5 transition-colors ${
                                    isFavorite
                                      ? 'text-spectral-rose'
                                      : 'text-spectral-rose/40 hover:text-spectral-rose'
                                  }`}
                                  title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`}
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SpotlightCard>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col glass-panel overflow-hidden relative">
        {currentHero ? (
          <>
            <div className="relative h-64 lg:h-72 w-full overflow-hidden shrink-0 flex flex-col justify-end p-8 border-b glass-divider">
              {ambientArtworkEnabled && (
                currentHero.icon &&
                (currentHero.icon.startsWith('http') ||
                  currentHero.icon.startsWith('data:image') ||
                  currentHero.icon.startsWith('/')) ? (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <PreblurImage
                      src={currentHero.icon}
                      blur={12}
                      className="hero-ambient absolute opacity-40 pointer-events-none"
                      style={{ inset: '-20%' }}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(ellipse 70% 60% at 20% 30%, rgba(var(--accent-rgb), 0.25), transparent 70%)',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 opacity-40 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 70% 60% at 15% 25%, rgba(var(--accent-rgb), 0.38), transparent 70%), radial-gradient(ellipse 60% 50% at 85% 65%, rgba(16, 185, 129, 0.22), transparent 65%), radial-gradient(ellipse 45% 40% at 50% 10%, rgba(139, 92, 246, 0.16), transparent 60%)',
                    }}
                  />
                )
              )}
              <div className="absolute inset-0 smoked-scrim-hero pointer-events-none" />

              <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0">
                  <motion.div
                    key={currentHero.id}
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="w-20 h-20 lg:w-24 lg:h-24 rounded-card glass-control p-2.5 flex items-center justify-center shadow-2xl shrink-0"
                  >
                    <InstanceIcon icon={currentHero.icon} alt={currentHero.name} />
                  </motion.div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full accent-pill-tint border font-semibold tracking-wider tabular-nums">
                        {currentHero.loader} {currentHero.mc_version}
                      </span>
                      {currentHeroGroup && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/15 text-ghost-300 bg-black/25">
                          {currentHeroGroup}
                        </span>
                      )}
                      <span className="text-xs font-mono text-ghost-400 tabular-nums">
                        {formatPlaytime((currentHero.play_time_minutes || 0) * 60)}
                      </span>
                    </div>

                    <h2 className="heading-display text-4xl lg:text-5xl font-extrabold text-ghost-50 truncate drop-shadow-sm">
                      {currentHero.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-ghost-300 mt-2 tabular-nums">
                      <span className="flex items-center gap-1.5 text-spectral-mint">
                        <Clock className="w-3.5 h-3.5" />
                        Listo para jugar
                      </span>
                      <span className="opacity-40">•</span>
                      <span>RAM: {currentHero.memory_max_mb ? (currentHero.memory_max_mb / 1024).toFixed(1) : '4.0'} GB</span>
                      <span className="opacity-40">•</span>
                      <span>
                        {currentHero.resolution?.width || 1920}×{currentHero.resolution?.height || 1080}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.025, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                  onClick={(e) => handleLaunchClick(e, currentHero)}
                  disabled={isLaunching || playingInstanceId === currentHero.id}
                  className="group relative px-9 py-4 rounded-card accent-bg text-white heading-display font-extrabold text-xl tracking-wider shadow-[0_12px_32px_-6px_rgba(var(--accent-rgb),0.55)] flex items-center gap-3 border border-white/25 disabled:opacity-70 overflow-hidden shrink-0 cursor-pointer"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
                  {playingInstanceId === currentHero.id ? (
                    <>
                      <Loader2 className="w-5 h-5 relative z-10 animate-spin" />
                      <span className="relative z-10">EN PARTIDA</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current relative z-10" />
                      <span className="relative z-10">
                        {isLaunching ? 'INICIANDO...' : 'JUGAR AHORA'}
                      </span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b glass-divider">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => onOpenMods(currentHero)}
                    className="btn-tactile px-4 py-2.5 glass-control text-xs font-medium flex items-center gap-2 text-ghost-100"
                  >
                    <Package className="w-4 h-4 accent-text" />
                    <span>Gestor de Mods</span>
                  </button>

                  <button
                    onClick={() => onOpenSettings(currentHero)}
                    className="btn-tactile px-4 py-2.5 glass-control text-xs font-medium flex items-center gap-2 text-ghost-100"
                  >
                    <Sliders className="w-4 h-4 text-ghost-300" />
                    <span>Ajustes de la Estancia</span>
                  </button>

                  {onOpenFolder && (
                    <button
                      onClick={() => onOpenFolder(currentHero.id)}
                      className="btn-tactile px-4 py-2.5 glass-control text-xs font-medium flex items-center gap-2 text-ghost-100"
                    >
                      <FolderOpen className="w-4 h-4 text-ghost-300" />
                      <span>Abrir Carpeta</span>
                    </button>
                  )}

                  {onOpenLogs && (
                    <button
                      onClick={() => onOpenLogs(currentHero)}
                      className="btn-tactile px-4 py-2.5 glass-control text-xs font-medium flex items-center gap-2 text-ghost-100"
                      title="Ver consola y registros JVM de la estancia"
                    >
                      <Terminal className="w-4 h-4 text-ghost-300" />
                      <span>Consola / Logs</span>
                    </button>
                  )}

                  {onExportInstance && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setExportMenuFor(exportMenuFor === currentHero.id ? null : currentHero.id)
                        }
                        className="btn-tactile px-4 py-2.5 glass-control text-xs font-medium flex items-center gap-2 text-ghost-100"
                      >
                        <Share2 className="w-4 h-4 text-ghost-300" />
                        <span>Exportar</span>
                      </button>

                      {exportMenuFor === currentHero.id && (
                        <div className="absolute right-0 mt-2 z-30 w-52 glass-panel-strong rounded-control p-1.5 space-y-1">
                          {(
                            [
                              ['mrpack', 'Modrinth (.mrpack)'],
                              ['prism', 'Prism / MultiMC (.zip)'],
                              ['curseforge', 'CurseForge (.zip)'],
                            ] as const
                          ).map(([format, label]) => (
                            <button
                              key={format}
                              onClick={() => {
                                setExportMenuFor(null);
                                onExportInstance(currentHero.id, format);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded text-xs text-ghost-200 hover:bg-white/5"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onDeleteInstance(currentHero.id)}
                  className="btn-tactile px-3.5 py-2.5 glass-control hover:border-spectral-rose/50 text-xs font-medium flex items-center gap-1.5 text-spectral-rose"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              </div>

              <div className="divide-y glass-divider">
                <AccordionSection
                  title="Parámetros de Memoria y Máquina Virtual Java"
                  subtitle="Configuración activa de ejecución para este perfil"
                  badge={`${((currentHero.memory_min_mb || 2048) / 1024).toFixed(1)}G – ${((currentHero.memory_max_mb || 4096) / 1024).toFixed(1)}G`}
                  icon={<Cpu className="w-4 h-4 accent-text" />}
                  defaultOpen={true}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-ghost-400 block mb-1">
                        Ejecutable Java
                      </span>
                      <span className="text-ghost-100 truncate block">
                        {currentHero.java_path || 'Heredado del sistema (/usr/bin/java)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-ghost-400 block mb-1">
                        Argumentos JVM
                      </span>
                      <span className="text-ghost-200 truncate block">
                        {currentHero.jvm_args || '-XX:+UseG1GC'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-ghost-400 block mb-1">
                        Modo de Pantalla
                      </span>
                      <span className="text-ghost-100 tabular-nums block">
                        {currentHero.resolution?.width || 1920}×{currentHero.resolution?.height || 1080}{' '}
                        {currentHero.resolution?.fullscreen ? '(Pantalla Completa)' : '(Ventana)'}
                      </span>
                    </div>
                  </div>
                </AccordionSection>

                <AccordionSection
                  title="Hooks del Sistema & Variables de Entorno"
                  subtitle="Comandos pre/post-lanzamiento y variables aisladas"
                  badge={`${Object.keys(currentHero.env_vars || {}).length} vars`}
                  icon={<Terminal className="w-4 h-4 text-ghost-300" />}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-ghost-400 block mb-1">
                        Hook Pre-Lanzamiento
                      </span>
                      <span className="text-ghost-200 block">
                        {currentHero.pre_launch_command || 'Ninguno configurado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-ghost-400 block mb-1">
                        Hook Post-Salida
                      </span>
                      <span className="text-ghost-200 block">
                        {currentHero.post_exit_command || 'Ninguno configurado'}
                      </span>
                    </div>
                  </div>
                </AccordionSection>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <GhosttyMascot
              mood="idle"
              size="lg"
              caption="Crea tu primera estancia o importa un paquete .mrpack para empezar."
            />
            <button
              onClick={onOpenCreate}
              className="btn-tactile mt-5 px-6 py-2.5 rounded-control accent-bg text-white heading-display font-bold text-base tracking-wider"
            >
              CREAR PRIMERA ESTANCIA
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
