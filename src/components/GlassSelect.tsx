import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface GlassSelectOption<T = string | number> {
  value: T;
  label: string;
  badge?: string;
  sublabel?: string;
}

interface GlassSelectProps<T = string | number> {
  value: T;
  onChange: (val: T) => void;
  options: GlassSelectOption<T>[];
  placeholder?: string;
  className?: string;
  popoverWidth?: string;
  disabled?: boolean;
}

export function GlassSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  popoverWidth = 'w-full min-w-[200px]',
  disabled = false,
}: GlassSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOpt = options.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`btn-tactile w-full px-3 py-2 rounded-xl glass-control flex items-center justify-between gap-2.5 text-xs font-mono transition-all border border-white/10 hover:border-white/20 select-none ${
          isOpen ? 'ring-2 ring-[var(--accent)]/50 border-[var(--accent)]' : ''
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="truncate text-ghost-100 font-medium">
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
          {selectedOpt?.badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] font-bold uppercase shrink-0">
              {selectedOpt.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ghost-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--accent)]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={`absolute left-0 top-full mt-1.5 ${popoverWidth} max-h-60 overflow-y-auto p-1 rounded-xl glass-panel-strong shadow-2xl z-50 border border-[var(--glass-border)] space-y-0.5 select-none`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={String(opt.value)}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'accent-pill-tint border border-[var(--accent)]/50 font-bold text-white'
                      : 'hover:bg-white/10 text-ghost-300 hover:text-ghost-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-ghost-400 font-normal truncate">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-ghost-300 uppercase">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
