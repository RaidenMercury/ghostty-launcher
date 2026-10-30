import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MessageSquare, Check, RefreshCw, Folder } from 'lucide-react';
import { SystemJavaInfo } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

export function SettingsView({ onShowToast }: SettingsViewProps) {
  const [javaList, setJavaList] = useState<SystemJavaInfo[]>([]);
  const [selectedJava, setSelectedJava] = useState<string>('');
  const [discordRpc, setDiscordRpc] = useState(true);
  const [loadingJava, setLoadingJava] = useState(false);

  useEffect(() => {
    loadJava();
  }, []);

  const loadJava = async () => {
    try {
      setLoadingJava(true);
      const list = await api.detectJava();
      setJavaList(list);
      if (list.length > 0 && !selectedJava) {
        setSelectedJava(list[0].path);
      }
    } catch (e: any) {
      onShowToast('error', 'Error detectando Java', e.toString());
    } finally {
      setLoadingJava(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 select-none max-w-4xl">
      {/* Header */}
      <div className="pb-6 border-b border-ghost-800">
        <h1 className="text-2xl font-extrabold tracking-tight text-ghost-100">
          Ajustes del Sistema & Java
        </h1>
        <p className="text-xs text-ghost-400 mt-1">
          Configuración global del entorno de ejecución, Discord RPC e infraestructura.
        </p>
      </div>

      {/* Java Runtimes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-spectral-cyan/15 text-spectral-cyan border border-spectral-cyan/30 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ghost-100">Runtimes de Java Detectados</h3>
              <p className="text-xs text-ghost-400">Escaneado automático en /usr/lib/jvm y PATH del sistema</p>
            </div>
          </div>
          <button
            onClick={loadJava}
            disabled={loadingJava}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ghost-850 hover:bg-ghost-800 border border-ghost-750 text-xs text-ghost-300 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingJava ? 'animate-spin' : ''}`} />
            <span>Volver a escanear</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {javaList.map((j) => (
            <div
              key={j.path}
              onClick={() => setSelectedJava(j.path)}
              className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedJava === j.path
                  ? 'bg-ghost-850/90 border-spectral-cyan/50 shadow-[0_0_20px_-8px_rgba(56,189,248,0.25)]'
                  : 'bg-ghost-900/60 border-ghost-800 hover:border-ghost-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-ghost-800 flex items-center justify-center text-ghost-400 font-mono text-xs">
                  JDK
                </div>
                <div>
                  <div className="font-semibold text-xs text-ghost-100">{j.version}</div>
                  <div className="text-[10px] font-mono text-ghost-400 mt-0.5">{j.path}</div>
                </div>
              </div>

              {selectedJava === j.path && (
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-spectral-mint">
                  <Check className="w-4 h-4" />
                  <span>Por Defecto</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Discord Rich Presence Section */}
      <div className="p-6 rounded-3xl bg-ghost-900/80 border border-ghost-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ghost-100">Discord Rich Presence Personalizado</h3>
              <p className="text-xs text-ghost-400">Muestra en tu perfil de Discord qué estás jugando en tiempo real</p>
            </div>
          </div>
          <button
            onClick={() => setDiscordRpc(!discordRpc)}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              discordRpc ? 'bg-spectral-mint' : 'bg-ghost-800'
            }`}
          >
            <motion.div
              layout
              className={`w-4 h-4 rounded-full bg-ghost-950 shadow-sm ${
                discordRpc ? 'ml-auto' : ''
              }`}
            />
          </button>
        </div>

        {/* Live Discord RPC Preview */}
        {discordRpc && (
          <div className="p-4 rounded-2xl bg-ghost-950/80 border border-ghost-800 text-xs">
            <span className="text-[10px] uppercase font-mono font-bold text-ghost-400 tracking-wider block mb-3">
              VISTA PREVIA DE ACTIVIDAD EN DISCORD
            </span>
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-2xl bg-ghost-850 p-1.5 border border-ghost-750 flex items-center justify-center">
                <img src="/ghostty.svg" alt="logo" className="w-full h-full object-contain" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-spectral-mint border-2 border-ghost-950 flex items-center justify-center text-[8px] font-bold text-ghost-950">
                  MC
                </div>
              </div>
              <div>
                <h4 className="font-bold text-ghost-100">Ghostty Launcher</h4>
                <p className="text-[11px] text-ghost-300">Jugando: Aventura Ghostty 1.21</p>
                <p className="text-[10px] text-ghost-400 font-mono">Modded (Fabric) • 12 mods activos</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Directory paths info */}
      <div className="p-5 rounded-3xl bg-ghost-900/50 border border-ghost-800/80 text-xs font-mono space-y-2 text-ghost-400">
        <div className="flex items-center gap-2 text-ghost-200 font-semibold mb-1">
          <Folder className="w-4 h-4 text-spectral-cyan" />
          <span>Rutas del Almacenamiento Local</span>
        </div>
        <div>Instancias: ~/.local/share/ghostty-launcher/instances/</div>
        <div>Cuentas: ~/.local/share/ghostty-launcher/accounts.json</div>
        <div>Caché de Manifiestos: ~/.local/share/ghostty-launcher/cache/</div>
      </div>
    </div>
  );
}
