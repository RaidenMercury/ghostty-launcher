export type ThemePresetId = 'obsidian' | 'midnight' | 'graphite' | 'light';

export interface ThemeSettings {
  preset: ThemePresetId;
  accentHex: string;
  particlesEnabled: boolean;
  launchBurstEnabled: boolean;
  ambientArtworkEnabled: boolean;
}

export interface ThemePresetMeta {
  id: ThemePresetId;
  name: string;
  description: string;
  previewBg: string;
  previewGlass: string;
  vars: Record<string, string>;
}

export const ACCENT_SWATCHES = [
  { id: 'amethyst', label: 'Amatista', hex: '#a855f7' },
  { id: 'violet', label: 'Violeta Real', hex: '#8b5cf6' },
  { id: 'orchid', label: 'Orquídea', hex: '#d946ef' },
  { id: 'ghostty', label: 'Cian Ghostty', hex: '#38bdf8' },
  { id: 'emerald', label: 'Esmeralda', hex: '#10b981' },
  { id: 'crimson', label: 'Carmesí', hex: '#f43f5e' },
  { id: 'amber', label: 'Ámbar', hex: '#f59e0b' },
];

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetMeta> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidiana',
    description: 'Vidrio ahumado profundo con matices de obsidiana volcánica',
    previewBg: '#08060e',
    previewGlass: 'rgba(20, 15, 34, 0.88)',
    vars: {
      '--bg-void': '#08060e',
      '--bg-elevated': '#110d1d',
      '--glass-surface': 'rgba(20, 15, 34, 0.88)',
      '--glass-surface-strong': 'rgba(16, 12, 28, 0.96)',
      '--glass-subtle': 'rgba(255, 255, 255, 0.045)',
      '--glass-hover': 'rgba(255, 255, 255, 0.085)',
      '--glass-border': 'rgba(255, 255, 255, 0.11)',
      '--glass-highlight': 'rgba(255, 255, 255, 0.18)',
      '--divider-color': 'rgba(255, 255, 255, 0.075)',
      '--text-primary': '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#8b849e',
      '--select-bg': '#141022',
      '--select-text': '#f8fafc',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Medianoche',
    description: 'Cristal abisal azul noche estilo visionOS espacial',
    previewBg: '#050914',
    previewGlass: 'rgba(13, 20, 38, 0.88)',
    vars: {
      '--bg-void': '#050914',
      '--bg-elevated': '#0b1326',
      '--glass-surface': 'rgba(13, 20, 38, 0.88)',
      '--glass-surface-strong': 'rgba(10, 16, 32, 0.96)',
      '--glass-subtle': 'rgba(255, 255, 255, 0.045)',
      '--glass-hover': 'rgba(255, 255, 255, 0.085)',
      '--glass-border': 'rgba(255, 255, 255, 0.11)',
      '--glass-highlight': 'rgba(255, 255, 255, 0.19)',
      '--divider-color': 'rgba(255, 255, 255, 0.075)',
      '--text-primary': '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#7e8ba3',
      '--select-bg': '#0b1326',
      '--select-text': '#f8fafc',
    },
  },
  graphite: {
    id: 'graphite',
    name: 'Grafito',
    description: 'Carbón neutro de estudio sin dominante cromática',
    previewBg: '#0a0b0e',
    previewGlass: 'rgba(22, 23, 28, 0.88)',
    vars: {
      '--bg-void': '#0a0b0e',
      '--bg-elevated': '#13151a',
      '--glass-surface': 'rgba(22, 23, 28, 0.88)',
      '--glass-surface-strong': 'rgba(17, 18, 23, 0.96)',
      '--glass-subtle': 'rgba(255, 255, 255, 0.045)',
      '--glass-hover': 'rgba(255, 255, 255, 0.08)',
      '--glass-border': 'rgba(255, 255, 255, 0.10)',
      '--glass-highlight': 'rgba(255, 255, 255, 0.16)',
      '--divider-color': 'rgba(255, 255, 255, 0.075)',
      '--text-primary': '#f8fafc',
      '--text-secondary': '#d1d5db',
      '--text-muted': '#888e99',
      '--select-bg': '#15171d',
      '--select-text': '#f8fafc',
    },
  },
  light: {
    id: 'light',
    name: 'Claro Esmerilado',
    description: 'Cristal diurno luminoso con bordes especulares suaves',
    previewBg: '#dfe4ee',
    previewGlass: 'rgba(248, 250, 252, 0.92)',
    vars: {
      '--bg-void': '#dfe4ee',
      '--bg-elevated': '#eef1f7',
      '--glass-surface': 'rgba(248, 250, 252, 0.92)',
      '--glass-surface-strong': 'rgba(252, 253, 255, 0.97)',
      '--glass-subtle': 'rgba(15, 23, 42, 0.055)',
      '--glass-hover': 'rgba(15, 23, 42, 0.09)',
      '--glass-border': 'rgba(15, 23, 42, 0.13)',
      '--glass-highlight': 'rgba(255, 255, 255, 0.95)',
      '--divider-color': 'rgba(15, 23, 42, 0.10)',
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      '--select-bg': '#ffffff',
      '--select-text': '#0f172a',
    },
  },
};

const STORAGE_KEY = 'ghostty_theme_settings_v2';

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  preset: 'obsidian',
  accentHex: '#a855f7',
  particlesEnabled: true,
  launchBurstEnabled: true,
  ambientArtworkEnabled: true,
};

function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return '168, 85, 247';
  const r = parseInt(clean.substring(0, 2), 16) || 168;
  const g = parseInt(clean.substring(2, 4), 16) || 85;
  const b = parseInt(clean.substring(4, 6), 16) || 247;
  return `${r}, ${g}, ${b}`;
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_THEME_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
  applyThemeToDocument(settings);
}

export function applyThemeToDocument(settings: ThemeSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const preset = THEME_PRESETS[settings.preset] || THEME_PRESETS.obsidian;

  Object.entries(preset.vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  const rgb = hexToRgbString(settings.accentHex);
  root.style.setProperty('--accent', settings.accentHex);
  root.style.setProperty('--accent-rgb', rgb);
  root.dataset.theme = settings.preset;
  root.style.colorScheme = settings.preset === 'light' ? 'light' : 'dark';
  root.classList.toggle('dark', settings.preset !== 'light');
}
