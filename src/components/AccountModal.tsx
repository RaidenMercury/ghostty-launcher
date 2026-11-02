import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  X,
  UserPlus,
  Check,
  Trash2,
  LogOut,
  Shield,
  Upload,
  RotateCcw,
  User,
  Shirt,
  KeyRound,
  Globe,
  ExternalLink,
  Copy,
  Loader2,
} from 'lucide-react';
import { Account, Cape } from '../types';
import { PlayerHead } from './PlayerHead';
import { api } from '../services/api';
import { SkinViewer3D } from './SkinViewer3D';
import { useI18n } from '../utils/i18n';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onAddAccount: (username: string) => Promise<void>;
  onLoginElyBy?: (username: string, password: string, totp?: string) => Promise<void>;
  onLoginMicrosoft?: (identifier: string) => Promise<void>;
  onAccountAuthenticated?: (account: Account) => void;
  onSetActive: (id: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onUpdateSkin?: (
    accountId: string,
    skinUrl: string | null,
    skinModel: 'classic' | 'slim'
  ) => Promise<void>;
}

export const CustomSkinCanvasPreview: React.FC<{
  skinDataUri: string;
  slim: boolean;
}> = ({ skinDataUri, slim }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const scale = 6;

      ctx.drawImage(img, 8, 8, 8, 8, 4 * scale, 0 * scale, 8 * scale, 8 * scale);
      ctx.drawImage(img, 40, 8, 8, 8, 4 * scale, 0 * scale, 8 * scale, 8 * scale);

      ctx.drawImage(img, 20, 20, 8, 12, 4 * scale, 8 * scale, 8 * scale, 12 * scale);
      if (img.height >= 64) {
        ctx.drawImage(img, 20, 36, 8, 12, 4 * scale, 8 * scale, 8 * scale, 12 * scale);
      }

      const armW = slim ? 3 : 4;
      const rightArmX = slim ? 1 : 0;
      const leftArmX = 12;
      ctx.drawImage(
        img,
        44,
        20,
        armW,
        12,
        rightArmX * scale,
        8 * scale,
        armW * scale,
        12 * scale
      );
      if (img.height >= 64) {
        ctx.drawImage(
          img,
          36,
          52,
          armW,
          12,
          leftArmX * scale,
          8 * scale,
          armW * scale,
          12 * scale
        );
      } else {
        ctx.drawImage(
          img,
          44,
          20,
          armW,
          12,
          leftArmX * scale,
          8 * scale,
          armW * scale,
          12 * scale
        );
      }

      ctx.drawImage(img, 4, 20, 4, 12, 4 * scale, 20 * scale, 4 * scale, 12 * scale);
      if (img.height >= 64) {
        ctx.drawImage(img, 20, 52, 4, 12, 8 * scale, 20 * scale, 4 * scale, 12 * scale);
      } else {
        ctx.drawImage(img, 4, 20, 4, 12, 8 * scale, 20 * scale, 4 * scale, 12 * scale);
      }
    };
    img.src = skinDataUri;
  }, [skinDataUri, slim]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={192}
      className="h-40 w-auto object-contain"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

export function AccountModal({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onLoginElyBy,
  onLoginMicrosoft,
  onAccountAuthenticated,
  onSetActive,
  onDeleteAccount,
  onUpdateSkin,
}: AccountModalProps) {
  const { t, language } = useI18n();
  const [authTab, setAuthTab] = useState<'microsoft' | 'elyby' | 'offline'>('microsoft');
  const [username, setUsername] = useState('');
  const [elyUser, setElyUser] = useState('');
  const [elyPass, setElyPass] = useState('');
  const [elyTotp, setElyTotp] = useState('');
  const [msaIdentifier, setMsaIdentifier] = useState('');
  const [showManualMsa, setShowManualMsa] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [deviceCodeData, setDeviceCodeData] = useState<{
    user_code: string;
    verification_uri: string;
    device_code: string;
    interval: number;
  } | null>(null);
  const [isWaitingDeviceAuth, setIsWaitingDeviceAuth] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const activeAccount = accounts.find((a) => a.is_active) || accounts[0] || null;
  const [skinInput, setSkinInput] = useState('');
  const [skinModel, setSkinModel] = useState<'classic' | 'slim'>(
    activeAccount?.skin_model || 'classic'
  );
  const [capes, setCapes] = useState<Cape[]>([]);
  const [loadingCapes, setLoadingCapes] = useState(false);
  const [savingCape, setSavingCape] = useState(false);
  const [capeError, setCapeError] = useState<string | null>(null);
  const [accountSkinUrl, setAccountSkinUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeAccount) {
      setSkinModel(activeAccount.skin_model || 'classic');
      if (activeAccount.skin_url?.startsWith('mc-user:')) {
        setSkinInput(activeAccount.skin_url.replace('mc-user:', ''));
      } else {
        setSkinInput('');
      }
    }
  }, [activeAccount]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeAccount || activeAccount.account_type !== 'Microsoft') {
      setCapes([]);
      setCapeError(null);
      return;
    }
    let cancelled = false;
    setLoadingCapes(true);
    setCapeError(null);
    api
      .getAccountCapes(activeAccount.id)
      .then((list) => {
        if (!cancelled) setCapes(list);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setCapes([]);
          setCapeError(String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCapes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeAccount?.id, activeAccount?.account_type]);

  useEffect(() => {
    if (!isOpen) return;
    setAccountSkinUrl(null);
    if (!activeAccount || activeAccount.account_type !== 'Microsoft') {
      return;
    }
    let cancelled = false;
    api
      .getAccountSkin(activeAccount.id)
      .then((url) => {
        if (!cancelled) setAccountSkinUrl(url);
      })
      .catch(() => {
        if (!cancelled) setAccountSkinUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeAccount?.id, activeAccount?.account_type]);

  const handleSetCape = async (capeId: string | null) => {
    if (!activeAccount || savingCape) return;
    setSavingCape(true);
    setCapeError(null);
    try {
      const list = await api.setAccountCape(activeAccount.id, capeId);
      setCapes(list);
    } catch (e: any) {
      setCapeError(String(e));
    } finally {
      setSavingCape(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleStartDeviceOAuth = async () => {
    try {
      setOauthError(null);
      setIsAdding(true);
      const authData = await api.iniciarOauthDispositivo();
      setDeviceCodeData(authData);
      setIsWaitingDeviceAuth(true);
      api.openExternalUrl(authData.verification_uri);

      const account = await api.esperarAutorizacionMicrosoft(
        authData.device_code,
        authData.interval
      );
      setDeviceCodeData(null);
      setIsWaitingDeviceAuth(false);
      onAccountAuthenticated?.(account);
    } catch (err: any) {
      setOauthError(err?.toString() || 'Error al autenticar con Microsoft OAuth');
      setDeviceCodeData(null);
      setIsWaitingDeviceAuth(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCopyDeviceCode = () => {
    if (!deviceCodeData) return;
    navigator.clipboard?.writeText(deviceCodeData.user_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleAddOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      setIsAdding(true);
      await onAddAccount(username.trim());
      setUsername('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleElyBySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elyUser.trim() || !elyPass || !onLoginElyBy) return;
    try {
      setIsAdding(true);
      await onLoginElyBy(elyUser.trim(), elyPass, elyTotp.trim() || undefined);
      setElyUser('');
      setElyPass('');
      setElyTotp('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleMicrosoftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msaIdentifier.trim() || !onLoginMicrosoft) return;
    try {
      setIsAdding(true);
      await onLoginMicrosoft(msaIdentifier.trim());
      setMsaIdentifier('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleApplySkinNickOrUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount || !onUpdateSkin) return;
    const val = skinInput.trim();
    if (!val) return;
    const formatted =
      val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')
        ? val
        : `mc-user:${val}`;
    await onUpdateSkin(activeAccount.id, formatted, skinModel);
  };

  const handleUploadSkinFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAccount || !onUpdateSkin) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await onUpdateSkin(activeAccount.id, reader.result, skinModel);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleChangeModel = async (nextModel: 'classic' | 'slim') => {
    setSkinModel(nextModel);
    if (activeAccount && onUpdateSkin) {
      await onUpdateSkin(activeAccount.id, activeAccount.skin_url, nextModel);
    }
  };

  const handleResetSkin = async () => {
    if (!activeAccount || !onUpdateSkin) return;
    setSkinInput('');
    await onUpdateSkin(activeAccount.id, null, 'classic');
  };

  const isCustomDataSkin = Boolean(
    activeAccount?.skin_url &&
      (activeAccount.skin_url.startsWith('data:') || activeAccount.skin_url.startsWith('http'))
  );
  const mcNickForRender = activeAccount?.skin_url?.startsWith('mc-user:')
    ? activeAccount.skin_url.replace('mc-user:', '').trim()
    : activeAccount?.username || 'MHF_Steve';

  const viewerSkinUrl =
    isCustomDataSkin && activeAccount?.skin_url
      ? activeAccount.skin_url
      : (accountSkinUrl?.replace(/^http:/, 'https:') ??
        `https://mc-heads.net/skin/${encodeURIComponent(mcNickForRender)}`);
  const activeCapeUrl = capes.find((c) => c.active)?.url.replace(/^http:/, 'https:') ?? null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={onClose}
            className="fixed inset-0 modal-scrim"
          />

          <div className="relative w-full max-w-3xl h-[min(86vh,720px)] glass-panel-strong p-6 text-ghost-100 z-10 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b glass-divider">
              <div>
                <h3 className="heading-display text-2xl font-extrabold text-ghost-50">
                  {t.acc_modal_title}
                </h3>
                <p className="text-xs text-ghost-400">
                  {t.acc_modal_subtitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 min-h-0">
              <div className="md:col-span-5 flex flex-col min-h-0 md:border-r glass-divider md:pr-5">
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-ghost-300 mb-2">
                    <User className="w-3.5 h-3.5 accent-text" />
                    <span>{t.acc_registered_accounts} ({accounts.length})</span>
                  </div>

                  <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                    {accounts.map((acc) => {
                      const badgeType =
                        acc.account_type === 'Microsoft'
                          ? 'MSA'
                          : acc.account_type === 'ElyBy'
                          ? 'ELY.BY'
                          : 'OFFLINE';
                      const badgeStyle =
                        acc.account_type === 'Microsoft'
                          ? 'bg-spectral-mint/15 text-spectral-mint border-spectral-mint/30'
                          : acc.account_type === 'ElyBy'
                          ? 'bg-white/10 text-ghost-200 border-white/15'
                          : 'bg-white/5 text-ghost-300 border-[var(--glass-border)]';

                      return (
                        <div
                          key={acc.id}
                          onClick={() => onSetActive(acc.id)}
                          className={`flex items-center justify-between py-2 px-2.5 rounded-control cursor-pointer transition-colors border outline-none ${
                            acc.is_active
                              ? 'bg-[var(--glass-hover)] border-white/20 shadow-sm'
                              : 'bg-[var(--glass-subtle)] hover:bg-[var(--glass-hover)] border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-control overflow-hidden glass-control p-0.5 shrink-0 flex items-center justify-center">
                              <PlayerHead account={acc} size={36} className="rounded-[7px]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-ghost-50 truncate">
                                  {acc.username}
                                </span>
                                <span
                                  className={`text-[8px] uppercase font-mono px-1.5 py-0.5 rounded-full border font-bold ${badgeStyle}`}
                                >
                                  {badgeType}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-ghost-400 tabular-nums mt-0.5">
                                {acc.skin_model === 'slim' ? 'Slim' : (language === 'es' ? 'Clásico' : 'Classic')} •{' '}
                                {acc.uuid.substring(0, 8)}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {acc.is_active && (
                              <div className="w-5 h-5 rounded-full accent-bg text-white flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAccount(acc.id);
                              }}
                              className="btn-tactile p-1.5 rounded-control text-ghost-400 hover:text-spectral-rose"
                              title={acc.is_active ? (language === 'es' ? 'Cerrar sesión' : 'Log out') : (language === 'es' ? 'Eliminar cuenta' : 'Delete account')}
                            >
                              {acc.is_active ? <LogOut className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t glass-divider space-y-2.5 shrink-0">
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-control glass-control text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setAuthTab('microsoft')}
                      className={`py-1 rounded-[8px] font-semibold transition-all ${
                        authTab === 'microsoft'
                          ? 'accent-bg text-white'
                          : 'text-ghost-300 hover:text-ghost-50'
                      }`}
                    >
                      Minecraft
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab('elyby')}
                      className={`py-1 rounded-[8px] font-semibold transition-all ${
                        authTab === 'elyby'
                          ? 'accent-bg text-white'
                          : 'text-ghost-300 hover:text-ghost-50'
                      }`}
                    >
                      Ely.by
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthTab('offline')}
                      className={`py-1 rounded-[8px] font-semibold transition-all ${
                        authTab === 'offline'
                          ? 'accent-bg text-white'
                          : 'text-ghost-300 hover:text-ghost-50'
                      }`}
                    >
                      Offline
                    </button>
                  </div>

                  <div className="min-h-[140px] flex flex-col justify-between pt-1">
                    {authTab === 'microsoft' && (
                      <div key="auth-tab-microsoft" className="h-full flex flex-col justify-between space-y-3">
                        {deviceCodeData ? (
                          <div className="h-full flex flex-col justify-between space-y-1.5 p-2 rounded-control bg-black/35 border border-[var(--glass-border)]">
                            <div className="flex items-center justify-between text-[10px] font-mono text-ghost-300 shrink-0">
                              <span>{t.acc_code_in_ms}</span>
                              <button
                                type="button"
                                onClick={() => api.openExternalUrl(deviceCodeData.verification_uri)}
                                className="accent-text hover:underline flex items-center gap-1"
                              >
                                <span>{t.acc_open_link}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-control bg-black/40 border border-white/10">
                              <span className="font-mono text-sm font-extrabold tracking-widest accent-text select-all">
                                {deviceCodeData.user_code}
                              </span>
                              <button
                                type="button"
                                onClick={handleCopyDeviceCode}
                                className="btn-tactile px-2 py-0.5 rounded glass-control text-[10px] font-mono flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedCode ? t.acc_copied : t.acc_copy}</span>
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono text-ghost-400 shrink-0">
                              <span className="flex items-center gap-1.5 text-spectral-mint truncate">
                                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                <span className="truncate">{t.acc_msa_waiting}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeviceCodeData(null);
                                  setIsWaitingDeviceAuth(false);
                                  setOauthError(null);
                                }}
                                className="text-ghost-400 hover:text-spectral-rose shrink-0 ml-2"
                              >
                                {t.acc_cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col justify-between space-y-2">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono text-ghost-300 block">
                                {t.acc_msa_official}
                              </span>
                              <button
                                type="button"
                                disabled={isAdding || isWaitingDeviceAuth}
                                onClick={handleStartDeviceOAuth}
                                className="btn-tactile w-full py-2.5 rounded-control accent-bg text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                <span>
                                  {isAdding
                                    ? t.acc_msa_requesting
                                    : t.acc_login_msa_btn}
                                </span>
                              </button>
                              {oauthError && (
                                <p className="text-[10px] font-mono text-spectral-rose leading-tight">
                                  {oauthError}
                                </p>
                              )}
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => setShowManualMsa((v) => !v)}
                                className="text-[10px] font-mono text-ghost-400 hover:text-ghost-200 underline block"
                              >
                                {showManualMsa
                                  ? t.acc_manual_link_hide
                                  : t.acc_manual_link_prompt}
                              </button>

                              {showManualMsa && (
                                <form onSubmit={handleMicrosoftSubmit} className="flex gap-1.5 pt-1.5">
                                  <input
                                    type="text"
                                    placeholder="Gamertag / MSA Token..."
                                    value={msaIdentifier}
                                    onChange={(e) => setMsaIdentifier(e.target.value)}
                                    className="flex-1 px-2.5 py-1 glass-control text-xs font-mono"
                                  />
                                  <button
                                    type="submit"
                                    disabled={isAdding || !msaIdentifier.trim()}
                                    className="btn-tactile px-3 py-1 rounded-control glass-control text-xs font-semibold"
                                  >
                                    {t.acc_link_btn}
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {authTab === 'elyby' && (
                      <form key="auth-tab-elyby" onSubmit={handleElyBySubmit} className="h-full flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-ghost-300">
                            {t.acc_elyby_official}
                          </span>
                          <button
                            type="button"
                            onClick={() => api.openExternalUrl('https://account.ely.by/login')}
                            className="text-[10px] font-mono accent-text hover:underline flex items-center gap-1"
                          >
                            <span>ely.by</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder={language === 'es' ? 'Usuario o Correo de Ely.by...' : 'Ely.by Username or Email...'}
                          value={elyUser}
                          onChange={(e) => setElyUser(e.target.value)}
                          className="w-full px-2.5 py-1.5 glass-control text-xs font-mono"
                        />
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="password"
                            placeholder={language === 'es' ? 'Contraseña...' : 'Password...'}
                            value={elyPass}
                            onChange={(e) => setElyPass(e.target.value)}
                            className="col-span-2 px-2.5 py-1.5 glass-control text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder={language === 'es' ? '2FA (opc)' : '2FA (opt)'}
                            value={elyTotp}
                            onChange={(e) => setElyTotp(e.target.value)}
                            className="px-2 py-1.5 glass-control text-xs font-mono text-center"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isAdding || !elyUser.trim() || !elyPass}
                          className="btn-tactile w-full py-2 rounded-control accent-bg text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{isAdding ? t.acc_connect_elyby : t.acc_login_elyby}</span>
                        </button>
                      </form>
                    )}

                    {authTab === 'offline' && (
                      <form key="auth-tab-offline" onSubmit={handleAddOffline} className="h-full flex flex-col justify-between space-y-2">
                        <div>
                          <label className="block text-[10px] font-mono text-ghost-300 mb-0.5">
                            {t.acc_offline_title}
                          </label>
                          <p className="text-[10px] font-mono text-ghost-400">
                            {t.acc_offline_desc}
                          </p>
                        </div>

                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder={t.acc_player_name}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="flex-1 px-2.5 py-2 glass-control text-xs font-mono"
                          />
                          <button
                            type="submit"
                            disabled={isAdding || !username.trim()}
                            className="btn-tactile px-4 py-2 rounded-control accent-bg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{t.acc_create_offline}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 flex flex-col min-h-0 overflow-hidden pr-1">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-mono uppercase text-ghost-300">
                    <Shirt className="w-3.5 h-3.5 accent-text" />
                    <span>
                      {t.acc_skin_studio}:{' '}
                      <strong className="text-ghost-50">{activeAccount?.username}</strong>
                    </span>
                  </div>

                </div>

                {activeAccount && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center shrink-0">
                    <div className="sm:col-span-5 h-52 rounded-card glass-card flex flex-col items-center justify-center p-3 relative overflow-hidden">
                      <div
                        className="absolute inset-0 opacity-25 pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle at 50% 35%, rgba(var(--accent-rgb), 0.45), transparent 70%)',
                        }}
                      />

                      <SkinViewer3D
                        key={activeAccount?.id}
                        skinUrl={viewerSkinUrl}
                        slim={skinModel === 'slim'}
                        capeUrl={activeCapeUrl}
                        width={190}
                        height={210}
                      />

                    </div>

                    <div className="sm:col-span-7 space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-ghost-400 mb-1">
                          {t.acc_arm_geometry}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleChangeModel('classic')}
                            className={`btn-tactile py-1.5 px-2.5 rounded-control text-xs font-medium border text-center ${
                              skinModel === 'classic'
                                ? 'accent-pill-tint font-semibold'
                                : 'glass-control text-ghost-300'
                            }`}
                          >
                            {t.acc_classic_4px}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangeModel('slim')}
                            className={`btn-tactile py-1.5 px-2.5 rounded-control text-xs font-medium border text-center ${
                              skinModel === 'slim'
                                ? 'accent-pill-tint font-semibold'
                                : 'glass-control text-ghost-300'
                            }`}
                          >
                            {t.acc_slim_3px}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-ghost-400 mb-1">
                          {t.acc_local_file}
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="btn-tactile flex-1 py-1.5 px-3 glass-control text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer text-ghost-100">
                            <Upload className="w-3.5 h-3.5 accent-text" />
                            <span>{t.acc_upload_skin}</span>
                            <input
                              type="file"
                              accept="image/png"
                              className="hidden"
                              onChange={handleUploadSkinFile}
                            />
                          </label>

                          {activeAccount.skin_url && (
                            <button
                              type="button"
                              onClick={handleResetSkin}
                              className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-spectral-rose"
                              title={t.acc_reset_skin}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <form onSubmit={handleApplySkinNickOrUrl}>
                        <label className="block text-[10px] font-mono uppercase text-ghost-400 mb-1">
                          {t.acc_import_premium}
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder={language === 'es' ? 'ej. Technoblade, Notch o URL...' : 'e.g. Technoblade, Notch or URL...'}
                            value={skinInput}
                            onChange={(e) => setSkinInput(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 glass-control text-xs font-mono"
                          />
                          <button
                            type="submit"
                            disabled={!skinInput.trim()}
                            className="btn-tactile px-3 py-1.5 rounded-control accent-bg text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {t.acc_apply}
                          </button>
                        </div>
                      </form>

                    </div>
                  </div>
                )}

                {activeAccount && (
                  <div className="mt-3 pt-3 border-t glass-divider space-y-2 flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between shrink-0">
                      <label className="block text-[10px] font-mono uppercase text-ghost-400">
                        {t.acc_capes_title}
                      </label>
                      {activeAccount.account_type === 'Microsoft' && capes.some((c) => c.active) && (
                        <button
                          type="button"
                          disabled={savingCape}
                          onClick={() => handleSetCape(null)}
                          className="btn-tactile px-2.5 py-1 rounded-control glass-control text-[10px] font-mono text-ghost-300 disabled:opacity-50"
                        >
                          {t.acc_remove_cape}
                        </button>
                      )}
                    </div>

                    {activeAccount.account_type !== 'Microsoft' ? (
                      <p className="text-[11px] text-ghost-400">
                        Solo disponible para cuentas Microsoft. Ely.by gestiona sus capas en su web.
                      </p>
                    ) : loadingCapes ? (
                      <p className="text-[11px] text-ghost-400 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando capas...
                      </p>
                    ) : capeError ? (
                      <p className="text-[11px] text-spectral-rose/90">{capeError}</p>
                    ) : capes.length === 0 ? (
                      <p className="text-[11px] text-ghost-400">Esta cuenta no tiene capas.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
                        {capes
                          .filter(
                            (cape) => !(cape.alias || '').toLowerCase().includes('elytra')
                          )
                          .map((cape) => (
                          <button
                            key={cape.id}
                            type="button"
                            disabled={savingCape}
                            onClick={() => handleSetCape(cape.id)}
                            title={cape.alias || 'Capa'}
                            className={`btn-tactile relative rounded-control border px-2 py-2 flex flex-col items-center gap-1.5 disabled:opacity-50 ${
                              cape.active
                                ? 'accent-pill-tint border-[var(--accent)]'
                                : 'glass-control border-white/10 text-ghost-300'
                            }`}
                          >
                            <div
                              role="img"
                              aria-label={cape.alias || 'Capa'}
                              className="h-20 w-full rounded-[6px]"
                              style={{
                                backgroundImage: `url(${cape.url.replace(/^http:/, 'https:')})`,
                                backgroundSize: '290% 190%',
                                backgroundPosition: '0 0',
                                imageRendering: 'pixelated',
                              }}
                            />
                            <span className="text-[9px] font-mono">
                              {cape.active ? 'Activa' : cape.alias || 'Capa'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t glass-divider text-[11px] text-ghost-400 flex items-center gap-2 shrink-0">
                  <Shield className="w-4 h-4 accent-text shrink-0" />
                  <span>
                    Inyección automática de tokens MSA (`--accessToken`) y propiedades JVM de Ely.by (`-Dminecraft.api.*`).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
