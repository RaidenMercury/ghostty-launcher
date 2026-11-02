import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  X,
  RefreshCw,
  Search,
  Check,
  Cpu,
  Shield,
  Loader2,
} from 'lucide-react';
import { SystemJavaInfo } from '../types';
import { api } from '../services/api';
import { useI18n } from '../utils/i18n';

interface JavaDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJavaInstalled: (info: SystemJavaInfo) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => void;
}

type ProviderId = 'mojang' | 'adoptium' | 'zulu' | 'semeru';

interface ProviderDef {
  id: ProviderId;
  name: string;
  subtitle: string;
  renderLogo: () => React.ReactNode;
}

const MojangLogo: React.FC = () => (
  <svg viewBox="0 0 32 32" className="w-5 h-5 shrink-0" fill="none">
    <rect width="32" height="32" rx="7" fill="#E21B27" />
    <path
      d="M7 23V9h4.5l4.5 7.5L20.5 9H25v14h-3.8v-8.2l-4.7 7.7h-1L10.8 14.8V23H7z"
      fill="#FFFFFF"
    />
  </svg>
);

const AdoptiumLogo: React.FC = () => (
  <svg viewBox="0 0 32 32" className="w-5 h-5 shrink-0" fill="none">
    <rect width="32" height="32" rx="7" fill="#1E1338" />
    <path
      d="M16 6L6 24h20L16 6z"
      fill="url(#adoptium-tri-grad)"
    />
    <path
      d="M16 13l-4.5 8h9l-4.5-8z"
      fill="#140D27"
    />
    <defs>
      <linearGradient id="adoptium-tri-grad" x1="6" y1="24" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EC4899" />
        <stop offset="0.5" stopColor="#A855F7" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
  </svg>
);

const AzulLogo: React.FC = () => (
  <svg viewBox="0 0 32 32" className="w-5 h-5 shrink-0" fill="none">
    <rect width="32" height="32" rx="7" fill="#061A30" />
    <path
      d="M16 5l3 7.5L27 16l-8 3.5L16 27l-3-7.5L5 16l8-3.5L16 5z"
      fill="#00B4D8"
    />
    <path
      d="M16 10l1.8 4.2L22 16l-4.2 1.8L16 22l-1.8-4.2L10 16l4.2-1.8L16 10z"
      fill="#ADE8F4"
    />
  </svg>
);

const SemeruLogo: React.FC = () => (
  <svg viewBox="0 0 32 32" className="w-5 h-5 shrink-0" fill="none">
    <rect width="32" height="32" rx="7" fill="#0F172A" />
    <path
      d="M16 5l9 5.2v10.4L16 26 7 20.6V10.2L16 5z"
      fill="#1E293B"
      stroke="#10B981"
      strokeWidth="1.8"
    />
    <text
      x="16"
      y="18.5"
      textAnchor="middle"
      fontSize="8.5"
      fontWeight="900"
      fontFamily="monospace"
      fill="#10B981"
    >
      OJ9
    </text>
  </svg>
);

const PROVIDERS: ProviderDef[] = [
  { id: 'mojang', name: 'Mojang', subtitle: 'Runtime oficial de Minecraft', renderLogo: () => <MojangLogo /> },
  { id: 'adoptium', name: 'Adoptium', subtitle: 'Eclipse Temurin (Hotspot)', renderLogo: () => <AdoptiumLogo /> },
  { id: 'zulu', name: 'Azul Zulu', subtitle: 'Azul Systems OpenJDK', renderLogo: () => <AzulLogo /> },
  { id: 'semeru', name: 'IBM Semeru abierto', subtitle: 'OpenJ9 Virtual Machine', renderLogo: () => <SemeruLogo /> },
];

interface JavaReleaseEntry {
  version: string;
  javaName: string;
  released: string;
  type: 'jre' | 'jdk';
  major: number;
  recommended?: boolean;
}

const RUNTIME_CATALOG: Record<ProviderId, Record<number, JavaReleaseEntry[]>> = {
  mojang: {
    25: [
      { version: '25.0.1', javaName: 'java-runtime-epsilon', released: '10/12/25', type: 'jre', major: 25, recommended: true },
    ],
    21: [
      { version: '21.0.3', javaName: 'java-runtime-gamma', released: '16/04/24', type: 'jre', major: 21, recommended: true },
    ],
    17: [
      { version: '17.0.8', javaName: 'java-runtime-beta', released: '18/07/23', type: 'jre', major: 17, recommended: true },
    ],
    16: [
      { version: '16.0.1', javaName: 'java-runtime-alpha', released: '20/04/21', type: 'jre', major: 16 },
    ],
    8: [
      { version: '8u51', javaName: 'jre-legacy', released: '14/07/15', type: 'jre', major: 8, recommended: true },
    ],
  },
  adoptium: {
    25: [
      { version: '25.0.0+36', javaName: 'OpenJDK 25 (Temurin Hotspot)', released: '15/09/25', type: 'jre', major: 25, recommended: true },
    ],
    21: [
      { version: '21.0.6+7', javaName: 'OpenJDK 21.0.6 (Temurin Hotspot)', released: '21/01/25', type: 'jre', major: 21, recommended: true },
      { version: '21.0.5+11', javaName: 'OpenJDK 21.0.5 (Temurin Hotspot)', released: '15/10/24', type: 'jdk', major: 21 },
    ],
    17: [
      { version: '17.0.14+7', javaName: 'OpenJDK 17.0.14 (Temurin Hotspot)', released: '21/01/25', type: 'jre', major: 17, recommended: true },
    ],
    16: [
      { version: '16.0.2+7', javaName: 'OpenJDK 16.0.2 (Temurin Hotspot)', released: '20/07/21', type: 'jre', major: 16 },
    ],
    8: [
      { version: '8u442-b06', javaName: 'OpenJDK 8u442 (Temurin Hotspot)', released: '21/01/25', type: 'jre', major: 8, recommended: true },
    ],
  },
  zulu: {
    25: [
      { version: '25.32.11', javaName: 'Azul Zulu 25.0+36', released: '20/09/25', type: 'jre', major: 25, recommended: true },
    ],
    21: [
      { version: '21.38.21', javaName: 'Azul Zulu 21.0.6+7', released: '21/01/25', type: 'jre', major: 21, recommended: true },
    ],
    17: [
      { version: '17.54.21', javaName: 'Azul Zulu 17.0.14+7', released: '21/01/25', type: 'jre', major: 17, recommended: true },
    ],
    16: [
      { version: '16.32.15', javaName: 'Azul Zulu 16.0.2+7', released: '20/07/21', type: 'jre', major: 16 },
    ],
    8: [
      { version: '8.82.0.21', javaName: 'Azul Zulu 8u442-b06', released: '21/01/25', type: 'jre', major: 8, recommended: true },
    ],
  },
  semeru: {
    21: [
      { version: '21.0.6_0.49.0', javaName: 'IBM Semeru Runtimes 21 (OpenJ9)', released: '24/01/25', type: 'jre', major: 21, recommended: true },
    ],
    17: [
      { version: '17.0.14_0.49.0', javaName: 'IBM Semeru Runtimes 17 (OpenJ9)', released: '24/01/25', type: 'jre', major: 17, recommended: true },
    ],
    8: [
      { version: '8u442_0.49.0', javaName: 'IBM Semeru Runtimes 8 (OpenJ9)', released: '24/01/25', type: 'jre', major: 8, recommended: true },
    ],
  },
};

const MAJOR_VERSIONS = [25, 21, 17, 16, 8];

export const JavaDownloadModal: React.FC<JavaDownloadModalProps> = ({
  isOpen,
  onClose,
  onJavaInstalled,
  onShowToast,
}) => {
  const { t } = useI18n();
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('mojang');
  const [selectedMajor, setSelectedMajor] = useState<number>(25);
  const [searchTable, setSearchTable] = useState('');
  const [selectedRow, setSelectedRow] = useState<JavaReleaseEntry | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const providerCatalog = RUNTIME_CATALOG[selectedProvider] || {};
  const availableMajors = useMemo(() => {
    return MAJOR_VERSIONS.filter((m) => providerCatalog[m]?.length);
  }, [providerCatalog]);

  const tableEntries = useMemo(() => {
    const list = providerCatalog[selectedMajor] || [];
    if (!searchTable.trim()) return list;
    const q = searchTable.trim().toLowerCase();
    return list.filter(
      (e) =>
        e.version.toLowerCase().includes(q) ||
        e.javaName.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
    );
  }, [providerCatalog, selectedMajor, searchTable]);

  React.useEffect(() => {
    if (tableEntries.length > 0) {
      const rec = tableEntries.find((e) => e.recommended) || tableEntries[0];
      setSelectedRow(rec);
    } else {
      setSelectedRow(null);
    }
  }, [selectedProvider, selectedMajor, tableEntries]);

  React.useEffect(() => {
    if (!providerCatalog[selectedMajor]) {
      const first = availableMajors[0] || 21;
      setSelectedMajor(first);
    }
  }, [selectedProvider, selectedMajor, providerCatalog, availableMajors]);

  const handleDownload = async () => {
    if (!selectedRow || isDownloading) return;
    try {
      setIsDownloading(true);
      onShowToast(
        'info',
        'Descargando Java Runtime',
        `Iniciando descarga de ${selectedRow.javaName} (${selectedRow.version})...`
      );

      const info = await api.downloadJavaRuntime(selectedProvider, selectedRow.major);
      onShowToast(
        'success',
        'Java Instalado',
        `Se ha instalado correctamente Java ${info.major_version} (${info.version}).`
      );
      onJavaInstalled(info);
      onClose();
    } catch (e: any) {
      onShowToast('error', 'Error al instalar Java', String(e));
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const currentProviderObj = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div onClick={onClose} className="fixed inset-0 modal-scrim" />

        <div className="relative w-full max-w-4xl h-[560px] glass-panel-strong text-ghost-100 z-10 overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-[var(--glass-border)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b glass-divider shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--glass-control)] border border-white/10 flex items-center justify-center">
                <Cpu className="w-4 h-4 accent-text" />
              </div>
              <div>
                <h3 className="heading-display text-lg font-bold text-ghost-50 tracking-wide">
                  {t.java_modal_title}
                </h3>
                <p className="text-[11px] text-ghost-400 font-mono">
                  {currentProviderObj.name} • {currentProviderObj.subtitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDownloading}
              className="btn-tactile p-1.5 glass-control text-ghost-300 hover:text-ghost-50 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Columns Body */}
          <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
            {/* Column 1: Providers (25% / 3 cols) */}
            <div className="col-span-3 border-r glass-divider p-3 flex flex-col justify-between bg-black/20">
              <div className="space-y-1">
                <span className="block text-[10px] font-mono uppercase text-ghost-400 px-2 mb-2 font-semibold tracking-wider">
                  {t.java_provider}
                </span>
                <div className="space-y-1.5">
                  {PROVIDERS.map((prov) => {
                    const isSelected = prov.id === selectedProvider;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setSelectedProvider(prov.id)}
                        className={`btn-tactile w-full px-3 py-2.5 rounded-xl text-left flex items-center gap-3 transition-all border ${
                          isSelected
                            ? 'accent-pill-tint border-[var(--accent)] font-semibold shadow-sm'
                            : 'border-transparent hover:bg-white/5 text-ghost-300 hover:text-ghost-100'
                        }`}
                      >
                        {prov.renderLogo()}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{prov.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-[10px] font-mono text-ghost-400 flex items-center gap-2 min-w-0">
                <Shield className="w-3.5 h-3.5 accent-text shrink-0" />
                <span className="truncate" title={t.java_automated_install}>
                  {t.java_automated_install}
                </span>
              </div>
            </div>

            {/* Column 2: Versión Principal (25% / 3 cols) */}
            <div className="col-span-3 border-r glass-divider p-3 flex flex-col bg-black/10">
              <span className="block text-[10px] font-mono uppercase text-ghost-400 px-2 mb-2 font-semibold tracking-wider">
                {t.java_major_version}
              </span>

              <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                {availableMajors.map((major) => {
                  const isSelected = major === selectedMajor;
                  const isRec = major === 21 || major === 25;
                  return (
                    <button
                      key={major}
                      type="button"
                      onClick={() => setSelectedMajor(major)}
                      className={`btn-tactile w-full h-9 px-3 rounded-xl text-left flex items-center justify-between text-xs font-mono transition-all border ${
                        isSelected
                          ? 'accent-bg text-white font-bold border-transparent shadow-sm'
                          : 'border-transparent hover:bg-white/5 text-ghost-300 hover:text-ghost-100'
                      }`}
                    >
                      <span>Java {major}</span>
                      {isRec && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]/30'
                          }`}
                        >
                          LTS
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Main Table (50% / 6 cols) */}
            <div className="col-span-6 p-3 flex flex-col justify-between min-w-0 bg-black/5">
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-mono font-bold text-ghost-200">
                    {currentProviderObj.name}
                  </span>
                  <span className="text-[10px] font-mono text-ghost-400">
                    {tableEntries.length} {t.java_packages_count}
                  </span>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 text-[10px] font-mono font-bold text-ghost-400 uppercase tracking-wider shrink-0 mb-1.5">
                  <span className="col-span-3">{t.java_col_version}</span>
                  <span className="col-span-5">{t.java_col_name}</span>
                  <span className="col-span-2 text-center">{t.java_col_released}</span>
                  <span className="col-span-2 text-right">{t.java_col_type}</span>
                </div>

                {/* Table Rows */}
                <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                  {tableEntries.map((row) => {
                    const isSelected = selectedRow?.version === row.version;
                    return (
                      <div
                        key={row.version}
                        onClick={() => setSelectedRow(row)}
                        className={`grid grid-cols-12 gap-2 px-3 py-2 rounded-xl text-xs font-mono cursor-pointer transition-all border items-center ${
                          isSelected
                            ? 'accent-pill-tint border-[var(--accent)] font-semibold shadow-sm'
                            : 'border-transparent hover:bg-white/5 text-ghost-300'
                        }`}
                      >
                        <span className="col-span-3 truncate font-bold text-ghost-100 flex items-center gap-1.5">
                          {row.recommended && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                          )}
                          {row.version}
                        </span>
                        <span className="col-span-5 truncate text-ghost-300" title={row.javaName}>
                          {row.javaName}
                        </span>
                        <span className="col-span-2 text-center text-[11px] text-ghost-400">
                          {row.released}
                        </span>
                        <span className="col-span-2 text-right text-[10px] font-bold uppercase text-ghost-400">
                          {row.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table Search Input */}
              <div className="pt-2.5 border-t glass-divider mt-2 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ghost-400" />
                  <input
                    type="text"
                    placeholder={t.java_search_placeholder}
                    value={searchTable}
                    onChange={(e) => setSearchTable(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg glass-control text-xs font-mono placeholder:text-ghost-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar matching Prism Launcher reference image */}
          <div className="px-6 py-3 border-t glass-divider flex items-center justify-between shrink-0 bg-black/25">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSearchTable('');
                }}
                className="btn-tactile px-3 py-1.5 rounded-lg glass-control text-xs font-mono flex items-center gap-1.5 text-ghost-300 hover:text-ghost-50"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t.java_refresh}</span>
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--accent-tint)] border border-[var(--accent)]/30 text-[10px] font-mono font-bold text-[var(--accent)]">
                <span className="w-2 h-2 rounded-[2px] bg-[var(--accent)] inline-block" />
                <span>Recommended</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isDownloading}
                className="btn-tactile px-4 py-1.5 rounded-xl glass-control text-xs font-semibold text-ghost-300 hover:text-ghost-50"
              >
                {t.java_cancel}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!selectedRow || isDownloading}
                className="btn-tactile px-5 py-1.5 rounded-xl accent-bg text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.java_installing}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.java_download_btn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};
