import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar, TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { InstancesView } from './views/InstancesView';
import { DiscoverView } from './views/DiscoverView';
import { ModsManagerView } from './views/ModsManagerView';
import { SettingsView } from './views/SettingsView';
import { CreateInstanceModal } from './components/CreateInstanceModal';
import { AccountModal } from './components/AccountModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Account, Instance, CreateInstancePayload, MojangManifest } from './types';
import { api } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('instances');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeInstance, setActiveInstance] = useState<Instance | null>(null);
  const [manifest, setManifest] = useState<MojangManifest | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const addToast = (
    type: 'success' | 'warning' | 'error' | 'info',
    title: string,
    message?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadInitialData = async () => {
    try {
      // Accounts
      const accs = await api.getAccounts();
      setAccounts(accs);
      const activeAcc = accs.find((a) => a.is_active) || accs[0] || null;
      setActiveAccount(activeAcc);

      // Instances
      const insts = await api.getInstances();
      setInstances(insts);
      if (insts.length > 0) {
        setActiveInstance(insts[0]);
      }

      // Manifest
      const man = await api.getMojangManifest();
      setManifest(man);
    } catch (e: any) {
      addToast('error', 'Error al cargar datos', e.toString());
    }
  };

  const handleCreateInstance = async (payload: CreateInstancePayload) => {
    try {
      const newInst = await api.createInstance(payload);
      setInstances((prev) => [newInst, ...prev]);
      setActiveInstance(newInst);
      addToast('success', 'Estancia Creada', `Se creó "${newInst.name}" (${newInst.loader} ${newInst.mc_version}).`);
    } catch (e: any) {
      addToast('error', 'Error al crear', e.toString());
    }
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

  const handleExportInstance = async (id: string) => {
    try {
      const targetPath = `/home/rmercury/Descargas/${id}-export.zip`;
      await api.exportInstance(id, targetPath);
      addToast('success', 'Estancia Exportada', `Guardada en ${targetPath}`);
    } catch (e: any) {
      addToast('error', 'Error al exportar', e.toString());
    }
  };

  const handleAddAccount = async (username: string) => {
    try {
      const acc = await api.addOfflineAccount(username);
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
      addToast('success', 'Cuenta añadida', `Jugador ${acc.username} activado.`);
    } catch (e: any) {
      addToast('error', 'Error al añadir cuenta', e.toString());
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
      const output = await api.launchGame(target, activeAccount.username, activeAccount.uuid);
      addToast('success', 'Minecraft Iniciado', output);
    } catch (e: any) {
      addToast('error', 'Fallo al iniciar juego', e.toString());
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ghost-950 text-ghost-100 font-sans">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeInstance={activeInstance}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-ghost-950 via-ghost-950 to-ghost-900">
        {/* Top Header */}
        <Header
          activeAccount={activeAccount}
          activeInstance={activeInstance}
          onOpenAccounts={() => setIsAccountOpen(true)}
          onLaunch={() => handleLaunch()}
          isLaunching={isLaunching}
        />

        {/* View Switcher with Animated Transitions */}
        <main className="flex-1 flex overflow-hidden relative">
          <AnimatePresence mode="wait">
            {currentTab === 'instances' && (
              <motion.div
                key="instances"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 flex overflow-hidden"
              >
                <InstancesView
                  instances={instances}
                  activeInstance={activeInstance}
                  onSelectInstance={setActiveInstance}
                  onOpenCreate={() => setIsCreateOpen(true)}
                  onOpenMods={(inst) => {
                    setActiveInstance(inst);
                    setCurrentTab('mods');
                  }}
                  onLaunch={handleLaunch}
                  onDeleteInstance={handleDeleteInstance}
                  onExportInstance={handleExportInstance}
                  isLaunching={isLaunching}
                />
              </motion.div>
            )}

            {currentTab === 'discover' && (
              <motion.div
                key="discover"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 flex overflow-hidden"
              >
                <DiscoverView
                  activeInstance={activeInstance}
                  onShowToast={addToast}
                />
              </motion.div>
            )}

            {currentTab === 'mods' && (
              <motion.div
                key="mods"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 flex overflow-hidden"
              >
                <ModsManagerView
                  activeInstance={activeInstance}
                  onShowToast={addToast}
                />
              </motion.div>
            )}

            {currentTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 flex overflow-hidden"
              >
                <SettingsView onShowToast={addToast} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <CreateInstanceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateInstance}
        manifest={manifest}
      />

      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onSetActive={handleSetActiveAccount}
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}
export default App;
