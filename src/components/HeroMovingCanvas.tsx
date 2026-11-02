import React, { useEffect, useRef } from 'react';

interface HeroMovingCanvasProps {
  icon?: string | null;
  className?: string;
}

export const HeroMovingCanvas: React.FC<HeroMovingCanvasProps> = ({ icon, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isMounted = true;

    // Redimensionado del canvas al tamaño real del contenedor
    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener('resize', resize);

    // Cargar imagen de la estancia o modpack
    let img: HTMLImageElement | null = null;
    let imgLoaded = false;

    if (
      icon &&
      (icon.startsWith('http') ||
        icon.startsWith('data:image') ||
        icon.startsWith('/') ||
        icon.endsWith('.png') ||
        icon.endsWith('.svg'))
    ) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgLoaded = true;
      };
      img.src = icon.startsWith('/') ? icon : icon;
    }

    // Partículas / elementos flotantes en movimiento infinito
    interface FloatingOrb {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseAlpha: number;
      phase: number;
      rot: number;
      vRot: number;
      scale: number;
    }

    const orbCount = 7;
    const orbs: FloatingOrb[] = [];
    for (let i = 0; i < orbCount; i++) {
      orbs.push({
        x: Math.random() * (canvas.clientWidth || 800),
        y: Math.random() * (canvas.clientHeight || 300),
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.15 - Math.random() * 0.25, // Flota suavemente hacia arriba
        size: 70 + Math.random() * 110,
        baseAlpha: 0.12 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.004,
        scale: 0.8 + Math.random() * 0.5,
      });
    }

    let time = 0;

    const render = () => {
      if (!isMounted || !canvas || !ctx) return;
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 300;

      time += 0.015;
      ctx.clearRect(0, 0, w, h);

      // Fondo ambiental con gradiente dinámico sutil
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(15, 12, 28, 0.45)');
      grad.addColorStop(1, 'rgba(8, 7, 15, 0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Dibujar orbs flotantes con la imagen del pack o glows esféricos
      for (const orb of orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;
        orb.rot += orb.vRot;

        // Rebote / teletransporte infinito suave al salir de bordes
        if (orb.y < -orb.size) {
          orb.y = h + orb.size;
          orb.x = Math.random() * w;
        }
        if (orb.x < -orb.size) orb.x = w + orb.size;
        if (orb.x > w + orb.size) orb.x = -orb.size;

        const pulseAlpha = orb.baseAlpha + Math.sin(time + orb.phase) * 0.05;

        ctx.save();
        ctx.translate(orb.x, orb.y);
        ctx.rotate(orb.rot);

        if (imgLoaded && img) {
          ctx.globalAlpha = Math.max(0.04, Math.min(pulseAlpha, 0.35));
          // Filtro de desenfoque suave para la textura en movimiento
          ctx.drawImage(
            img,
            (-orb.size * orb.scale) / 2,
            (-orb.size * orb.scale) / 2,
            orb.size * orb.scale,
            orb.size * orb.scale
          );
        } else {
          // Glow de reemplazo si no hay imagen PNG externa
          const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, orb.size / 2);
          radGrad.addColorStop(0, `rgba(168, 85, 247, ${pulseAlpha * 1.5})`);
          radGrad.addColorStop(0.5, `rgba(99, 102, 241, ${pulseAlpha * 0.7})`);
          radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(0, 0, orb.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Onda central flotante con la imagen principal a gran escala y bajo contraste
      if (imgLoaded && img) {
        ctx.save();
        const mainW = Math.max(w * 0.55, 360);
        const mainH = mainW;
        const driftX = w * 0.75 + Math.sin(time * 0.6) * 28;
        const driftY = h * 0.45 + Math.cos(time * 0.5) * 18;
        ctx.translate(driftX, driftY);
        ctx.rotate(Math.sin(time * 0.25) * 0.05);
        ctx.globalAlpha = 0.14 + Math.sin(time * 0.8) * 0.03;
        ctx.drawImage(img, -mainW / 2, -mainH / 2, mainW, mainH);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [icon]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
      style={{ filter: 'blur(8px)', opacity: 0.75 }}
    />
  );
};

