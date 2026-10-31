/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Fuerza el mock también dentro de Tauri (solo para demos). */
  readonly VITE_USE_MOCK?: string;
}
