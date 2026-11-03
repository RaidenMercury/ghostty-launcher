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
  header_tagline: string;
  header_playing: string;
  header_downloading: string;

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
  inst_param_memory: string;
  inst_param_memory_desc: string;
  inst_java_exec: string;
  inst_java_default: string;
  inst_jvm_args: string;
  inst_jvm_default: string;
  inst_resolution: string;
  inst_fullscreen: string;
  inst_windowed: string;
  inst_env_vars: string;
  inst_hooks: string;
  inst_hooks_none: string;

  // Instance Settings Modal
  inst_settings_title: string;
  inst_settings_save: string;
  inst_settings_saving: string;
  inst_settings_tab_general: string;
  inst_settings_tab_icons: string;
  inst_settings_tab_java: string;
  inst_settings_tab_display: string;
  inst_settings_name_label: string;
  inst_settings_folder_btn: string;
  inst_settings_pre_launch: string;
  inst_settings_post_exit: string;
  inst_settings_icons_title: string;
  inst_settings_icons_desc: string;
  inst_settings_upload_png: string;
  inst_settings_java_path: string;
  inst_settings_java_download: string;
  inst_settings_java_placeholder: string;
  inst_settings_ram_min: string;
  inst_settings_ram_max: string;
  inst_settings_jvm_args: string;
  inst_settings_env_vars: string;
  inst_settings_env_key: string;
  inst_settings_env_val: string;
  inst_settings_res_width: string;
  inst_settings_res_height: string;
  inst_settings_fullscreen_opt: string;
  inst_settings_autoconnect: string;
  inst_settings_autoconnect_hint: string;

  // Mods Manager View
  mods_select_instance_prompt: string;
  mods_hint_mods: string;
  mods_hint_textures: string;
  mods_hint_shaders: string;
  mods_tab_mods: string;
  mods_tab_textures: string;
  mods_tab_shaders: string;
  mods_filter_all: string;
  mods_filter_enabled: string;
  mods_filter_disabled: string;
  mods_count_active: string;
  mods_count_inactive: string;
  mods_count_files: string;
  mods_total_size: string;
  mods_search_placeholder: string;
  mods_import_btn: string;
  mods_add_resources_btn: string;
  mods_folder_btn: string;
  mods_empty_title: string;
  mods_empty_desc: string;
  mods_delete_title: string;
  mods_toggle_on: string;
  mods_toggle_off: string;

  // Account Modal
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
  acc_msa_requesting: string;
  acc_msa_official: string;
  acc_cancel: string;
  acc_code_in_ms: string;
  acc_open_link: string;
  acc_copied: string;
  acc_copy: string;
  acc_connect_elyby: string;
  acc_login_elyby: string;
  acc_elyby_official: string;
  acc_offline_title: string;
  acc_offline_desc: string;
  acc_player_name: string;
  acc_create_offline: string;
  acc_reset_skin: string;
  acc_manual_link_prompt: string;
  acc_manual_link_hide: string;
  acc_link_btn: string;

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
  create_creating: string;
  create_instances_count: string;
  create_jvm_args: string;
  create_pre_launch: string;
  create_loader_fabric_desc: string;
  create_loader_neoforge_desc: string;
  create_loader_forge_desc: string;
  create_loader_quilt_desc: string;
  create_loader_vanilla_desc: string;

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
  java_installing: string;
  java_automated_install: string;
  java_packages_count: string;

  // Game Logs Modal
  logs_modal_title: string;
  logs_clear: string;
  logs_autoscroll: string;
  logs_empty: string;

  // Discover View
  disc_search_placeholder: string;
  disc_featured: string;
  disc_catalog: string;
  disc_install: string;
  disc_installing: string;
  disc_installed: string;
  disc_popular: string;
  disc_downloads: string;

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
  settings_ui_scale: string;
  settings_ui_scale_desc: string;
  settings_ui_scale_auto: string;
  settings_theme_preset: string;
  settings_theme_preset_desc: string;
  settings_accent_color: string;
  settings_accent_color_desc: string;
  settings_particles: string;
  settings_particles_floating: string;
  settings_particles_burst: string;
  settings_particles_artwork: string;
  settings_java_title: string;
  settings_java_desc: string;
  settings_java_scan_btn: string;
  settings_java_detected_count: string;
  settings_java_system_default: string;
  settings_java_binary_path: string;
  settings_java_download_title: string;
  settings_java_download_desc: string;
  settings_java_catalog_btn: string;
  settings_mem_title: string;
  settings_mem_desc: string;
  settings_mem_min: string;
  settings_mem_max: string;
  settings_gc_title: string;
  settings_gc_desc: string;
  settings_discord_title: string;
  settings_discord_desc: string;
  settings_discord_line1: string;
  settings_discord_line2: string;
  settings_discord_preview_title: string;
  settings_res_title: string;
  settings_res_desc: string;
  settings_res_width: string;
  settings_res_height: string;
  settings_res_fullscreen: string;
  settings_connect_title: string;
  settings_connect_desc: string;
  settings_connect_server: string;
  settings_behavior_launch: string;
  settings_behavior_keep: string;
  settings_behavior_minimize: string;
  settings_behavior_close: string;
  settings_hooks_title: string;
  settings_hooks_desc: string;
  settings_hooks_pre: string;
  settings_hooks_post: string;
  settings_env_title: string;
  settings_env_desc: string;
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

  // Common
  common_cancel: string;
  common_save: string;
  common_saving: string;
  common_delete: string;
  common_import: string;
  common_folder: string;
  common_refresh: string;
}

const es: Translations = {
  nav_instances: 'Instancias',
  nav_discover: 'Descubrir',
  nav_content: 'Contenido',
  nav_settings: 'Ajustes',
  nav_new_instance: 'Nueva Instancia',
  nav_active_account: 'Cuenta Activa',
  header_tagline: 'visionOS Glass • Modding Suite',
  header_playing: 'Jugando a',
  header_downloading: 'Descargando recurso',

  search_instances_placeholder: 'Buscar instancias...',
  group_all: 'Todos',
  group_favorites: 'Favoritos',
  group_modpacks: 'Modpacks',
  group_add_group: 'Grupo',
  group_name_placeholder: 'Nombre grupo...',
  play_now: 'JUGAR AHORA',
  ready_to_play: 'Listo para jugar',
  in_game: 'EN PARTIDA',
  launching: 'INICIANDO...',
  btn_mod_manager: 'Gestor de Mods',
  btn_instance_settings: 'Ajustes de la Instancia',
  btn_open_folder: 'Abrir Carpeta',
  btn_console_logs: 'Consola / Logs',
  btn_export: 'Exportar',
  btn_delete: 'Eliminar',
  instances_empty_title: 'No encontramos instancias en este grupo.',
  drag_to_reorder: 'Arrastra para reordenar',
  inst_param_memory: 'Parámetros de Memoria y Máquina Virtual Java',
  inst_param_memory_desc: 'Configuración activa de ejecución para este perfil',
  inst_java_exec: 'Ejecutable Java',
  inst_java_default: 'Heredado del sistema (/usr/bin/java)',
  inst_jvm_args: 'Argumentos JVM',
  inst_jvm_default: 'Predeterminados de GhosttyLauncher',
  inst_resolution: 'Resolución Pantalla',
  inst_fullscreen: 'Pantalla completa',
  inst_windowed: 'Ventana estándar',
  inst_env_vars: 'Variables de Entorno',
  inst_hooks: 'Comandos Pre / Post Hooks',
  inst_hooks_none: 'Ninguno configurado',

  inst_settings_title: 'Ajustes de la Estancia',
  inst_settings_save: 'Guardar Ajustes',
  inst_settings_saving: 'Guardando...',
  inst_settings_tab_general: 'General & Hooks',
  inst_settings_tab_icons: 'Icono',
  inst_settings_tab_java: 'Java & Memoria',
  inst_settings_tab_display: 'Pantalla & Red',
  inst_settings_name_label: 'Nombre de la Estancia',
  inst_settings_folder_btn: 'Directorio',
  inst_settings_pre_launch: 'Comando Pre-Lanzamiento',
  inst_settings_post_exit: 'Comando Post-Salida',
  inst_settings_icons_title: 'ICONO DE LA ESTANCIA',
  inst_settings_icons_desc: 'Elige un objeto o bloque oficial de Minecraft o sube un icono personalizado (.png).',
  inst_settings_upload_png: 'Subir PNG',
  inst_settings_java_path: 'Ruta Ejecutable de Java',
  inst_settings_java_download: 'Descargar Runtimes...',
  inst_settings_java_placeholder: 'Dejar vacío para heredar el Java global',
  inst_settings_ram_min: 'RAM Mínima (-Xms)',
  inst_settings_ram_max: 'RAM Máxima (-Xmx)',
  inst_settings_jvm_args: 'Argumentos JVM',
  inst_settings_env_vars: 'Variables de Entorno',
  inst_settings_env_key: 'CLAVE',
  inst_settings_env_val: 'VALOR',
  inst_settings_res_width: 'Ancho de Ventana (px)',
  inst_settings_res_height: 'Alto de Ventana (px)',
  inst_settings_fullscreen_opt: 'Iniciar siempre en modo Pantalla Completa (--fullscreen)',
  inst_settings_autoconnect: 'Auto-Conectar a Servidor al Iniciar (Opcional)',
  inst_settings_autoconnect_hint: 'ej. play.hypixel.net:25565',

  mods_select_instance_prompt: 'Selecciona una estancia para gestionar sus mods.',
  mods_hint_mods: 'Gestor de mods .jar',
  mods_hint_textures: 'Paquetes de texturas .zip',
  mods_hint_shaders: 'Paquetes de shaders .zip',
  mods_tab_mods: 'Mods',
  mods_tab_textures: 'Texturas',
  mods_tab_shaders: 'Shaders',
  mods_filter_all: 'Todos',
  mods_filter_enabled: 'Activos',
  mods_filter_disabled: 'Inactivos',
  mods_count_active: 'ACTIVOS',
  mods_count_inactive: 'INACTIVOS',
  mods_count_files: 'ARCHIVOS',
  mods_total_size: 'PESO TOTAL',
  mods_search_placeholder: 'Filtrar archivos...',
  mods_import_btn: 'Importar',
  mods_add_resources_btn: 'Añadir recursos',
  mods_folder_btn: 'Carpeta',
  mods_empty_title: 'No hay elementos todavía.',
  mods_empty_desc: 'Arrastra archivos (.jar / .zip) aquí o descárgalos desde Descubrir.',
  mods_delete_title: 'Eliminar elemento',
  mods_toggle_on: 'Habilitar',
  mods_toggle_off: 'Deshabilitar',

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
  acc_msa_requesting: 'Solicitando código OAuth...',
  acc_msa_official: 'Autenticación Oficial Microsoft OAuth 2.0',
  acc_cancel: 'Cancelar',
  acc_code_in_ms: 'Código en Microsoft:',
  acc_open_link: 'Abrir enlace',
  acc_copied: 'Copiado',
  acc_copy: 'Copiar',
  acc_connect_elyby: 'Conectando a Ely.by...',
  acc_login_elyby: 'Iniciar Sesión Ely.by',
  acc_elyby_official: 'Autenticación Yggdrasil Ely.by',
  acc_offline_title: 'Añadir Perfil Offline (UUID v3)',
  acc_offline_desc: 'Crea un perfil local sin DRM para jugar offline.',
  acc_player_name: 'Nombre de jugador...',
  acc_create_offline: 'Crear',
  acc_reset_skin: 'Restablecer a skin original',
  acc_manual_link_prompt: '¿Vincular por Gamertag o Token directo?',
  acc_manual_link_hide: 'Ocultar vinculación manual',
  acc_link_btn: 'Vincular',

  create_modal_title: 'NUEVA INSTANCIA DE MINECRAFT',
  create_modal_subtitle: 'Configura versión oficial, Mod Loader y memoria inicial',
  create_name_label: 'Nombre de la Instancia',
  create_name_placeholder: 'ej. Survival Técnico 1.21, Mundo Hardcore...',
  create_version_label: 'Versión de Minecraft',
  create_loader_label: 'Mod Loader',
  create_icon_label: 'Icono de la instancia',
  create_ram_label: 'Memoria RAM Asignada',
  create_adv_options: 'Opciones Avanzadas (Flags JVM y Hook)',
  create_cancel: 'Cancelar',
  create_submit: 'Crear Instancia',
  create_creating: 'Creando...',
  create_instances_count: 'disponibles',
  create_jvm_args: 'Argumentos JVM',
  create_pre_launch: 'Comando Pre-Lanzamiento',
  create_loader_fabric_desc: 'Ligero y modular',
  create_loader_neoforge_desc: 'Modding moderno',
  create_loader_forge_desc: 'Clásico compatible',
  create_loader_quilt_desc: 'Comunitario',
  create_loader_vanilla_desc: 'Oficial puro',

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
  java_installing: 'Instalando...',
  java_automated_install: 'Instalación automatizada',
  java_packages_count: 'paquete(s)',

  logs_modal_title: 'Consola de Salida JVM',
  logs_clear: 'Limpiar Consola',
  logs_autoscroll: 'Auto-scroll',
  logs_empty: 'No hay logs emitidos todavía.',

  disc_search_placeholder: 'Buscar en',
  disc_featured: 'DESTACADOS EN',
  disc_catalog: 'CATÁLOGO COMPLETO',
  disc_install: 'Instalar',
  disc_installing: 'Instalando...',
  disc_installed: 'Instalado',
  disc_popular: 'Populares',
  disc_downloads: 'desc.',

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
  settings_ui_scale: 'ESCALA DE LA INTERFAZ',
  settings_ui_scale_desc: 'Reescala dinámicamente toda la interfaz para pantallas de menor resolución (720p, Steam Deck) o monitores grandes sin romper el diseño.',
  settings_ui_scale_auto: 'Automático (Recomendado)',
  settings_theme_preset: 'TEMAS DE VIDRIO ESMERILADO (VISIONOS)',
  settings_theme_preset_desc: 'Cambia la atmósfera base de las capas translúcidas del launcher.',
  settings_accent_color: 'COLOR DE ACENTO ÚNICO',
  settings_accent_color_desc: 'Se aplica con moderación al botón Jugar, selección activa, foco e indicadores.',
  settings_particles: 'EFECTOS CINÉTICOS Y PARTÍCULAS',
  settings_particles_floating: 'Partículas flotantes de fondo',
  settings_particles_burst: 'Explosión de partículas al pulsar Jugar o Instalar',
  settings_particles_artwork: 'Arte del modpack difuminado y animado en el fondo',
  settings_java_title: 'SELECCIÓN DE EJECUTABLE JAVA',
  settings_java_desc: 'Elige una instalación detectada en tu equipo o especifica una ruta manual.',
  settings_java_scan_btn: 'Detectar JVMs',
  settings_java_detected_count: 'Instalaciones Detectadas',
  settings_java_system_default: 'Java predeterminado del sistema (/usr/bin/java)',
  settings_java_binary_path: 'Ruta del Binario Java',
  settings_java_download_title: 'DESCARGAR RUNTIME DE JAVA',
  settings_java_download_desc: 'Runtimes oficiales de Mojang, Adoptium Temurin, Azul Zulu e IBM Semeru OpenJ9.',
  settings_java_catalog_btn: 'Abrir Catálogo de Java...',
  settings_mem_title: 'ASIGNACIÓN DE MEMORIA RAM',
  settings_mem_desc: 'Memoria reservada para el heap de Java (-Xms y -Xmx).',
  settings_mem_min: 'RAM Mínima (-Xms)',
  settings_mem_max: 'RAM Máxima (-Xmx)',
  settings_gc_title: 'PERFILES DE RECOLECTOR DE BASURA (GC) & FLAGS JVM',
  settings_gc_desc: 'Optimiza los tirones de FPS según el tamaño de tu modpack.',
  settings_discord_title: 'DISCORD RICH PRESENCE PERSONALIZADO',
  settings_discord_desc: 'Muestra tu actividad en tiempo real con el icono oficial de GhosttyLauncher.',
  settings_discord_line1: 'Línea Principal (Detalles)',
  settings_discord_line2: 'Línea Secundaria (Estado)',
  settings_discord_preview_title: 'Jugando a un juego',
  settings_res_title: 'RESOLUCIÓN DE PANTALLA Y VENTANA',
  settings_res_desc: 'Resolución de renderizado al iniciar instancias.',
  settings_res_width: 'Ancho (px)',
  settings_res_height: 'Alto (px)',
  settings_res_fullscreen: 'Iniciar Minecraft directamente en Pantalla Completa (--fullscreen)',
  settings_connect_title: 'CONEXIÓN DIRECTA Y COMPORTAMIENTO',
  settings_connect_desc: 'Servidor automático al entrar y acción de la ventana del launcher.',
  settings_connect_server: 'Servidor Auto-Conectar (Opcional)',
  settings_behavior_launch: 'Al iniciar el juego:',
  settings_behavior_keep: 'Mantener Abierto',
  settings_behavior_minimize: 'Minimizar Isla',
  settings_behavior_close: 'Cerrar Launcher',
  settings_hooks_title: 'Comandos Pre-Lanzamiento y Post-Salida (Hooks)',
  settings_hooks_desc: 'Ejecuta scripts personalizados antes de iniciar o al cerrar Minecraft',
  settings_hooks_pre: 'Comando Pre-Lanzamiento',
  settings_hooks_post: 'Comando Post-Salida',
  settings_env_title: 'Variables de Entorno',
  settings_env_desc: 'Variables inyectadas al proceso de Java (ej. MESA_GL_VERSION_OVERRIDE)',
  settings_legal_title: 'AVISO LEGAL Y MARCA REGISTRADA',
  settings_legal_disclaimer: 'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
  settings_legal_mojang_desc: 'Minecraft es una marca comercial de Mojang Studios / Microsoft Corporation. Ghostty Launcher es un lanzador independiente y de código abierto para la gestión de instancias y modding en Linux, Windows y macOS, de acuerdo con las Directrices Oficiales de Uso de Minecraft.',

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

  common_cancel: 'Cancelar',
  common_save: 'Guardar Ajustes',
  common_saving: 'Guardando...',
  common_delete: 'Eliminar',
  common_import: 'Importar',
  common_folder: 'Carpeta',
  common_refresh: 'Refrescar',
};

const en: Translations = {
  nav_instances: 'Instances',
  nav_discover: 'Discover',
  nav_content: 'Content',
  nav_settings: 'Settings',
  nav_new_instance: 'New Instance',
  nav_active_account: 'Active Account',
  header_tagline: 'visionOS Glass • Modding Suite',
  header_playing: 'Playing',
  header_downloading: 'Downloading resource',

  search_instances_placeholder: 'Search instances...',
  group_all: 'All',
  group_favorites: 'Favorites',
  group_modpacks: 'Modpacks',
  group_add_group: 'Group',
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
  inst_param_memory: 'Memory & Java Virtual Machine Parameters',
  inst_param_memory_desc: 'Active runtime configuration for this profile',
  inst_java_exec: 'Java Executable',
  inst_java_default: 'System default (/usr/bin/java)',
  inst_jvm_args: 'JVM Arguments',
  inst_jvm_default: 'GhosttyLauncher defaults',
  inst_resolution: 'Display Resolution',
  inst_fullscreen: 'Fullscreen',
  inst_windowed: 'Standard window',
  inst_env_vars: 'Environment Variables',
  inst_hooks: 'Pre / Post Launch Hooks',
  inst_hooks_none: 'None configured',

  inst_settings_title: 'Instance Settings',
  inst_settings_save: 'Save Settings',
  inst_settings_saving: 'Saving...',
  inst_settings_tab_general: 'General & Hooks',
  inst_settings_tab_icons: 'Icon',
  inst_settings_tab_java: 'Java & Memory',
  inst_settings_tab_display: 'Display & Network',
  inst_settings_name_label: 'Instance Name',
  inst_settings_folder_btn: 'Directory',
  inst_settings_pre_launch: 'Pre-Launch Command',
  inst_settings_post_exit: 'Post-Exit Command',
  inst_settings_icons_title: 'INSTANCE ICON',
  inst_settings_icons_desc: 'Choose an official Minecraft item/block or upload a custom (.png) icon.',
  inst_settings_upload_png: 'Upload PNG',
  inst_settings_java_path: 'Java Executable Path',
  inst_settings_java_download: 'Download Runtimes...',
  inst_settings_java_placeholder: 'Leave blank to inherit global Java',
  inst_settings_ram_min: 'Minimum RAM (-Xms)',
  inst_settings_ram_max: 'Maximum RAM (-Xmx)',
  inst_settings_jvm_args: 'JVM Arguments',
  inst_settings_env_vars: 'Environment Variables',
  inst_settings_env_key: 'KEY',
  inst_settings_env_val: 'VALUE',
  inst_settings_res_width: 'Window Width (px)',
  inst_settings_res_height: 'Window Height (px)',
  inst_settings_fullscreen_opt: 'Always launch in Fullscreen mode (--fullscreen)',
  inst_settings_autoconnect: 'Auto-Connect to Server on Launch (Optional)',
  inst_settings_autoconnect_hint: 'e.g. play.hypixel.net:25565',

  mods_select_instance_prompt: 'Select an instance to manage its mods.',
  mods_hint_mods: '.jar mod manager',
  mods_hint_textures: '.zip texture packs',
  mods_hint_shaders: '.zip shader packs',
  mods_tab_mods: 'Mods',
  mods_tab_textures: 'Textures',
  mods_tab_shaders: 'Shaders',
  mods_filter_all: 'All',
  mods_filter_enabled: 'Active',
  mods_filter_disabled: 'Inactive',
  mods_count_active: 'ACTIVE',
  mods_count_inactive: 'INACTIVE',
  mods_count_files: 'FILES',
  mods_total_size: 'TOTAL SIZE',
  mods_search_placeholder: 'Filter files...',
  mods_import_btn: 'Import',
  mods_add_resources_btn: 'Add resources',
  mods_folder_btn: 'Folder',
  mods_empty_title: 'No items yet.',
  mods_empty_desc: 'Drag & drop (.jar / .zip) files here or discover more.',
  mods_delete_title: 'Delete item',
  mods_toggle_on: 'Enable',
  mods_toggle_off: 'Disable',

  acc_modal_title: 'ACCOUNT MANAGEMENT',
  acc_modal_subtitle: 'Manage your accounts, skins, and capes from one place',
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
  acc_login_msa_btn: 'Sign in with Microsoft (Device Code)',
  acc_msa_waiting: 'Waiting for authorization...',
  acc_msa_requesting: 'Requesting OAuth code...',
  acc_msa_official: 'Official Microsoft OAuth 2.0 Authentication',
  acc_cancel: 'Cancel',
  acc_code_in_ms: 'Code at Microsoft:',
  acc_open_link: 'Open link',
  acc_copied: 'Copied',
  acc_copy: 'Copy',
  acc_connect_elyby: 'Connecting to Ely.by...',
  acc_login_elyby: 'Sign in with Ely.by',
  acc_elyby_official: 'Yggdrasil Ely.by Authentication',
  acc_offline_title: 'Add Offline Profile (UUID v3)',
  acc_offline_desc: 'Create a local DRM-free profile to play offline.',
  acc_player_name: 'Player name...',
  acc_create_offline: 'Create',
  acc_reset_skin: 'Reset to original skin',
  acc_manual_link_prompt: 'Link via Gamertag or direct Token?',
  acc_manual_link_hide: 'Hide manual link',
  acc_link_btn: 'Link',

  create_modal_title: 'NEW MINECRAFT INSTANCE',
  create_modal_subtitle: 'Configure official version, Mod Loader and initial memory',
  create_name_label: 'Instance Name',
  create_name_placeholder: 'e.g. Technical Survival 1.21, Hardcore World...',
  create_version_label: 'Minecraft Version',
  create_loader_label: 'Mod Loader',
  create_icon_label: 'Instance Icon',
  create_ram_label: 'Allocated RAM Memory',
  create_adv_options: 'Advanced Options (JVM Flags & Hook)',
  create_cancel: 'Cancel',
  create_submit: 'Create Instance',
  create_creating: 'Creating...',
  create_instances_count: 'available',
  create_jvm_args: 'JVM Arguments',
  create_pre_launch: 'Pre-Launch Command',
  create_loader_fabric_desc: 'Lightweight & modular',
  create_loader_neoforge_desc: 'Modern modding',
  create_loader_forge_desc: 'Classic compatibility',
  create_loader_quilt_desc: 'Community driven',
  create_loader_vanilla_desc: 'Pure official',

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
  java_installing: 'Installing...',
  java_automated_install: 'Automated installation',
  java_packages_count: 'package(s)',

  logs_modal_title: 'JVM Output Console',
  logs_clear: 'Clear Console',
  logs_autoscroll: 'Auto-scroll',
  logs_empty: 'No logs emitted yet.',

  disc_search_placeholder: 'Search in',
  disc_featured: 'FEATURED IN',
  disc_catalog: 'FULL CATALOG',
  disc_install: 'Install',
  disc_installing: 'Installing...',
  disc_installed: 'Installed',
  disc_popular: 'Popular',
  disc_downloads: 'dls.',

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
  settings_ui_scale: 'UI SCALING',
  settings_ui_scale_desc: 'Dynamically rescales the entire interface for lower resolution screens (720p, Steam Deck) or large monitors without breaking layout.',
  settings_ui_scale_auto: 'Auto (Recommended)',
  settings_theme_preset: 'FROSTED GLASS THEMES (VISIONOS)',
  settings_theme_preset_desc: 'Change the base visual atmosphere of the translucent layers.',
  settings_accent_color: 'UNIQUE ACCENT COLOR',
  settings_accent_color_desc: 'Applied sparingly to Play button, active selection, focus, and indicators.',
  settings_particles: 'KINETIC EFFECTS & PARTICLES',
  settings_particles_floating: 'Floating ambient background particles',
  settings_particles_burst: 'Particle burst when clicking Play or Install',
  settings_particles_artwork: 'Blurred & animated modpack artwork in the background',
  settings_java_title: 'JAVA EXECUTABLE SELECTION',
  settings_java_desc: 'Choose a detected installation on your machine or enter a custom path.',
  settings_java_scan_btn: 'Scan JVMs',
  settings_java_detected_count: 'Detected Installations',
  settings_java_system_default: 'System default Java (/usr/bin/java)',
  settings_java_binary_path: 'Java Binary Path',
  settings_java_download_title: 'DOWNLOAD JAVA RUNTIME',
  settings_java_download_desc: 'Official runtimes from Mojang, Adoptium Temurin, Azul Zulu & IBM Semeru OpenJ9.',
  settings_java_catalog_btn: 'Open Java Catalog...',
  settings_mem_title: 'RAM MEMORY ALLOCATION',
  settings_mem_desc: 'Memory reserved for the Java heap (-Xms and -Xmx).',
  settings_mem_min: 'Minimum RAM (-Xms)',
  settings_mem_max: 'Maximum RAM (-Xmx)',
  settings_gc_title: 'GARBAGE COLLECTOR (GC) PROFILES & JVM FLAGS',
  settings_gc_desc: 'Optimize FPS stutters according to your modpack size.',
  settings_discord_title: 'CUSTOM DISCORD RICH PRESENCE',
  settings_discord_desc: 'Showcase your real-time activity with the official GhosttyLauncher icon.',
  settings_discord_line1: 'Primary Line (Details)',
  settings_discord_line2: 'Secondary Line (State)',
  settings_discord_preview_title: 'Playing a game',
  settings_res_title: 'DISPLAY & WINDOW RESOLUTION',
  settings_res_desc: 'Rendering resolution when launching instances.',
  settings_res_width: 'Width (px)',
  settings_res_height: 'Height (px)',
  settings_res_fullscreen: 'Always launch Minecraft in Fullscreen (--fullscreen)',
  settings_connect_title: 'DIRECT CONNECTION & BEHAVIOR',
  settings_connect_desc: 'Auto-join server upon entry and launcher window behavior.',
  settings_connect_server: 'Server Auto-Connect (Optional)',
  settings_behavior_launch: 'When starting game:',
  settings_behavior_keep: 'Keep Open',
  settings_behavior_minimize: 'Minimize Island',
  settings_behavior_close: 'Close Launcher',
  settings_hooks_title: 'Pre-Launch & Post-Exit Commands (Hooks)',
  settings_hooks_desc: 'Execute custom scripts before launching or upon closing Minecraft',
  settings_hooks_pre: 'Pre-Launch Command',
  settings_hooks_post: 'Post-Exit Command',
  settings_env_title: 'Environment Variables',
  settings_env_desc: 'Variables injected into the Java process (e.g. MESA_GL_VERSION_OVERRIDE)',
  settings_legal_title: 'LEGAL NOTICE & TRADEMARK',
  settings_legal_disclaimer: 'NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.',
  settings_legal_mojang_desc: 'Minecraft is a trademark of Mojang Studios / Microsoft Corporation. Ghostty Launcher is an independent, open-source launcher for instance management and modding across Linux, Windows and macOS, complying with Minecraft Official Usage Guidelines.',

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

  common_cancel: 'Cancel',
  common_save: 'Save Settings',
  common_saving: 'Saving...',
  common_delete: 'Delete',
  common_import: 'Import',
  common_folder: 'Folder',
  common_refresh: 'Refresh',
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
