import { useState, useEffect, useCallback } from 'react';

export type Language = 'es' | 'en';

export interface Translations {
  // Navigation & Header
  nav_instances: string;
  nav_discover: string;
  nav_content: string;
  nav_settings: string;
  nav_new_instance: string;
  nav_active_account: string;

  // Instances View
  search_instances_placeholder: string;
  group_all: string;
  group_favorites: string;
  group_modpacks: string;
  group_add_group: string;
  group_name_placeholder: string;
  play_now: string;
  ready_to_play: string;
  in_game: string;
  launching: string;
  btn_mod_manager: string;
  btn_instance_settings: string;
  btn_open_folder: string;
  btn_console_logs: string;
  btn_export: string;
  btn_delete: string;
  instances_empty_title: string;
  drag_to_reorder: string;

  // Modals & Panels
  acc_modal_title: string;
  acc_modal_subtitle: string;
  acc_registered_accounts: string;
  acc_skin_studio: string;
  acc_arm_geometry: string;
  acc_classic_4px: string;
  acc_slim_3px: string;
  acc_local_file: string;
  acc_upload_skin: string;
  acc_import_premium: string;
  acc_apply: string;
  acc_capes_title: string;
  acc_remove_cape: string;
  acc_tab_minecraft: string;
  acc_tab_elyby: string;
  acc_tab_offline: string;
  acc_login_msa_btn: string;
  acc_msa_waiting: string;
  acc_cancel: string;
  acc_code_in_ms: string;
  acc_open_link: string;
  acc_copied: string;
  acc_copy: string;

  // Create Instance Modal
  create_modal_title: string;
  create_modal_subtitle: string;
  create_name_label: string;
  create_name_placeholder: string;
  create_version_label: string;
  create_loader_label: string;
  create_icon_label: string;
  create_ram_label: string;
  create_adv_options: string;
  create_cancel: string;
  create_submit: string;

  // Java Download Modal
  java_modal_title: string;
  java_modal_subtitle: string;
  java_provider: string;
  java_major_version: string;
  java_search_placeholder: string;
  java_col_version: string;
  java_col_name: string;
  java_col_released: string;
  java_col_type: string;
  java_refresh: string;
  java_download_btn: string;
  java_cancel: string;

  // Settings View
  settings_title: string;
  settings_save: string;
  settings_saving: string;
  settings_root_folder: string;
  settings_tab_general: string;
  settings_tab_java: string;
  settings_tab_memory: string;
  settings_tab_discord: string;
  settings_tab_appearance: string;
  settings_tab_advanced: string;
  settings_language: string;
  settings_language_desc: string;
  settings_theme_preset: string;
  settings_accent_color: string;
  settings_particles: string;
  settings_legal_title: string;
  settings_legal_disclaimer: string;
  settings_legal_mojang_desc: string;

  // Context Menu
  ctx_new_instance: string;
  ctx_import_modpack: string;
  ctx_play_instance: string;
  ctx_stop_instance: string;
  ctx_open_folder: string;
  ctx_change_icon: string;
  ctx_favorite_add: string;
  ctx_favorite_remove: string;
  ctx_duplicate: string;
  ctx_delete_instance: string;
  ctx_rename_group: string;
  ctx_delete_group: string;

  // Status Dock
  status_discord_active: string;
  status_discord_off: string;
  status_profiles_count: string;
}

const es: Translations = {
  nav_instances: 'Estancias',
  nav_discover: 'Descubrir',
  nav_content: 'Contenido',
  nav_settings: 'Ajustes',
  nav_new_instance: '+ Nueva Instancia',
  nav_active_account: 'Cuenta Activa',

  search_instances_placeholder: 'Buscar estancias...',
  group_all: 'Todos',
  group_favorites: 'Favoritos',
  group_modpacks: 'Bonitos Packs',
  group_add_group: '+ Grupo',
  group_name_placeholder: 'Nombre grupo...',
  play_now: 'JUGAR AHORA',
  ready_to_play: 'Listo para jugar',
  in_game: 'EN PARTIDA',
  launching: 'INICIANDO...',
  btn_mod_manager: 'Gestor de Mods',
  btn_instance_settings: 'Ajustes de la Estancia',
  btn_open_folder: 'Abrir Carpeta',
  btn_console_logs: 'Consola / Logs',
  btn_export: 'Exportar',
  btn_delete: 'Eliminar',
  instances_empty_title: 'No encontramos estancias en este grupo.',
  drag_to_reorder: 'Arrastra para reordenar',

  acc_modal_title: 'ADMINISTRACIÓN DE CUENTAS',
  acc_modal_subtitle: 'Gestiona tus cuentas, skins y capas desde un solo lugar',
  acc_registered_accounts: 'CUENTAS REGISTRADAS',
  acc_skin_studio: 'ESTUDIO DE SKIN',
  acc_arm_geometry: 'GEOMETRÍA DE BRAZOS',
  acc_classic_4px: 'Clásico (4px)',
  acc_slim_3px: 'Slim (3px)',
  acc_local_file: 'ARCHIVO LOCAL (.PNG 64×64)',
  acc_upload_skin: 'Subir Skin (.png)',
  acc_import_premium: 'IMPORTAR POR NICK PREMIUM O URL',
  acc_apply: 'Aplicar',
  acc_capes_title: 'CAPAS DE LA CUENTA',
  acc_remove_cape: 'Quitar capa',
  acc_tab_minecraft: 'Minecraft',
  acc_tab_elyby: 'Ely.by',
  acc_tab_offline: 'Offline',
  acc_login_msa_btn: 'Iniciar Sesión Microsoft (Device Code)',
  acc_msa_waiting: 'Esperando autorización...',
  acc_cancel: 'Cancelar',
  acc_code_in_ms: 'Código en Microsoft:',
  acc_open_link: 'Abrir enlace',
  acc_copied: 'Copiado',
  acc_copy: 'Copiar',

  create_modal_title: 'NUEVA ESTANCIA DE MINECRAFT',
  create_modal_subtitle: 'Configura versión oficial, Mod Loader y memoria inicial',
  create_name_label: 'Nombre de la Estancia',
  create_name_placeholder: 'ej. Survival Técnico 1.21, Mundo Hardcore...',
  create_version_label: 'Versión de Minecraft',
  create_loader_label: 'Mod Loader',
  create_icon_label: 'Icono de la estancia',
  create_ram_label: 'Memoria RAM Asignada',
  create_adv_options: 'Opciones Avanzadas (Flags JVM y Hook)',
  create_cancel: 'Cancelar',
  create_submit: '+ Crear Estancia',

  java_modal_title: 'DESCARGAR RUNTIME DE JAVA',
  java_modal_subtitle: 'Mojang, Adoptium Temurin, Azul Zulu e IBM Semeru',
  java_provider: 'PROVEEDOR',
  java_major_version: 'VERSIÓN PRINCIPAL',
  java_search_placeholder: 'Buscar versión o nombre...',
  java_col_version: 'VERSIÓN',
  java_col_name: 'NOMBRE DE JAVA',
  java_col_released: 'LANZADO',
  java_col_type: 'TIPO',
  java_refresh: 'Refrescar',
  java_download_btn: 'Descargar',
  java_cancel: 'Cancelar',

  settings_title: 'CONFIGURACIÓN DEL LAUNCHER & ENTORNO',
  settings_save: 'Guardar Cambios',
  settings_saving: 'Guardando...',
  settings_root_folder: 'Carpeta Raíz',
  settings_tab_general: 'General',
  settings_tab_java: 'Java Runtime',
  settings_tab_memory: 'Memoria & JVM',
  settings_tab_discord: 'Discord RPC',
  settings_tab_appearance: 'Apariencia',
  settings_tab_advanced: 'Avanzado',
  settings_language: 'IDIOMA DEL LAUNCHER',
  settings_language_desc: 'Elige el idioma de la interfaz de usuario.',
  settings_theme_preset: 'TEMA VISUAL & CRISTAL',
  settings_accent_color: 'COLOR DE ACENTO',
  settings_particles: 'Efectos de Partículas Ambientales',
  settings_legal_title: 'AVISO LEGAL Y MARCA REGISTRADA',
  settings_legal_disclaimer: 'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
  settings_legal_mojang_desc: 'Minecraft es una marca comercial de Mojang Studios / Microsoft Corporation. Ghostty Launcher es un lanzador independiente y de código abierto para la gestión de estancias y modding en Linux, de acuerdo con las Directrices Oficiales de Uso de Minecraft.',

  ctx_new_instance: 'Nueva Instancia...',
  ctx_import_modpack: 'Importar Modpack (.mrpack)...',
  ctx_play_instance: 'Jugar Instancia',
  ctx_stop_instance: 'Detener Instancia en Juego',
  ctx_open_folder: 'Abrir Carpeta',
  ctx_change_icon: 'Cambiar Icono...',
  ctx_favorite_add: 'Marcar como Favorito',
  ctx_favorite_remove: 'Quitar de Favoritos',
  ctx_duplicate: 'Duplicar Instancia',
  ctx_delete_instance: 'Eliminar Instancia',
  ctx_rename_group: 'Renombrar grupo',
  ctx_delete_group: 'Eliminar grupo',

  status_discord_active: 'DISCORD RPC ACTIVO',
  status_discord_off: 'DISCORD RPC DESACTIVADO',
  status_profiles_count: 'PERFILES',
};

const en: Translations = {
  nav_instances: 'Instances',
  nav_discover: 'Discover',
  nav_content: 'Content',
  nav_settings: 'Settings',
  nav_new_instance: '+ New Instance',
  nav_active_account: 'Active Account',

  search_instances_placeholder: 'Search instances...',
  group_all: 'All',
  group_favorites: 'Favorites',
  group_modpacks: 'Modpacks',
  group_add_group: '+ Group',
  group_name_placeholder: 'Group name...',
  play_now: 'PLAY NOW',
  ready_to_play: 'Ready to play',
  in_game: 'IN GAME',
  launching: 'LAUNCHING...',
  btn_mod_manager: 'Mod Manager',
  btn_instance_settings: 'Instance Settings',
  btn_open_folder: 'Open Folder',
  btn_console_logs: 'Console / Logs',
  btn_export: 'Export',
  btn_delete: 'Delete',
  instances_empty_title: 'No instances found in this group.',
  drag_to_reorder: 'Drag to reorder',

  acc_modal_title: 'ACCOUNT MANAGEMENT',
  acc_modal_subtitle: 'Manage your accounts, skins and capes from one place',
  acc_registered_accounts: 'REGISTERED ACCOUNTS',
  acc_skin_studio: 'SKIN STUDIO',
  acc_arm_geometry: 'ARM GEOMETRY',
  acc_classic_4px: 'Classic (4px)',
  acc_slim_3px: 'Slim (3px)',
  acc_local_file: 'LOCAL FILE (.PNG 64×64)',
  acc_upload_skin: 'Upload Skin (.png)',
  acc_import_premium: 'IMPORT BY PREMIUM NICK OR URL',
  acc_apply: 'Apply',
  acc_capes_title: 'ACCOUNT CAPES',
  acc_remove_cape: 'Remove cape',
  acc_tab_minecraft: 'Minecraft',
  acc_tab_elyby: 'Ely.by',
  acc_tab_offline: 'Offline',
  acc_login_msa_btn: 'Sign In with Microsoft (Device Code)',
  acc_msa_waiting: 'Waiting for authorization...',
  acc_cancel: 'Cancel',
  acc_code_in_ms: 'Code in Microsoft:',
  acc_open_link: 'Open link',
  acc_copied: 'Copied',
  acc_copy: 'Copy',

  create_modal_title: 'NEW MINECRAFT INSTANCE',
  create_modal_subtitle: 'Configure official version, Mod Loader and initial memory',
  create_name_label: 'Instance Name',
  create_name_placeholder: 'e.g. Technical Survival 1.21, Hardcore World...',
  create_version_label: 'Minecraft Version',
  create_loader_label: 'Mod Loader',
  create_icon_label: 'Instance Icon',
  create_ram_label: 'Allocated RAM',
  create_adv_options: 'Advanced Options (JVM Flags & Hook)',
  create_cancel: 'Cancel',
  create_submit: '+ Create Instance',

  java_modal_title: 'DOWNLOAD JAVA RUNTIME',
  java_modal_subtitle: 'Mojang, Adoptium Temurin, Azul Zulu & IBM Semeru',
  java_provider: 'PROVIDER',
  java_major_version: 'MAJOR VERSION',
  java_search_placeholder: 'Search version or name...',
  java_col_version: 'VERSION',
  java_col_name: 'JAVA NAME',
  java_col_released: 'RELEASED',
  java_col_type: 'TYPE',
  java_refresh: 'Refresh',
  java_download_btn: 'Download',
  java_cancel: 'Cancel',

  settings_title: 'LAUNCHER SETTINGS & ENVIRONMENT',
  settings_save: 'Save Changes',
  settings_saving: 'Saving...',
  settings_root_folder: 'Root Folder',
  settings_tab_general: 'General',
  settings_tab_java: 'Java Runtime',
  settings_tab_memory: 'Memory & JVM',
  settings_tab_discord: 'Discord RPC',
  settings_tab_appearance: 'Appearance',
  settings_tab_advanced: 'Advanced',
  settings_language: 'LAUNCHER LANGUAGE',
  settings_language_desc: 'Select user interface language.',
  settings_theme_preset: 'VISUAL THEME & GLASS',
  settings_accent_color: 'ACCENT COLOR',
  settings_particles: 'Ambient Particle Effects',
  settings_legal_title: 'LEGAL NOTICE & TRADEMARK',
  settings_legal_disclaimer: 'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
  settings_legal_mojang_desc: 'Minecraft is a trademark of Mojang Studios / Microsoft Corporation. Ghostty Launcher is an independent, open-source launcher for instance management and modding on Linux, complying with Minecraft Official Usage Guidelines.',

  ctx_new_instance: 'New Instance...',
  ctx_import_modpack: 'Import Modpack (.mrpack)...',
  ctx_play_instance: 'Play Instance',
  ctx_stop_instance: 'Stop Running Instance',
  ctx_open_folder: 'Open Folder',
  ctx_change_icon: 'Change Icon...',
  ctx_favorite_add: 'Add to Favorites',
  ctx_favorite_remove: 'Remove from Favorites',
  ctx_duplicate: 'Duplicate Instance',
  ctx_delete_instance: 'Delete Instance',
  ctx_rename_group: 'Rename group',
  ctx_delete_group: 'Delete group',

  status_discord_active: 'DISCORD RPC ACTIVE',
  status_discord_off: 'DISCORD RPC DISABLED',
  status_profiles_count: 'PROFILES',
};

const dictionaries: Record<Language, Translations> = { es, en };

const GHOSTTY_LANG_EVENT = 'ghostty:lang_change';

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'es';
  const val = localStorage.getItem('ghostty_launcher_lang');
  return val === 'en' ? 'en' : 'es';
}

export function useI18n() {
  const [language, setLangState] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent<Language>).detail;
      setLangState(newLang);
    };
    window.addEventListener(GHOSTTY_LANG_EVENT, handleLangChange);
    return () => window.removeEventListener(GHOSTTY_LANG_EVENT, handleLangChange);
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghostty_launcher_lang', newLang);
      window.dispatchEvent(new CustomEvent(GHOSTTY_LANG_EVENT, { detail: newLang }));
    }
    setLangState(newLang);
  }, []);

  return {
    language,
    setLanguage,
    t: dictionaries[language],
  };
}
