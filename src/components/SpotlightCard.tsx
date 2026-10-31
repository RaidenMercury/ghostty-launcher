import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  enableTilt?: boolean;
  isSelected?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  isSelected = false,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    const glow = glowRef.current;
    if (!el || !glow) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - 140;
    const y = e.clientY - rect.top - 140;
    glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden transition-transform duration-150 ease-out hover:scale-[1.008] active:scale-[0.988] ${className} ${
        isSelected ? 'accent-ring' : ''
      }`}
    >
      {isHovered && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute top-0 left-0 w-[280px] h-[280px] rounded-full z-0"
          style={{
            background:
              'radial-gradient(circle, rgba(var(--accent-rgb), 0.16) 0%, transparent 70%)',
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
};
