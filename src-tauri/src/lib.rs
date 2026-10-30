pub mod accounts;
pub mod commands;
pub mod config;
pub mod engine;
pub mod instances;
pub mod launcher;
pub mod models;
pub mod modpack;
pub mod modrinth;
pub mod versions;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    config::init_directories().expect("Failed to initialize launcher directories");

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            add_offline_account,
            set_active_account,
            delete_account,
            get_instances,
            create_instance,
            update_instance,
            delete_instance,
            export_instance,
            get_mojang_manifest,
            get_fabric_loaders,
            search_modrinth,
            get_modrinth_versions,
            install_modrinth_mod,
            detect_java,
            get_instance_mods,
            toggle_instance_mod,
            launch_game,
            import_modpack_file,
            install_online_modpack
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ghostty Launcher");
}
