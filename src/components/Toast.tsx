import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-12 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="w-4 h-4 text-spectral-mint shrink-0" />,
            warning: <AlertTriangle className="w-4 h-4 text-spectral-amber shrink-0" />,
            error: <XCircle className="w-4 h-4 text-spectral-rose shrink-0" />,
            info: <Info className="w-4 h-4 accent-text shrink-0" />,
          };

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto px-4 py-3 glass-panel-strong flex items-start gap-3 text-ghost-100"
            >
              <div className="mt-0.5">{icons[toast.type]}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-ghost-50 leading-snug">{toast.title}</h4>
                {toast.message && (
                  <p className="text-[11px] text-ghost-300 mt-0.5 leading-relaxed font-mono break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="btn-tactile text-ghost-400 hover:text-ghost-50 p-1 rounded"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
