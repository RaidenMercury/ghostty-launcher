import React, { useEffect, useRef } from 'react';
import { Account } from '../types';

export function getAccountAvatarUrl(account: Account | null, size = 28): string {
  if (!account) return '';

  if (account.account_type === 'ElyBy') {
    return `https://skins.ely.by/avatars/${encodeURIComponent(account.username)}`;
  }

  if (account.skin_url && account.skin_url.startsWith('mc-user:')) {
    const nick = account.skin_url.replace('mc-user:', '').trim();
    return `https://minotar.net/helm/${encodeURIComponent(nick)}/${size}`;
  }

  // Para cuentas Microsoft: Minotar resuelve directamente por UUID (más confiable) o username oficial
  const identifier = account.uuid ? account.uuid.replace(/-/g, '') : account.username;
  return `https://minotar.net/helm/${encodeURIComponent(identifier)}/${size}`;
}

interface PlayerHeadProps {
  account: Account | null;
  size?: number;
  className?: string;
}

export const PlayerHead: React.FC<PlayerHeadProps> = ({ account, size = 40, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDataUri = Boolean(
    account?.skin_url &&
      (account.skin_url.startsWith('data:') || account.skin_url.startsWith('http'))
  );

  useEffect(() => {
    if (!isDataUri || !account?.skin_url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      // Cabeza base: (8, 8, 8, 8) -> canvas (0, 0, size, size)
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      // Capa de pelo / sombrero: (40, 8, 8, 8) -> canvas (0, 0, size, size)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
    };
    img.src = account.skin_url;
  }, [account?.skin_url, isDataUri, size]);

  if (!account) {
    return <span className="text-[10px] font-bold font-mono">?</span>;
  }

  // Si tiene skin personalizada local en base64, renderizamos el canvas con la cabeza 8x8
  if (isDataUri && account.skin_url?.startsWith('data:')) {
    return (
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className={`object-cover ${className}`}
        style={{ imageRendering: 'pixelated', width: size, height: size }}
      />
    );
  }

  const avatarUrl = getAccountAvatarUrl(account, size);

  return (
    <img
      src={avatarUrl}
      alt={account.username}
      className={`w-full h-full object-cover ${className}`}
      style={{ imageRendering: 'pixelated' }}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (!target.src.includes('mc-heads.net')) {
          target.src = `https://mc-heads.net/avatar/${encodeURIComponent(account.username)}/${size}`;
        } else {
          target.src = `https://minotar.net/helm/MHF_Steve/${size}`;
        }
      }}
    />
  );
};

