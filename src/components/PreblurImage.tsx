import React, { useEffect, useState } from 'react';

interface PreblurImageProps {
  src: string;
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Fondo desenfocado pre-horneado: dibuja la imagen en un canvas de 64 px con
 * ctx.filter y usa el resultado como background-image. Se ve igual que un
 * `filter: blur()` en vivo pero sin capa compuesta ni re-rasterizado por frame.
 */
export const PreblurImage: React.FC<PreblurImageProps> = ({
  src,
  blur = 14,
  className,
  style,
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = `blur(${blur}px) saturate(1.5)`;
        const side = Math.min(image.width, image.height) || 64;
        ctx.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          64,
          64
        );
        const data = canvas.toDataURL();
        if (!cancelled) setUrl(data);
      } catch {
        // imagen sin CORS: mejor sin fondo que con un canvas tainted
        if (!cancelled) setUrl(null);
      }
    };
    image.onerror = () => {
      if (!cancelled) setUrl(null);
    };
    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, blur]);

  if (!url) return null;

  return (
    <div
      className={className}
      style={{
        ...style,
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
};
