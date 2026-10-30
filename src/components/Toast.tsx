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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-spectral-mint shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-spectral-amber shrink-0" />,
            error: <XCircle className="w-5 h-5 text-spectral-rose shrink-0" />,
            info: <Info className="w-5 h-5 text-spectral-cyan shrink-0" />,
          };

          const borders = {
            success: 'border-spectral-mint/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]',
            warning: 'border-spectral-amber/30 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]',
            error: 'border-spectral-rose/30 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]',
            info: 'border-spectral-cyan/30 shadow-[0_0_20px_-5px_rgba(56,189,248,0.3)]',
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`pointer-events-auto p-4 rounded-xl bg-ghost-900/95 backdrop-blur-md border ${borders[toast.type]} flex items-start gap-3 text-ghost-100`}
            >
              <div className="mt-0.5">{icons[toast.type]}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-ghost-100">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-ghost-400 mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-ghost-500 hover:text-ghost-300 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

