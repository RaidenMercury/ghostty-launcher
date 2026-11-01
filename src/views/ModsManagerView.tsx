import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useWindowedList } from '../hooks/useWindowedList';
import {
  Search,
  RefreshCw,
  FolderOpen,
  Download,
  Trash2,
  Package,
} from 'lucide-react';
import { Instance, ModFileInfo } from '../types';
import { api } from '../services/api';
import { InstanceIcon } from '../components/InstanceIcon';
import { GhosttyMascot } from '../components/GhosttyMascot';

interface ModsManagerViewProps {
  activeInstance: Instance | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
  onGoDiscover?: () => void;
}

export const ModsManagerView: React.FC<ModsManagerViewProps> = ({
  activeInstance,
  onShowToast,
  onGoDiscover,
}) => {
  const [mods, setMods] = useState<ModFileInfo[]>([]);
  const iconRequest = useRef(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [kind, setKind] = useState<'mods' | 'resourcepacks' | 'shaderpacks'>('mods');

  const kindMeta = {
    mods: { label: 'Mods', plural: 'mods', hint: 'Gestor de mods .jar' },
    resourcepacks: { label: 'Texturas', plural: 'resource packs', hint: 'Paquetes de texturas .zip' },
    shaderpacks: { label: 'Shaders', plural: 'shaders', hint: 'Paquetes de shaders .zip' },
  } as const;

  useEffect(() => {
    if (activeInstance) {
      loadMods();
    }
  }, [activeInstance, kind]);

  const loadMods = async () => {
    if (!activeInstance) return;
    try {
      setLoading(true);
      const list = await api.getInstanceMods(activeInstance.id, kind);
      setMods(list);
      void loadIcons(list.map((m) => m.filename));
    } catch (e: any) {
      onShowToast('error', 'Error al cargar contenido', e.toString());
    } finally {
      setLoading(false);
    }
  };

  const loadIcons = async (filenames: string[]) => {
    if (!activeInstance) return;
    const token = ++iconRequest.current;

    for (let i = 0; i < filenames.length; i += 8) {
      if (token !== iconRequest.current) return;
      const chunk = filenames.slice(i, i + 8);
      try {
        const pairs = await api.getModIcons(activeInstance.id, chunk, kind);
        if (token !== iconRequest.current) return;
        setMods((prev) =>
          prev.map((mod) => {
            const hit = pairs.find(([name]) => name === mod.filename);
            return hit && hit[1] ? { ...mod, icon: hit[1] } : mod;
          })
        );
      } catch {
        /* sin icono: se queda el placeholder */
      }
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  };

  const handleToggle = async (mod: ModFileInfo) => {
    if (!activeInstance) return;
    try {
      const updated = await api.toggleInstanceMod(activeInstance.id, mod.filename, kind);
      setMods((prev) =>
        prev.map((m) =>
          m.filename.replace(/(\.disabled)+$/, '') === mod.filename.replace(/(\.disabled)+$/, '')
            ? updated
            : m
        )
      );
      onShowToast('info', updated.enabled ? 'Mod Activado' : 'Mod Desactivado', updated.filename);
    } catch (e: any) {
      onShowToast('error', 'Fallo al alternar mod', e.toString());
    }
  };

  const handleDelete = async (filename: string) => {
    if (!activeInstance) return;
    try {
      await api.deleteInstanceMod(activeInstance.id, filename, kind);
      const cleanTarget = filename.replace(/(\.disabled)+$/, '');
      setMods((prev) =>
        prev.filter((m) => m.filename.replace(/(\.disabled)+$/, '') !== cleanTarget)
      );
      onShowToast('info', 'Mod Eliminado', cleanTarget);
    } catch (e: any) {
      onShowToast('error', 'Error al eliminar mod', e.toString());
    }
  };

  const handleOpenFolder = async () => {
    if (!activeInstance) return;
    try {
      await api.openInstanceFolder(activeInstance.id);
      onShowToast('info', 'Carpeta Abierta', `Mostrando archivos de ${activeInstance.name}`);
    } catch (e: any) {
      onShowToast('error', 'Error al abrir carpeta', e.toString());
    }
  };

  const filteredMods = mods.filter((mod) => {
    const matchesSearch = mod.filename.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterState === 'all'
        ? true
        : filterState === 'enabled'
        ? mod.enabled
        : !mod.enabled;
    return matchesSearch && matchesStatus;
  });

  const windowed = useWindowedList(filteredMods.length, 58);

  const enabledCount = mods.filter((m) => m.enabled).length;
  const disabledCount = mods.length - enabledCount;
  const totalSizeBytes = mods.reduce((acc, m) => acc + m.size, 0);

  if (!activeInstance) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none">
        <GhosttyMascot
          mood="idle"
          size="lg"
          caption="Selecciona una estancia para gestionar sus mods."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      <div className="px-6 pt-5 pb-4 border-b glass-divider space-y-3.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-control bg-black/25 border border-[var(--glass-border)] p-1.5 flex items-center justify-center shrink-0">
              <InstanceIcon icon={activeInstance.icon} alt={activeInstance.name} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="heading-display text-2xl font-extrabold text-ghost-50">
                  {activeInstance.name}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full accent-pill-tint border uppercase font-semibold tabular-nums">
                  {activeInstance.loader} {activeInstance.mc_version}
                </span>
              </div>
              <p className="text-xs text-ghost-400 font-mono">
                {kindMeta[kind].hint}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs font-mono tabular-nums">
            {kind === 'mods' ? (
              <>
                <div>
                  <span className="text-ghost-400 block text-[10px]">ACTIVOS</span>
                  <span className="text-sm font-bold text-spectral-mint">{enabledCount}</span>
                </div>
                <div className="border-l glass-divider pl-4">
                  <span className="text-ghost-400 block text-[10px]">INACTIVOS</span>
                  <span className="text-sm font-bold text-ghost-200">{disabledCount}</span>
                </div>
              </>
            ) : (
              <div>
                <span className="text-ghost-400 block text-[10px]">ARCHIVOS</span>
                <span className="text-sm font-bold text-ghost-200">{mods.length}</span>
              </div>
            )}
            <div className="border-l glass-divider pl-4">
              <span className="text-ghost-400 block text-[10px]">PESO TOTAL</span>
              <span className="text-sm font-bold text-ghost-100">
                {(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-full glass-control text-[11px] font-mono w-fit">
          {(['mods', 'resourcepacks', 'shaderpacks'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setSearch('');
              }}
              className={`px-3 py-1 rounded-full transition-colors ${
                kind === k ? 'accent-bg text-white font-semibold' : 'text-ghost-300 hover:text-ghost-50'
              }`}
            >
              {kindMeta[k].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ghost-400" />
              <input
                type="text"
                placeholder={`Filtrar ${kindMeta[kind].plural}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 glass-control text-xs placeholder:text-ghost-400"
              />
            </div>

            {kind === 'mods' && (
            <div className="flex items-center gap-1 p-0.5 rounded-full glass-control text-[11px] font-mono">
              {(['all', 'enabled', 'disabled'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterState(st)}
                  className={`btn-tactile px-2.5 py-1 rounded-full transition-colors ${
                    filterState === st
                      ? 'accent-bg text-white font-semibold'
                      : 'text-ghost-300 hover:text-ghost-50'
                  }`}
                >
                  {st === 'all' ? 'Todos' : st === 'enabled' ? 'Activos' : 'Inactivos'}
                </button>
              ))}
            </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onGoDiscover && (
              <button
                onClick={onGoDiscover}
                className="btn-tactile flex items-center gap-1.5 px-3.5 py-1.5 rounded-control accent-bg text-white font-semibold text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Añadir recursos</span>
              </button>
            )}

            <button
              onClick={handleOpenFolder}
              className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 glass-control text-xs text-ghost-200"
              title="Abrir carpeta de contenido"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Carpeta</span>
            </button>

            <button
              onClick={loadMods}
              className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50"
              title="Recargar contenido"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div ref={windowed.ref} onScroll={windowed.onScroll} className="flex-1 overflow-y-auto px-6 py-3">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <GhosttyMascot mood="loading" size="md" caption={`Escaneando ${kindMeta[kind].plural}...`} />
          </div>
        ) : filteredMods.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <GhosttyMascot
              mood="idle"
              size="md"
              caption={`No hay ${kindMeta[kind].plural} todavía. Descárgalos desde Descubrir o añade el archivo a la carpeta.`}
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            {windowed.padTop > 0 && <div style={{ height: windowed.padTop }} />}
            {filteredMods.slice(windowed.start, windowed.end).map((mod, index) => {
              const cleanName = mod.filename.replace(/(\.disabled)+$/, '');
              return (
                <motion.div
                  key={mod.filename}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.008, 0.45), duration: 0.16 }}
                  className="row-deferred flex items-center justify-between py-2.5 px-3 bg-[var(--glass-subtle)] hover:bg-[var(--glass-hover)] transition-colors rounded-control group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {kind === 'mods' && (
                    <button
                      type="button"
                      onClick={() => handleToggle(mod)}
                      role="switch"
                      aria-checked={mod.enabled}
                      className={`btn-tactile relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-100 ${
                        mod.enabled
                          ? 'accent-bg border-transparent'
                          : 'bg-black/40 border-white/15'
                      }`}
                      title={mod.enabled ? 'Desactivar mod' : 'Activar mod'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-100 mt-0.5 ${
                          mod.enabled ? 'translate-x-4' : 'translate-x-0.5 opacity-60'
                        }`}
                      />
                    </button>
                    )}

                    <div className="w-8 h-8 rounded-[6px] bg-black/30 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {mod.icon ? (
                        <img
                          src={mod.icon}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-ghost-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-mono truncate ${
                          mod.enabled ? 'text-ghost-50 font-medium' : 'text-ghost-400 line-through'
                        }`}
                      >
                        {cleanName}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-ghost-400 font-mono tabular-nums">
                      {(mod.size / (1024 * 1024)).toFixed(2)} MB
                    </span>

                    <button
                      onClick={() => handleDelete(mod.filename)}
                      className="btn-tactile p-1.5 rounded-control text-ghost-400 hover:text-spectral-rose hover:bg-spectral-rose/10 opacity-70 group-hover:opacity-100 transition-opacity"
                      title="Eliminar mod permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
            {windowed.padBottom > 0 && <div style={{ height: windowed.padBottom }} />}
          </div>
        )}
      </div>
    </div>
  );
};
