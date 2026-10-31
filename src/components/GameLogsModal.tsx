import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Copy, Trash2, Square } from 'lucide-react';

interface GameLogsModalProps {
  isOpen: boolean;
  instanceName: string;
  logs: string[];
  isRunning: boolean;
  onClose: () => void;
  onClearLogs: () => void;
  onStopGame: () => void;
}

export const GameLogsModal: React.FC<GameLogsModalProps> = ({
  isOpen,
  instanceName,
  logs,
  isRunning,
  onClose,
  onClearLogs,
  onStopGame,
}) => {
  const handleCopy = () => {
    navigator.clipboard?.writeText(logs.join('\n'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={onClose}
            className="fixed inset-0 modal-scrim"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-2xl max-h-[80vh] flex flex-col glass-panel-strong text-ghost-100 z-10 overflow-hidden"
          >
            
            <div className="flex items-center justify-between px-5 py-4 border-b glass-divider">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 accent-text" />
                <div>
                  <h3 className="heading-display text-lg font-bold text-ghost-50">
                    Consola de Salida JVM • {instanceName}
                  </h3>
                  <p className="text-[11px] font-mono text-ghost-400">
                    {isRunning ? 'Proceso activo en ejecución' : 'Proceso finalizado'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-tactile px-2.5 py-1.5 glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </button>
                <button
                  onClick={onClearLogs}
                  className="btn-tactile px-2.5 py-1.5 glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
                {isRunning && (
                  <button
                    onClick={onStopGame}
                    className="btn-tactile px-3 py-1.5 rounded-control bg-spectral-rose/20 border border-spectral-rose/40 text-spectral-rose text-xs font-mono font-bold flex items-center gap-1.5"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Detener</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            
            <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-1.5 bg-black/35 select-text">
              {logs.length === 0 ? (
                <p className="text-ghost-400 italic">No hay líneas de registro todavía...</p>
              ) : (
                logs.map((line, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed break-all ${
                      line.includes('[WARN]')
                        ? 'text-spectral-amber'
                        : line.includes('[ERROR]')
                        ? 'text-spectral-rose'
                        : line.includes('[SUCCESS]')
                        ? 'text-spectral-mint'
                        : 'text-ghost-200'
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
