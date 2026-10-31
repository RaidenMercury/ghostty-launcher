import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  subtitle,
  badge,
  icon,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t glass-divider first:border-t-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full py-3.5 px-1 flex items-center justify-between text-left group transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="text-ghost-300 group-hover:text-ghost-50 transition-colors shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ghost-100 group-hover:text-ghost-50 transition-colors">
                {title}
              </span>
              {badge && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full glass-control text-ghost-300 tabular-nums">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-ghost-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-ghost-400 group-hover:text-ghost-100 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-4 pt-1 px-1 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
