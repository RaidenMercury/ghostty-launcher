import React, { useRef, useState, useEffect } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  enableTilt?: boolean;
  isSelected?: boolean;
  disableScale?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  isSelected = false,
  disableScale = false,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect();
    }
    setIsHovered(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rectRef.current && cardRef.current) {
      rectRef.current = cardRef.current.getBoundingClientRect();
    }
    const rect = rectRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return;

    posRef.current = {
      x: e.clientX - rect.left - 140,
      y: e.clientY - rect.top - 140,
    };

    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
      }
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rectRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const scaleClasses = disableScale
    ? ''
    : 'transition-transform duration-150 ease-out hover:scale-[1.008] active:scale-[0.988]';

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden ${scaleClasses} ${className} ${
        isSelected ? 'accent-ring' : ''
      }`}
    >
      {isHovered && (
        <div
          ref={glowRef}
          className="pointer-events-none absolute top-0 left-0 w-[280px] h-[280px] rounded-full z-0 will-change-transform"
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
