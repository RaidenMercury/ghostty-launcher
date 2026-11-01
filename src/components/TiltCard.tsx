import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  maxTilt?: number;
  scale?: number;
}

/**
 * Tarjeta con tilt 3D que sigue al cursor y se eleva al pasar por encima.
 * Solo anima transform (compositor), sin repintar el fondo.
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className,
  disabled = false,
  maxTilt = 9,
  scale = 1.06,
}) => {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const hover = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [maxTilt, -maxTilt]), {
    stiffness: 320,
    damping: 26,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-maxTilt, maxTilt]), {
    stiffness: 320,
    damping: 26,
  });
  const scaleValue = useSpring(useTransform(hover, [0, 1], [1, scale]), {
    stiffness: 300,
    damping: 24,
  });

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerEnter={() => {
        if (!disabled) hover.set(1);
      }}
      onPointerLeave={() => {
        hover.set(0);
        px.set(0);
        py.set(0);
      }}
      style={{
        rotateX,
        rotateY,
        scale: scaleValue,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
