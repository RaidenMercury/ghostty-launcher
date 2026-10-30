import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ToggleLeft, ToggleRight, RefreshCw, FolderOpen, AlertCircle } from 'lucide-react';
import { Instance, ModFileInfo } from '../types';
import { api } from '../services/api';

interface ModsManagerViewProps {
  activeInstance: Instance | null;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

export function ModsManagerView({ activeInstance, onShowToast }: ModsManagerViewProps) {
  const [mods, setMods] = useState<ModFileInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeInstance) {
      loadMods();
    }
  }, [activeInstance]);

  const loadMods = async () => {
    if (!activeInstance) return;
    try {
      setLoading(true);
      const list = await api.getInstanceMods(activeInstance.id);
      setMods(list);
    } catch (e: any) {
      onShowToast('error', 'Error cargando mods', e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (filename: string) => {
    if (!activeInstance) return;
    try {
      const nowEnabled = await api.toggleInstanceMod(activeInstance.id, filename);
      setMods((prev) =>
        prev.map((m) =>
          m.filename === filename
            ? {
                ...m,
                enabled: nowEnabled,
                filename: nowEnabled
                  ? filename.replace('.disabled', '')
                  : `${filename}.disabled`,
              }
            : m
        )
      );
      onShowToast(
        'info',
        nowEnabled ? 'Mod Activado' : 'Mod Desactivado',
        filename.replace('.disabled', '')
      );
    } catch (e: any) {
      onShowToast('error', 'No se pudo cambiar estado', e.toString());
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  if (!activeInstance) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-ghost-900 border border-ghost-800 flex items-center justify-center text-ghost-500 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-ghost-200">Ninguna estancia seleccionada</h2>
        <p className="text-xs text-ghost-400 mt-1 max-w-sm">
          Selecciona una estancia en la pestaña "Estancias" para revisar y activar/desactivar sus mods instalados.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-ghost-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-ghost-100">
              Mods Instalados
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-ghost-800 text-ghost-400 border border-ghost-700">
              {mods.length} Mods
            </span>
          </div>
          <p className="text-xs text-ghost-400 mt-1">
            Estancia actual: <span className="text-ghost-200 font-semibold">{activeInstance.name}</span> ({activeInstance.loader} {activeInstance.mc_version})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMods}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ghost-850 hover:bg-ghost-800 border border-ghost-750 text-xs font-semibold text-ghost-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Mods List */}
      {mods.length > 0 ? (
        <div className="space-y-2.5">
          {mods.map((mod) => (
            <motion.div
              key={mod.filename}
              layout
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                mod.enabled
                  ? 'bg-ghost-900/90 border-ghost-800 hover:border-ghost-700'
                  : 'bg-ghost-950/60 border-ghost-850/60 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    mod.enabled
                      ? 'bg-spectral-cyan/15 text-spectral-cyan border-spectral-cyan/30'
                      : 'bg-ghost-850 text-ghost-500 border-ghost-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-ghost-100 truncate font-mono">
                    {mod.filename.replace('.disabled', '')}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-ghost-400 font-mono mt-0.5">
                    <span>{formatSize(mod.size)}</span>
                    <span className={mod.enabled ? 'text-spectral-mint' : 'text-ghost-500'}>
                      {mod.enabled ? '● Habilitado' : '○ Deshabilitado'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggle(mod.filename)}
                className={`p-1.5 rounded-xl transition-colors ${
                  mod.enabled
                    ? 'text-spectral-mint hover:text-spectral-mint/80'
                    : 'text-ghost-500 hover:text-ghost-300'
                }`}
              >
                {mod.enabled ? (
                  <ToggleRight className="w-6 h-6" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center rounded-3xl border border-dashed border-ghost-800 bg-ghost-900/40 p-8">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 text-ghost-500" />
          <h3 className="font-bold text-sm text-ghost-200">No hay mods en esta estancia</h3>
          <p className="text-xs text-ghost-400 mt-1 max-w-sm mx-auto">
            Visita la pestaña "Descubrir Mods" para agregar mods directamente desde Modrinth.
          </p>
        </div>
      )}
    </div>
  );
}
