pub mod accounts;
pub mod capes;
pub mod commands;
pub mod discord;
pub mod engine;
pub mod export;
pub mod forge;
pub mod game;
pub mod instances;
pub mod java;
pub mod launcher;
pub mod models;
pub mod modpack;
pub mod modrinth;
pub mod versions;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        const BUILD_TAG: &str = "5";

        if std::env::var_os("MALLOC_TRIM_THRESHOLD_").is_none() {
            std::env::set_var("MALLOC_TRIM_THRESHOLD_", "65536");
        }
        if std::env::var_os("MALLOC_MMAP_THRESHOLD_").is_none() {
            std::env::set_var("MALLOC_MMAP_THRESHOLD_", "65536");
        }

        // TextureMapper se descartó porque no implementa filtros CSS (el blur no se pinta), así que
        // el default vuelve a Skia; `texturemapper` queda solo como diagnóstico.

        // Los tiles de Skia (512x512 con textura propia) son el grueso de la VRAM:
        // ~700 MiB al navegar. Pintarlos en CPU los mueve a RAM (~160-180 MiB) sin
        // cambiar el aspecto; GHOSTTY_GPU_RENDERING=1 fuerza la ruta GPU.
        let mut cpu_raster = false;
        if std::env::var_os("WEBKIT_SKIA_ENABLE_CPU_RENDERING").is_none()
            && std::env::var_os("GHOSTTY_GPU_RENDERING").map_or(true, |v| v != "1")
        {
            std::env::set_var("WEBKIT_SKIA_ENABLE_CPU_RENDERING", "1");
            cpu_raster = true;
        }

        let mut ghostty = String::new();
        if let Some(raw) = std::env::var_os("GHOSTTY_COMPOSITOR") {
            ghostty = raw.to_string_lossy().trim().to_string().to_lowercase();
        }

        let user_override = std::env::var_os("WEBKIT_USE_SKIA_FOR_COMPOSITION").is_some()
            || std::env::var_os("WEBKIT_DMABUF_RENDERER_FORCE_SHM").is_some();

        let mode;
        if user_override {
            mode = "override del usuario";
        } else if ghostty == "shm" {
            if std::env::var_os("WEBKIT_DMABUF_RENDERER_FORCE_SHM").is_none() {
                std::env::set_var("WEBKIT_DMABUF_RENDERER_FORCE_SHM", "1");
            }
            mode = "shm";
        } else if ghostty == "texturemapper" {
            if std::env::var_os("WEBKIT_USE_SKIA_FOR_COMPOSITION").is_none() {
                std::env::set_var("WEBKIT_USE_SKIA_FOR_COMPOSITION", "0");
            }
            mode = "texturemapper";
        } else {
            mode = "skia (default)";
        }

        eprintln!(
            "[ghostty] build {} | webkit: {} | raster: {}",
            BUILD_TAG,
            mode,
            if cpu_raster { "cpu (menos VRAM)" } else { "gpu" }
        );
    }

    tauri::Builder::default()
        .setup(|_app| {
            let _ = launcher::LauncherManager::ensure_structure();
            discord::DiscordRpcManager::init_from_config();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_instances,
            create_instance,
            delete_instance,
            duplicate_instance,
            get_mod_icons,
            update_instance,
            get_instance_mods,
            toggle_instance_mod,
            delete_instance_mod,
            get_config,
            save_config,
            update_discord_rpc,
            set_discord_selection,
            get_mojang_versions,
            detect_java,
            download_java_runtime,
            get_java_releases,
            get_accounts,
            add_offline_account,
            iniciar_oauth_dispositivo,
            esperar_autorizacion_microsoft,
            login_elyby,
            login_elyby_account,
            login_microsoft_account,
            set_active_account,
            get_account_skin,
            get_account_capes,
            set_account_cape,
            update_account_skin,
            remove_account,
            open_launcher_folder,
            open_instance_folder,
            open_external_url,
            launch_instance,
            stop_instance,
            search_modrinth,
            get_modrinth_versions,
            install_modrinth_mod,
            import_mrpack,
            begin_modpack_upload,
            append_modpack_chunk,
            finish_modpack_upload,
            import_mrpack_bytes,
            install_online_modpack,
            export_instance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
