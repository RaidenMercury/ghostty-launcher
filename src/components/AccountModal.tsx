import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Check, Trash2, Shield, User } from 'lucide-react';
import { Account } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onAddAccount: (username: string) => Promise<void>;
  onSetActive: (id: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function AccountModal({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onSetActive,
  onDeleteAccount,
}: AccountModalProps) {
  const [username, setUsername] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      setIsAdding(true);
      await onAddAccount(username.trim());
      setUsername('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ghost-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="relative w-full max-w-md rounded-3xl bg-ghost-900 border border-ghost-700/80 shadow-2xl p-6 text-ghost-100 z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ghost-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-spectral-cyan/15 border border-spectral-cyan/30 flex items-center justify-center text-spectral-cyan">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ghost-100">Cuentas de Jugador</h3>
                  <p className="text-xs text-ghost-400">Selecciona o añade perfiles de Minecraft</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-ghost-400 hover:text-ghost-200 hover:bg-ghost-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account List */}
            <div className="mt-5 space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => onSetActive(acc.id)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    acc.is_active
                      ? 'bg-ghost-800/90 border-spectral-cyan/50 shadow-[0_0_15px_-5px_rgba(56,189,248,0.2)]'
                      : 'bg-ghost-850/60 border-ghost-800 hover:border-ghost-700 hover:bg-ghost-850'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                        acc.is_active
                          ? 'bg-gradient-to-tr from-spectral-cyan to-spectral-mint text-ghost-950 shadow-md'
                          : 'bg-ghost-800 text-ghost-300 border border-ghost-700'
                      }`}
                    >
                      {acc.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ghost-100">{acc.username}</span>
                        {acc.is_active && (
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-spectral-mint/15 text-spectral-mint border border-spectral-mint/30 font-bold">
                            Activo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-ghost-400">
                        UUID: {acc.uuid.substring(0, 8)}...
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {acc.is_active ? (
                      <div className="w-7 h-7 rounded-lg bg-spectral-mint/10 text-spectral-mint flex items-center justify-center">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAccount(acc.id);
                        }}
                        className="p-1.5 rounded-lg text-ghost-500 hover:text-spectral-rose hover:bg-ghost-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Offline Account Form */}
            <form onSubmit={handleAdd} className="mt-5 pt-4 border-t border-ghost-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ghost-300 mb-2 font-mono">
                Añadir Cuenta Offline
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de usuario..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl bg-ghost-850 border border-ghost-700 focus:border-spectral-cyan focus:outline-none text-xs text-ghost-100"
                />
                <button
                  type="submit"
                  disabled={isAdding || !username.trim()}
                  className="px-4 py-2 rounded-xl bg-ghost-800 hover:bg-ghost-750 border border-ghost-700 text-xs font-semibold text-ghost-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5 text-spectral-cyan" />
                  <span>Añadir</span>
                </button>
              </div>
            </form>

            <div className="mt-4 p-3 rounded-xl bg-ghost-850/50 border border-ghost-800/80 text-[11px] text-ghost-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-ghost-500 shrink-0" />
              <span>Soporte para inicio de sesión seguro con Microsoft OAuth y Offline UUID v3.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
