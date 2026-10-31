import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

export type MascotMood = 'idle' | 'launching' | 'celebrating' | 'sad' | 'loading';

interface GhosttyMascotProps {
  mood?: MascotMood;
  size?: 'sm' | 'md' | 'lg';
  caption?: string;
  onClick?: () => void;
}

/** Emoji de temporada sobre la mascota (fechas locales). */
function seasonalEmoji(date = new Date()): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 12 && day >= 15) return '🎄';
  if (month === 1 && day <= 6) return '🎉';
  if (month === 10 && day >= 25) return '🎃';
  if (month === 11 && day <= 2) return '💀';
  if (month === 4 && day <= 20) return '🐣';
  return null;
}

export const GhosttyMascot: React.FC<GhosttyMascotProps> = ({
  mood = 'idle',
  size = 'md',
  caption,
  onClick,
}) => {
  const sourceForSize: Record<string, string> = {
    sm: '/ghostty-96.png',
    md: '/ghostty-160.png',
    lg: '/ghostty-256.png',
  };

  const dimensions = {
    sm: 'w-11 h-11',
    md: 'w-16 h-16',
    lg: 'w-28 h-28',
  }[size];

  const glowColor =
    mood === 'sad'
      ? '244, 63, 94'
      : mood === 'celebrating'
      ? '16, 185, 129'
      : 'var(--accent-rgb)';

  const getAnimation = () => {
    switch (mood) {
      case 'launching':
        return {
          y: [0, -8, 0],
          scale: [1, 1.08, 1],
          transition: { duration: 0.65, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'celebrating':
        return {
          y: [0, -10, 0, -4, 0],
          rotate: [0, 10, -10, 4, 0],
          scale: [1, 1.12, 1],
          transition: { duration: 0.55, ease: 'easeOut' as const },
        };
      case 'sad':
        return {
          y: 2,
          scale: 0.95,
          transition: { duration: 0.3 },
        };
      case 'loading':
        return {
          y: [0, -5, 0],
          transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' as const },
        };
      case 'idle':
      default:
        return {
          y: 0,
          scale: 1,
          rotate: 0,
        };
    }
  };

  const renderMoodIcon = () => {
    switch (mood) {
      case 'launching':
        return <Zap className="w-3 h-3 accent-text" />;
      case 'celebrating':
        return <Sparkles className="w-3 h-3 text-spectral-mint" />;
      case 'sad':
        return <AlertCircle className="w-3 h-3 text-spectral-rose" />;
      case 'loading':
        return <Loader2 className="w-3 h-3 accent-text animate-spin" />;
      default:
        return null;
    }
  };

  const moodIcon = renderMoodIcon();

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center select-none ${
        onClick ? 'cursor-pointer group' : ''
      }`}
    >
      <div className="relative flex items-center justify-center p-2">
        <div
          className="absolute -inset-2 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(${glowColor}, 0.28) 0%, rgba(${glowColor}, 0.08) 45%, transparent 70%)`,
          }}
        />

        <motion.div
          animate={getAnimation()}
          whileHover={onClick ? { scale: 1.07, rotate: -3 } : undefined}
          whileTap={onClick ? { scale: 0.93 } : undefined}
          className={`relative ${dimensions} flex items-center justify-center ${
            mood === 'idle' ? 'animate-mascot-float' : ''
          }`}
        >
          <img
            src={sourceForSize[size] || '/ghostty.png'}
            alt="Ghostty Mascot"
            className={`w-full h-full object-contain ${
              mood === 'sad' ? 'grayscale-[40%] brightness-90' : ''
            }`}
          />

          {seasonalEmoji() && (
            <motion.span
              className="absolute -top-1.5 -right-1 text-base select-none pointer-events-none"
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              aria-hidden
            >
              {seasonalEmoji()}
            </motion.span>
          )}

          <AnimatePresence>
            {moodIcon && (
              <motion.span
                key={mood}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
                className="absolute -top-1 -right-1 text-xs bg-obsidian-900 border border-[var(--glass-border)] rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
              >
                {moodIcon}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {caption && (
        <span className="mt-1.5 text-xs text-ghost-300 font-medium text-center max-w-xs">
          {caption}
        </span>
      )}
    </div>
  );
};
