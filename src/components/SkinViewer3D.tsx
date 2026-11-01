import React, { useEffect, useRef } from 'react';
import { IdleAnimation, SkinViewer } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl: string | null;
  slim: boolean;
  capeUrl?: string | null;
  width?: number;
  height?: number;
}

/**
 * Visor 3D real (three.js + skinview3d): arrastra para rotar, rueda/autoRotate
 * para girar solo. Carga skin y capa activa; si falla la textura, se queda el
 * modelo por defecto sin romper la ventana.
 */
export const SkinViewer3D: React.FC<SkinViewer3DProps> = ({
  skinUrl,
  slim,
  capeUrl,
  width = 210,
  height = 250,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
    });
    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.6;
    viewer.zoom = 0.85;
    viewer.controls.enablePan = false;
    viewer.controls.enableZoom = false;
    viewer.controls.enableDamping = true;
    viewerRef.current = viewer;

    return () => {
      try {
        const gl =
          canvasRef.current?.getContext('webgl2') ||
          canvasRef.current?.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        /* noop */
      }
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (skinUrl) {
      viewer.loadSkin(skinUrl, { model: slim ? 'slim' : 'default' }).catch(() => {
        /* textura no disponible: se mantiene el modelo base */
      });
    } else {
      viewer.loadSkin(null);
    }
  }, [skinUrl, slim]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (capeUrl) {
      viewer.loadCape(capeUrl).catch(() => {
        viewer.resetCape();
      });
    } else {
      viewer.resetCape();
    }
  }, [capeUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-card"
      style={{ width, height, touchAction: 'none', cursor: 'grab' }}
    />
  );
};
