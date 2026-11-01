import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  icon?: React.ReactNode;
  inputConfig?: {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
  };
  onConfirm: (inputValue?: string) => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  icon,
  inputConfig,
  onConfirm,
  onClose,
}) => {
  const [val, setVal] = useState(inputConfig?.defaultValue || '');
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVal(inputConfig?.defaultValue || '');
      // Enfocar input si existe, de lo contrario enfocar botón de cancelar por seguridad
      setTimeout(() => {
        if (inputConfig) {
          inputRef.current?.focus();
          inputRef.current?.select();
        } else {
          cancelButtonRef.current?.focus();
        }
      }, 50);
    }
  }, [isOpen, inputConfig]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (inputConfig && !val.trim()) return;
        e.preventDefault();
        onConfirm(inputConfig ? val.trim() : undefined);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, val, inputConfig, onConfirm, onClose]);

  const isDanger = variant === 'danger';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={onClose}
            className="fixed inset-0 modal-scrim"
          />

          <div
            className={`relative w-full max-w-md glass-panel-strong p-6 text-ghost-100 z-10 overflow-hidden shadow-2xl ${
              isDanger ? 'border-spectral-rose/30' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-control shrink-0 flex items-center justify-center ${
                  isDanger
                    ? 'bg-spectral-rose/15 border border-spectral-rose/30 text-spectral-rose'
                    : 'bg-white/5 border border-white/10 text-ghost-200'
                }`}
              >
                {icon ? (
                  icon
                ) : isDanger ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-spectral-amber" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <h3 className="heading-display text-lg font-bold text-ghost-50 tracking-tight">
                  {title}
                </h3>
                <p className="mt-1 text-xs text-ghost-300 leading-relaxed">
                  {description}
                </p>

                {inputConfig && (
                  <div className="mt-4">
                    {inputConfig.label && (
                      <label className="block text-[11px] font-mono text-ghost-300 mb-1.5">
                        {inputConfig.label}
                      </label>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      placeholder={inputConfig.placeholder}
                      className="w-full px-3.5 py-2 glass-control text-xs text-ghost-100 placeholder:text-ghost-500 rounded-control"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="btn-tactile p-1.5 glass-control text-ghost-400 hover:text-ghost-100 absolute top-4 right-4"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                ref={cancelButtonRef}
                onClick={onClose}
                className="btn-tactile px-4 py-2 glass-control text-xs font-medium text-ghost-300 hover:text-ghost-100 rounded-control"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => onConfirm(inputConfig ? val.trim() : undefined)}
                disabled={inputConfig ? !val.trim() : false}
                className={`btn-tactile px-4 py-2 text-xs font-semibold rounded-control flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDanger
                    ? 'bg-spectral-rose/25 hover:bg-spectral-rose/35 border border-spectral-rose/50 text-spectral-rose'
                    : 'bg-white/15 hover:bg-white/20 border border-white/20 text-ghost-50'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

