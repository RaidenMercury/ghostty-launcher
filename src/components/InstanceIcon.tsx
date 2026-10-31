import React, { useState, useEffect } from 'react';

export function hasCustomPackIcon(icon?: string | null): boolean {
  if (!icon) return false;
  const trimmed = icon.trim();
  if (
    !trimmed ||
    trimmed === 'minecraft' ||
    trimmed === 'ghostty' ||
    trimmed === 'cube' ||
    trimmed === 'default' ||
    trimmed === 'grass' ||
    trimmed === 'fabric' ||
    trimmed === 'forge' ||
    trimmed === 'neoforge' ||
    trimmed === 'quilt' ||
    trimmed === 'vanilla' ||
    trimmed === '/minecraft-icon.png'
  ) {
    return false;
  }
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('asset://')
  );
}

interface InstanceIconProps {
  icon?: string | null;
  alt?: string;
  className?: string;
  size?: number;
}

export const InstanceIcon: React.FC<InstanceIconProps> = ({
  icon,
  alt = 'Instance Icon',
  className = 'w-full h-full',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [icon]);

  const trimmed = icon?.trim() || '';

  if (trimmed === 'ghostty' || trimmed === '/ghostty.png') {
    return (
      <img
        src="/ghostty.png"
        alt={alt}
        draggable={false}
        className={`${className} object-contain rounded-[10px] select-none`}
      />
    );
  }

  const showCustom = hasCustomPackIcon(trimmed) && !imgError;

  if (showCustom) {
    return (
      <img
        src={trimmed}
        alt={alt}
        draggable={false}
        className={`${className} object-contain rounded-[10px] select-none`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <img
      src="/minecraft-icon.png"
      alt={alt}
      draggable={false}
      className={`${className} object-contain select-none drop-shadow-sm`}
    />
  );
};
