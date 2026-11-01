import { useState, useEffect, useRef } from 'react';
import { PackageOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DynamicIslandHeader,
  MainTabId,
  LiveActivityInfo,
} from './components/DynamicIslandHeader';
import { StatusFooterDock } from './components/StatusFooterDock';
import { ParticleBackground } from './components/ParticleBackground';
import { InstancesView } from './views/InstancesView';
import { DiscoverView } from './views/DiscoverView';
import { ModsManagerView } from './views/ModsManagerView';
import { SettingsView } from './views/SettingsView';
import { CreateInstanceModal } from './components/CreateInstanceModal';
import { AccountModal } from './components/AccountModal';
import { InstanceSettingsModal } from './components/InstanceSettingsModal';
import { GameLogsModal } from './components/GameLogsModal';
import { ContextMenu, ContextMenuState } from './components/ContextMenu';
import { ToastContainer, ToastMessage } from './components/Toast';
import { MascotMood } from './components/GhosttyMascot';
import { Account, Instance, CreateInstancePayload, MojangManifest } from './types';
import { api } from './services/api';
import {
  ThemeSettings,
  ThemePresetId,
  loadThemeSettings,
  saveThemeSettings,
  applyThemeToDocument,
} from './utils/theme';
import {
  triggerInstallSuccessConfetti,
  triggerAscendingStarlight,
} from './utils/confetti';

const THEME_CYCLE_ORDER: ThemePresetId[] = ['obsidian', 'midnight', 'graphite', 'light'];

export function App() {
  const [currentTab, setCurrentTab] = useState<MainTabId>('instances');
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);

  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() =>
    loadThemeSettings()
  );

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeInstance, setActiveInstance] = useState<Instance | null>(null);
  const [manifest, setManifest] = useState<MojangManifest | null>(null);

  const [selectedInstanceForSettings, setSelectedInstanceForSettings] = useState<Instance | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const [menuContext, setMenuContext] = useState<'instance' | 'group' | 'empty'>('instance');
  const [menuGroup, setMenuGroup] = useState<string | null>(null);
  const [discordEnabled, setDiscordEnabled] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'general' | 'iconos' | 'java' | 'display'>('general');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const globalImportInputRef = useRef<HTMLInputElement | null>(null);
  const downloadTimerRef = useRef<number | null>(null);

  const [liveActivity, setLiveActivity] = useState<LiveActivityInfo>({
    mode: 'idle',
    title: '',
  });
  const [gameLogs, setGameLogs] = useState<string[]>([
    '[INFO] GhosttyLauncher JVM Supervisor inicializado.',
    '[INFO] Listo para lanzar instancias de Minecraft.',
  ]);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [isDraggingPack, setIsDraggingPack] = useState(false);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [overlayBlur, setOverlayBlur] = useState(false);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const dragImportRef = useRef<((fileOrPath: File | string) => void) | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    applyThemeToDocument(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;
    let unlistenLog: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenModpackProgress: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenLog = await listen<{ line: string; level: string }>('game-log', (event) => {
          const { line, level } = event.payload;
          setGameLogs((prev) => [...prev.slice(-400), `[${level}] ${line}`]);
        });
        unlistenProgress = await listen<{
          stage: string;
          current: number;
          total: number;
          detail: string;
        }>('launch-progress', (event) => {
          const { stage, current, total } = event.payload;
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 50;
          setLiveActivity((prev) =>
            prev.mode === 'playing'
              ? prev
              : {
                  mode: 'downloading',
                  title: stage,
                  progress: pct,
                }
          );
        });
        unlistenModpackProgress = await listen<{
          current: number;
          total: number;
          filename: string;
        }>('modpack-progress', (event) => {
          if (downloadTimerRef.current) {
            window.clearInterval(downloadTimerRef.current);
            downloadTimerRef.current = null;
          }
          const { current, total, filename } = event.payload;
          const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 50;
          setLiveActivity((prev) =>
            prev.mode === 'playing'
              ? prev
              : {
                  mode: 'downloading',
                  title: `Instalando (${current}/${total}) • ${filename}`,
                  progress: pct,
                }
          );
        });
        unlistenExit = await listen('game-exited', () => {
          setLiveActivity({ mode: 'idle', title: '' });
          setGameLogs((prev) => [...prev, '[INFO] Proceso de Minecraft finalizado (Código 0).']);
        });
      } catch {}
    })();

    return () => {
      unlistenLog?.();
      unlistenProgress?.();
      unlistenModpackProgress?.();
      unlistenExit?.();
    };
  }, []);

  useEffect(() => {
    if (liveActivity.mode !== 'playing') return;
    const interval = setInterval(() => {
      setLiveActivity((prev) => ({
        ...prev,
        elapsedSeconds: (prev.elapsedSeconds || 0) + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [liveActivity.mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const lower = e.key.toLowerCase();
      if (
        e.key === 'F5' ||
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) &&
          ['r', 'u', 'p', 's', 'f', 'g'].includes(lower)) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 'r'].includes(lower))
      ) {
        e.preventDefault();
        return;
      }

      if (e.altKey) {
        if (lower === '1') {
          e.preventDefault();
          setCurrentTab('instances');
          setIsIslandExpanded(false);
        } else if (lower === '2') {
          e.preventDefault();
          setCurrentTab('discover');
          setIsIslandExpanded(true);
        } else if (lower === '3') {
          e.preventDefault();
          setCurrentTab('mods');
          setIsIslandExpanded(true);
        } else if (lower === '4') {
          e.preventDefault();
          setCurrentTab('settings');
          setIsIslandExpanded(true);
        } else if (lower === 'n') {
          e.preventDefault();
          setIsCreateOpen(true);
        } else if (lower === 'i') {
          e.preventDefault();
          globalImportInputRef.current?.click();
        }
      }
      if (e.key === 'Escape' && isIslandExpanded && currentTab !== 'instances') {
        setCurrentTab('instances');
        setIsIslandExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIslandExpanded, currentTab]);

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const instanceEl = target.closest('[data-instance-id]');
    const groupEl = target.closest('[data-group-tab]');

    if (instanceEl) {
      const id = instanceEl.getAttribute('data-instance-id');
      const inst = instances.find((i) => i.id === id);
      if (inst) setActiveInstance(inst);
      setMenuContext('instance');
      setMenuGroup(null);
    } else if (groupEl) {
      setMenuContext('group');
      setMenuGroup(groupEl.getAttribute('data-group-tab'));
    } else {
      setMenuContext('empty');
      setMenuGroup(null);
    }

    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
  };

  const handleChangeIcon = () => {
    if (!activeInstance) return;
    setSettingsTab('iconos');
    setSelectedInstanceForSettings(activeInstance);
  };

  const handleRenameGroup = () => {
    if (!menuGroup) return;
    const next = window.prompt('Nuevo nombre del grupo:', menuGroup);
    if (!next || !next.trim() || next.trim() === menuGroup) return;
    window.dispatchEvent(
      new CustomEvent('ghostty:rename-group', { detail: { from: menuGroup, to: next.trim() } })
    );
  };

  const handleDeleteGroup = () => {
    if (!menuGroup) return;
    if (!window.confirm(`¿Eliminar el grupo "${menuGroup}"? Las instancias no se borran.`)) return;
    window.dispatchEvent(new CustomEvent('ghostty:delete-group', { detail: menuGroup }));
  };

  const handleUpdateThemeSettings = (next: ThemeSettings) => {
    setThemeSettings(next);
    saveThemeSettings(next);
  };

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE_ORDER.indexOf(themeSettings.preset);
    const nextPreset = THEME_CYCLE_ORDER[(idx + 1) % THEME_CYCLE_ORDER.length];
    handleUpdateThemeSettings({ ...themeSettings, preset: nextPreset });
  };

  const pulseMascot = (mood: MascotMood, durationMs = 2600) => {
    setMascotMood(mood);
    setTimeout(() => {
      setMascotMood('idle');
    }, durationMs);
  };

  const addToast = (
    type: 'success' | 'warning' | 'error' | 'info',
    title: string,
    message?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    if (type === 'error') {
      pulseMascot('sad', 3200);
    } else if (type === 'success') {
      pulseMascot('celebrating', 2200);
    }
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadInitialData = async () => {
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
      const activeAcc = accs.find((a) => a.is_active) || accs[0] || null;
      setActiveAccount(activeAcc);

      const insts = await api.getInstances();
      setInstances(insts);
      if (insts.length > 0) {
        setActiveInstance(insts[0]);
      }

      const man = await api.getMojangManifest();
      setManifest(man);
    } catch (e: any) {
      addToast('error', 'Error al cargar datos', e.toString());
    }
  };

  const handleUpdateInstance = async (inst: Instance) => {
    try {
      await api.updateInstance(inst);
      setInstances((prev) => prev.map((i) => (i.id === inst.id ? inst : i)));
      if (activeInstance?.id === inst.id) {
        setActiveInstance(inst);
      }
    } catch (e: any) {
      addToast('error', 'Error al actualizar', e.toString());
    }
  };

  const handleCreateInstance = async (payload: CreateInstancePayload) => {
    try {
      const newInst = await api.createInstance(payload);
      if (!newInst.icon || newInst.icon === 'ghostty' || newInst.icon === 'cube') {
        newInst.icon = 'minecraft';
      }
      setInstances((prev) => [newInst, ...prev]);
      setActiveInstance(newInst);
      if (themeSettings.launchBurstEnabled) {
        triggerInstallSuccessConfetti();
      }
      addToast(
        'success',
        'Estancia Creada',
        `Se creó "${newInst.name}" (${newInst.loader} ${newInst.mc_version}).`
      );
    } catch (e: any) {
      addToast('error', 'Error al crear', e.toString());
    }
  };

  const persistInstance = async (updated: Instance) => {
    await api.updateInstance(updated);
    setInstances((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (activeInstance?.id === updated.id) setActiveInstance(updated);
  };

  const toggleFavoriteFor = async (target: Instance) => {
    try {
      const updated = { ...target, favorite: !target.favorite };
      await persistInstance(updated);
      addToast(
        'success',
        updated.favorite ? 'Añadida a Favoritos' : 'Quitada de Favoritos',
        target.name
      );
    } catch (e: any) {
      addToast('error', 'No se pudo actualizar', String(e));
    }
  };

  const handleToggleFavorite = async () => {
    if (activeInstance) await toggleFavoriteFor(activeInstance);
  };

  const openGroupPicker = () => {
    if (!activeInstance) return;
    try {
      const raw = localStorage.getItem('ghostty_launcher_groups');
      const groups: string[] = raw ? JSON.parse(raw) : [];
      setGroupOptions(groups.filter((g) => g !== 'Todos' && g !== 'Favoritos'));
    } catch {
      setGroupOptions([]);
    }
    // El blur se compone un frame antes de pintar el modal: si ambos cambian en
    // el mismo frame, WebKitGTK muestra un frame viejo (el "fantasma").
    setOverlayBlur(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsGroupPickerOpen(true));
    });
  };

  const closeGroupPicker = () => {
    setIsGroupPickerOpen(false);
    requestAnimationFrame(() => setOverlayBlur(false));
  };

  const applyGroup = async (group: string | null) => {
    if (!activeInstance) return;
    closeGroupPicker();
    try {
      await persistInstance({ ...activeInstance, group });
      addToast('success', 'Grupo actualizado', group || 'Sin grupo');
    } catch (e: any) {
      addToast('error', 'No se pudo actualizar', String(e));
    }
  };

  const assignGroupFor = async (target: Instance, group: string | null) => {
    try {
      await persistInstance({ ...target, group });
      addToast('success', 'Grupo actualizado', group || 'Sin grupo');
    } catch (e: any) {
      addToast('error', 'No se pudo actualizar', String(e));
    }
  };

  const handleDuplicateInstance = async () => {
    if (!activeInstance) return;
    try {
      const copy = await api.duplicateInstance(activeInstance.id);
      setInstances((prev) => [copy, ...prev]);
      setActiveInstance(copy);
      addToast('success', 'Instancia duplicada', copy.name);
    } catch (e: any) {
      addToast('error', 'No se pudo duplicar', String(e));
    }
  };

  const handleDeleteActive = () => {
    if (!activeInstance) return;
    if (!window.confirm(`¿Eliminar la instancia "${activeInstance.name}"?`)) return;
    handleDeleteInstance(activeInstance.id);
  };

  const handleDeleteInstance = async (id: string) => {
    try {
      await api.deleteInstance(id);
      setInstances((prev) => prev.filter((i) => i.id !== id));
      if (activeInstance?.id === id) {
        const remaining = instances.filter((i) => i.id !== id);
        setActiveInstance(remaining[0] || null);
      }
      addToast('info', 'Estancia eliminada');
    } catch (e: any) {
      addToast('error', 'Error al eliminar', e.toString());
    }
  };

  const handleImportModpack = async (fileOrPath: File | string) => {
    try {
      const displayLabel =
        typeof File !== 'undefined' && fileOrPath instanceof File
          ? fileOrPath.name
          : String(fileOrPath).split(/[\\/]/).pop() || 'Modpack';

      startDownloadActivity(`Extrayendo ${displayLabel}...`);
      const inst = await api.importModpackFile(fileOrPath);
      const mods = await api.getInstanceMods(inst.id);

      setInstances((prev) => [inst, ...prev.filter((i) => i.id !== inst.id)]);
      setActiveInstance(inst);

      if (themeSettings.launchBurstEnabled) {
        triggerInstallSuccessConfetti();
      }
      addToast(
        'success',
        'Modpack Importado con Éxito',
        `"${inst.name}" • ${inst.loader.toUpperCase()} ${inst.mc_version} (${mods.length} mods instalados).`
      );
    } catch (e: any) {
      addToast('error', 'Error al importar modpack', e.toString());
    } finally {
      endDownloadActivity();
    }
  };

  dragImportRef.current = handleImportModpack;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import('@tauri-apps/api/webview')
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          const payload = event.payload as { type: string; paths?: string[] };
          if (payload.type === 'enter' || payload.type === 'over') {
            setIsDraggingPack(true);
          } else if (payload.type === 'drop') {
            setIsDraggingPack(false);
            const path = payload.paths?.[0];
            if (path) dragImportRef.current?.(path);
          } else {
            setIsDraggingPack(false);
          }
        })
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        /* entorno web sin Tauri */
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleExportInstance = async (
    id: string,
    format: 'mrpack' | 'prism' | 'curseforge'
  ) => {
    startDownloadActivity('Exportando pack...');
    try {
      const path = await api.exportInstance(id, format);
      addToast('success', 'Instancia exportada', path);
    } catch (e: any) {
      addToast('error', 'Error al exportar', String(e));
    } finally {
      endDownloadActivity();
    }
  };

  const handleOpenInstanceFolder = async (instanceId: string) => {
    try {
      await api.openInstanceFolder(instanceId);
      const inst = instances.find((i) => i.id === instanceId);
      addToast('info', 'Directorio Abierto', `Mostrando archivos de "${inst?.name || instanceId}".`);
    } catch (e: any) {
      addToast('error', 'Error al abrir carpeta', e.toString());
    }
  };

  const syncAccountIntoState = (acc: Account, label: string) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => ({ ...a, is_active: false }));
      const existingIdx = updated.findIndex((a) => a.id === acc.id);
      if (existingIdx >= 0) {
        updated[existingIdx] = acc;
        return updated;
      }
      return [...updated, acc];
    });
    setActiveAccount(acc);
    addToast('success', label, `Sesión activa como ${acc.username}.`);
  };

  const handleAddAccount = async (username: string) => {
    try {
      const acc = await api.addOfflineAccount(username);
      syncAccountIntoState(acc, 'Cuenta Offline Añadida');
    } catch (e: any) {
      addToast('error', 'Error al añadir cuenta', e.toString());
    }
  };

  const handleLoginElyBy = async (
    username: string,
    password: string,
    totpToken?: string
  ) => {
    try {
      const acc = await api.loginElyByAccount(username, password, totpToken);
      syncAccountIntoState(acc, 'Ely.by Conectado');
    } catch (e: any) {
      addToast('error', 'Error de autenticación Ely.by', e.toString());
      throw e;
    }
  };

  const handleLoginMicrosoft = async (username: string, accessToken?: string) => {
    try {
      const acc = await api.loginMicrosoftAccount(username, accessToken);
      syncAccountIntoState(acc, 'Cuenta Minecraft Conectada');
    } catch (e: any) {
      addToast('error', 'Error de autenticación Minecraft', e.toString());
      throw e;
    }
  };

  const handleSetActiveAccount = async (id: string) => {
    try {
      await api.setActiveAccount(id);
      setAccounts((prev) =>
        prev.map((a) => ({ ...a, is_active: a.id === id }))
      );
      const acc = accounts.find((a) => a.id === id) || null;
      setActiveAccount(acc);
      addToast('info', 'Cuenta activa cambiada', acc?.username);
    } catch (e: any) {
      addToast('error', 'Error cambiando cuenta', e.toString());
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await api.deleteAccount(id);
      const remaining = accounts.filter((a) => a.id !== id);
      setAccounts(remaining);
      if (activeAccount?.id === id) {
        setActiveAccount(remaining[0] || null);
      }
      addToast('info', 'Cuenta eliminada');
    } catch (e: any) {
      addToast('error', 'Error al eliminar cuenta', e.toString());
    }
  };

  const handleUpdateSkin = async (
    accountId: string,
    skinUrl: string | null,
    skinModel: 'classic' | 'slim'
  ) => {
    try {
      const updatedAcc = await api.updateAccountSkin(accountId, skinUrl, skinModel);
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? updatedAcc : a))
      );
      if (activeAccount?.id === accountId) {
        setActiveAccount(updatedAcc);
      }
      addToast(
        'success',
        'Skin Actualizada',
        `Textura y modelo (${skinModel === 'slim' ? 'Slim 3px' : 'Clásico 4px'}) guardados.`
      );
    } catch (e: any) {
      addToast('error', 'Error al actualizar skin', e.toString());
    }
  };

  const startDownloadActivity = (title: string) => {
    if (downloadTimerRef.current) {
      window.clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
    setMascotMood('loading');
    setLiveActivity({
      mode: 'downloading',
      title,
      progress: 8,
    });
    downloadTimerRef.current = window.setInterval(() => {
      setLiveActivity((prev) => {
        if (prev.mode !== 'downloading') return prev;
        const curr = prev.progress ?? 8;
        const next = curr < 92 ? curr + Math.max(2, Math.round((95 - curr) * 0.14)) : curr;
        return { ...prev, progress: next };
      });
    }, 280);
  };

  const endDownloadActivity = () => {
    if (downloadTimerRef.current) {
      window.clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
    setMascotMood('idle');
    setLiveActivity((prev) =>
      prev.mode === 'downloading' ? { ...prev, progress: 100 } : prev
    );
    setTimeout(() => {
      setLiveActivity((prev) =>
        prev.mode === 'downloading' ? { mode: 'idle', title: '' } : prev
      );
    }, 240);
  };

  const handleLaunch = async (instToLaunch?: Instance) => {
    const target = instToLaunch || activeInstance;
    if (!target) {
      addToast('warning', 'Selecciona una estancia', 'No hay ninguna estancia seleccionada para jugar.');
      return;
    }
    if (!activeAccount) {
      addToast('warning', 'Selecciona un jugador', 'Debes tener una cuenta activa para jugar.');
      return;
    }

    try {
      setIsLaunching(true);
      setMascotMood('launching');
      const nowTime = new Date().toLocaleTimeString();
      setGameLogs((prev) => [
        ...prev,
        `[${nowTime}] [INFO] Preparando entorno para "${target.name}" (${target.loader} ${target.mc_version})...`,
        `[${nowTime}] [INFO] Asignando RAM: -Xms${target.memory_min_mb ?? 2048}M -Xmx${target.memory_max_mb ?? 4096}M`,
      ]);

      const output = await api.launchGame(target, activeAccount.username, activeAccount.uuid);
      setGameLogs((prev) => [
        ...prev,
        ...output.split('\n').map((l) => `[JVM] ${l}`),
        `[SUCCESS] Cliente Minecraft activo. Supervisando proceso...`,
      ]);

      setLiveActivity({
        mode: 'playing',
        title: target.name,
        elapsedSeconds: 0,
      });

      addToast('success', 'Minecraft en Ejecución', `La isla superior muestra ahora el estado en vivo.`);
    } catch (e: any) {
      setGameLogs((prev) => [...prev, `[ERROR] Fallo de inicio: ${e.toString()}`]);
      addToast('error', 'Fallo al iniciar juego', e.toString());
    } finally {
      setIsLaunching(false);
      setTimeout(() => setMascotMood('idle'), 1800);
    }
  };

  const handleStopGame = async () => {
    try {
      await api.stopGame();
    } catch {}
    const nowTime = new Date().toLocaleTimeString();
    setGameLogs((prev) => [
      ...prev,
      `[${nowTime}] [WARN] Señal SIGTERM enviada por el usuario. Proceso de Minecraft detenido.`,
    ]);
    setLiveActivity({ mode: 'idle', title: '' });
    addToast('info', 'Juego Detenido', 'Se cerró la sesión de Minecraft correctamente.');
  };

  // El velo solo aplica a modales: la isla expandida es contenido legible.
  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => setDiscordEnabled(Boolean(cfg.enable_discord_rpc)))
      .catch(() => {});

    const onDiscord = (event: Event) => {
      setDiscordEnabled(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener('ghostty:discord-changed', onDiscord);
    return () => window.removeEventListener('ghostty:discord-changed', onDiscord);
  }, []);

  useEffect(() => {
    if (!activeInstance) return;
    api
      .setDiscordSelection(activeInstance.name, activeInstance.mc_version, activeInstance.loader)
      .catch(() => {});
  }, [activeInstance?.id]);

  const modalOpen =
    isCreateOpen ||
    isAccountOpen ||
    isLogsOpen ||
    !!selectedInstanceForSettings ||
    isDraggingPack ||
    overlayBlur;

  return (
    <div
      onContextMenu={handleGlobalContextMenu}
      className="relative flex flex-col h-screen w-screen overflow-hidden text-ghost-100 font-sans select-none"
    >
      <input
        ref={globalImportInputRef}
        type="file"
        accept=".mrpack,.zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportModpack(file);
            e.target.value = '';
          }
        }}
      />

      <ParticleBackground ambientEnabled={themeSettings.particlesEnabled} />

      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        activeInstance={activeInstance}
        isPlaying={liveActivity.mode === 'playing'}
        currentThemePreset={themeSettings.preset}
        onLaunch={() => handleLaunch()}
        onStopGame={handleStopGame}
        onOpenCreate={() => setIsCreateOpen(true)}
        onTriggerImportFile={() => globalImportInputRef.current?.click()}
        onOpenMods={() => {
          setCurrentTab('mods');
          setIsIslandExpanded(true);
        }}
        onOpenDiscover={() => {
          setCurrentTab('discover');
          setIsIslandExpanded(true);
        }}
        onOpenInstanceSettings={() => {
          if (activeInstance) setSelectedInstanceForSettings(activeInstance);
        }}
        onOpenInstanceFolder={() => {
          if (activeInstance) handleOpenInstanceFolder(activeInstance.id);
        }}
        onOpenAccountsAndSkins={() => setIsAccountOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onCycleTheme={handleCycleTheme}
        onOpenGlobalSettings={() => {
          setCurrentTab('settings');
          setIsIslandExpanded(true);
        }}
        onToggleFavorite={handleToggleFavorite}
        onAddToGroup={openGroupPicker}
        onDeleteInstance={handleDeleteActive}
        onDuplicateInstance={handleDuplicateInstance}
        context={menuContext}
        contextGroup={menuGroup}
        onChangeIcon={handleChangeIcon}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <DynamicIslandHeader
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        activeInstance={activeInstance}
        activeAccount={activeAccount}
        onOpenAccounts={() => setIsAccountOpen(true)}
        onOpenCreateInstance={() => setIsCreateOpen(true)}
        isIslandExpanded={isIslandExpanded}
        setIsIslandExpanded={setIsIslandExpanded}
        liveActivity={liveActivity}
        onStopGame={handleStopGame}
        onOpenLogs={() => setIsLogsOpen(true)}
        mascotMood={mascotMood}
        onTriggerMascotReaction={() => {
          pulseMascot('celebrating', 1800);
          triggerAscendingStarlight('grand');
        }}
      />

      <main
        className="flex-1 flex overflow-hidden relative z-10"
        style={{
          contain: isDraggingPack || overlayBlur ? 'paint' : undefined,
        }}
      >
        <div
          className={`scene-layer flex-1 flex overflow-hidden ${modalOpen ? 'is-blurred' : ''} ${
            isIslandExpanded && currentTab !== 'instances' ? 'pointer-events-none' : ''
          }`}
        >
          <InstancesView
            instances={instances}
            activeInstance={activeInstance}
            onSelectInstance={setActiveInstance}
            onOpenCreate={() => setIsCreateOpen(true)}
            onImportModpack={handleImportModpack}
            onOpenMods={(inst) => {
              setActiveInstance(inst);
              setCurrentTab('mods');
              setIsIslandExpanded(true);
            }}
            onOpenSettings={(inst) => setSelectedInstanceForSettings(inst)}
            onOpenFolder={handleOpenInstanceFolder}
            onLaunch={handleLaunch}
            onDeleteInstance={handleDeleteInstance}
            onExportInstance={handleExportInstance}
            onToggleFavorite={toggleFavoriteFor}
            onAssignGroup={assignGroupFor}
            playingInstanceId={liveActivity.mode === 'playing' ? activeInstance?.id ?? null : null}
            isLaunching={isLaunching}
            launchBurstEnabled={themeSettings.launchBurstEnabled}
            ambientArtworkEnabled={themeSettings.ambientArtworkEnabled}
          />
        </div>

        <AnimatePresence>
          {isIslandExpanded && currentTab !== 'instances' && (
            <div className="absolute inset-0 z-30 pointer-events-none">
              <div
                onClick={() => {
                  setIsIslandExpanded(false);
                  setCurrentTab('instances');
                }}
                className="absolute inset-0 modal-scrim pointer-events-auto"
              />

              <div className="absolute inset-0 flex items-start justify-center pt-2 pb-4 px-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-auto relative w-full max-w-[940px] h-full max-h-[82vh] glass-panel-strong island-panel overflow-hidden flex flex-col z-10"
                >
                  <div className="w-full h-full flex flex-col overflow-hidden relative">
                    {currentTab === 'discover' && (
                      <DiscoverView
                        activeInstance={activeInstance}
                        manifest={manifest}
                        onShowToast={addToast}
                        onStartDownloadActivity={startDownloadActivity}
                        onEndDownloadActivity={endDownloadActivity}
                        onModpackInstalled={(inst) => {
                          setInstances((prev) => [inst, ...prev.filter((i) => i.id !== inst.id)]);
                          setActiveInstance(inst);
                          setCurrentTab('instances');
                          setIsIslandExpanded(false);
                        }}
                      />
                    )}

                    {currentTab === 'mods' && (
                      <ModsManagerView
                        activeInstance={activeInstance}
                        onShowToast={addToast}
                        onGoDiscover={() => setCurrentTab('discover')}
                      />
                    )}

                    {currentTab === 'settings' && (
                      <SettingsView
                        activeInstance={activeInstance}
                        onUpdateInstance={handleUpdateInstance}
                        onShowToast={addToast}
                        themeSettings={themeSettings}
                        onUpdateThemeSettings={handleUpdateThemeSettings}
                      />
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {isDraggingPack && (
        <div className="glass-overlay flex items-center justify-center">
          <div className="glass-modal glass-panel-strong px-10 py-8 text-center max-w-sm mx-6">
            <div className="w-14 h-14 mx-auto rounded-full accent-pill-tint flex items-center justify-center mb-3">
              <PackageOpen className="w-7 h-7 accent-text" />
            </div>
            <h2 className="heading-display text-xl font-bold text-ghost-50">
              Suelta el modpack
            </h2>
            <p className="text-xs text-ghost-400 mt-1">
              Se importará como instancia nueva (.mrpack o .zip de CurseForge).
            </p>
          </div>
        </div>
      )}


      {isGroupPickerOpen && (
        <div
          className="glass-overlay flex items-center justify-center"
          onClick={closeGroupPicker}
        >
          <div
            className="glass-modal glass-panel-strong w-[380px] max-w-[92vw] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="heading-display text-lg font-bold text-ghost-50">Mover a grupo</h3>
            <p className="text-[11px] text-ghost-400 mb-3 truncate">
              {activeInstance?.name}
            </p>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => applyGroup(null)}
                className={`w-full text-left px-3 py-2 rounded-control text-xs ${
                  !activeInstance?.group ? 'accent-pill-tint font-semibold' : 'glass-control text-ghost-200'
                }`}
              >
                Sin grupo
              </button>

              {groupOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => applyGroup(g)}
                  className={`w-full text-left px-3 py-2 rounded-control text-xs ${
                    activeInstance?.group === g
                      ? 'accent-pill-tint font-semibold'
                      : 'glass-control text-ghost-200'
                  }`}
                >
                  {g}
                </button>
              ))}

              {groupOptions.length === 0 && (
                <p className="text-[11px] text-ghost-400 pt-2">
                  No hay grupos todavía. Crea uno con “+ Grupo” en la barra de arriba.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={closeGroupPicker}
                className="btn-tactile px-4 py-2 rounded-control glass-control text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}


      <StatusFooterDock
        activeInstance={activeInstance}
        activeAccount={activeAccount}
        instancesCount={instances.length}
        onOpenInstanceSettings={(inst) => setSelectedInstanceForSettings(inst)}
        onOpenInstanceFolder={handleOpenInstanceFolder}
        onOpenAccounts={() => setIsAccountOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        discordEnabled={discordEnabled}
      />

      <CreateInstanceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateInstance}
        manifest={manifest}
      />

      <InstanceSettingsModal
        isOpen={!!selectedInstanceForSettings}
        instance={selectedInstanceForSettings}
        onClose={() => setSelectedInstanceForSettings(null)}
        onUpdate={handleUpdateInstance}
        onShowToast={addToast}
        initialTab={settingsTab}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onLoginElyBy={handleLoginElyBy}
        onLoginMicrosoft={handleLoginMicrosoft}
        onAccountAuthenticated={(acc) =>
          syncAccountIntoState(acc, 'Cuenta Microsoft Premium Conectada')
        }
        onSetActive={handleSetActiveAccount}
        onDeleteAccount={handleDeleteAccount}
        onUpdateSkin={handleUpdateSkin}
      />

      <GameLogsModal
        isOpen={isLogsOpen}
        instanceName={activeInstance?.name || 'Minecraft'}
        logs={gameLogs}
        isRunning={liveActivity.mode === 'playing'}
        onClose={() => setIsLogsOpen(false)}
        onClearLogs={() => setGameLogs([])}
        onStopGame={handleStopGame}
      />
    </div>
  );
}
export default App;
