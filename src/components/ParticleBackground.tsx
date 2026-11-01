import React, { useEffect, useRef } from 'react';

interface StarParticle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  fadeSpeed: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  isSurge?: boolean;
  life?: number;
  maxLife?: number;
}

interface ParticleBackgroundProps {
  ambientEnabled?: boolean;
  paused?: boolean;
}

const SCALE_FACTOR = 0.5;

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  rotation: number,
  color: string,
  alpha: number
) {
  if (alpha <= 0.01) return;
  const innerRadius = outerRadius * 0.32;
  const clampedAlpha = Math.max(0, Math.min(1, alpha));

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  ctx.arc(0, 0, outerRadius * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = clampedAlpha * 0.18;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const outerAngle = (i * Math.PI) / 2;
    const innerAngle = outerAngle + Math.PI / 4;
    const ox = Math.cos(outerAngle) * outerRadius;
    const oy = Math.sin(outerAngle) * outerRadius;
    const ix = Math.cos(innerAngle) * innerRadius;
    const iy = Math.sin(innerAngle) * innerRadius;

    if (i === 0) {
      ctx.moveTo(ox, oy);
    } else {
      ctx.lineTo(ox, oy);
    }
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = clampedAlpha;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.5, outerRadius * 0.22), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = clampedAlpha * 0.9;
  ctx.fill();

  ctx.restore();
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  ambientEnabled = true,
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ambientEnabledRef = useRef(ambientEnabled);
  const pausedRef = useRef(paused);
  ambientEnabledRef.current = ambientEnabled;
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let width = (canvas.width = Math.max(320, Math.floor(window.innerWidth * SCALE_FACTOR)));
    let height = (canvas.height = Math.max(200, Math.floor(window.innerHeight * SCALE_FACTOR)));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = Math.max(320, Math.floor(window.innerWidth * SCALE_FACTOR));
      height = canvas.height = Math.max(200, Math.floor(window.innerHeight * SCALE_FACTOR));
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#c77dff', '#e0aaff', '#a855f7', '#67c6f5', '#f8fafc', '#38bdf8'];
    const ambientStars: StarParticle[] = [];
    const surgeStars: StarParticle[] = [];

    const ambientCount = 22;
    for (let i = 0; i < ambientCount; i++) {
      ambientStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: (Math.random() * 3.0 + 2.0) * SCALE_FACTOR,
        speedY: -(Math.random() * 0.4 + 0.15) * SCALE_FACTOR,
        speedX: (Math.random() - 0.5) * 0.16 * SCALE_FACTOR,
        opacity: Math.random() * 0.5 + 0.15,
        fadeSpeed: (Math.random() * 0.005 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.01,
      });
    }

    const handleStarlightSurge = (e: Event) => {
      const customEvt = e as CustomEvent<{ count?: number }>;
      const count = customEvt.detail?.count ?? 48;

      for (let i = 0; i < count; i++) {
        const maxLife = Math.floor(Math.random() * 60 + 60);
        surgeStars.push({
          x: Math.random() * width,
          y: height * (0.25 + Math.random() * 0.8),
          size: (Math.random() * 4.8 + 2.8) * SCALE_FACTOR,
          speedY: -(Math.random() * 2.4 + 1.2) * SCALE_FACTOR,
          speedX: (Math.random() - 0.5) * 0.55 * SCALE_FACTOR,
          opacity: 0.95,
          fadeSpeed: 0,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI,
          rotationSpeed: (Math.random() - 0.5) * 0.03,
          isSurge: true,
          life: 0,
          maxLife,
        });
      }
    };

    window.addEventListener('ghostty-starlight-surge', handleStarlightSurge);

    let lastFrameTime = 0;

    const render = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // ~30 fps: el efecto se mantiene y se reduce a la mitad el trabajo
      const nowMs = performance.now();
      if (nowMs - lastFrameTime < 32) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = nowMs;

      if (!ambientEnabledRef.current && surgeStars.length === 0) {
        ctx.clearRect(0, 0, width, height);
        animationFrameId = window.setTimeout(() => {
          animationFrameId = requestAnimationFrame(render);
        }, 300) as unknown as number;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      if (ambientEnabledRef.current && !pausedRef.current) {
        for (let i = 0; i < ambientStars.length; i++) {
          const p = ambientStars[i];
          p.y += p.speedY;
          p.x += p.speedX;
          p.rotation += p.rotationSpeed;
          p.opacity += p.fadeSpeed;

          if (p.opacity <= 0.12 || p.opacity >= 0.68) {
            p.fadeSpeed = -p.fadeSpeed;
          }

          if (p.y < -12) {
            p.y = height + 12;
            p.x = Math.random() * width;
          }
          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;

          drawFourPointStar(ctx, p.x, p.y, p.size, p.rotation, p.color, p.opacity * 0.72);
        }
      }

      for (let i = surgeStars.length - 1; i >= 0; i--) {
        const s = surgeStars[i];
        s.life = (s.life || 0) + 1;
        const maxL = s.maxLife || 100;
        const progress = s.life / maxL;

        s.y += s.speedY;
        s.x += s.speedX + Math.sin(s.life * 0.08) * 0.2;
        s.rotation += s.rotationSpeed;

        const alpha =
          progress < 0.15
            ? progress / 0.15
            : progress > 0.65
            ? Math.max(0, 1 - (progress - 0.65) / 0.35)
            : 1;

        drawFourPointStar(ctx, s.x, s.y, s.size, s.rotation, s.color, alpha * 0.9);

        if (s.life >= maxL || s.y < -16) {
          surgeStars.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('ghostty-starlight-surge', handleStarlightSurge);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
