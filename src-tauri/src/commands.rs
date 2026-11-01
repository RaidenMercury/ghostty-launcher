use crate::accounts::{AccountManager, DeviceCodeResponse};
use crate::capes::Cape;
use crate::discord::DiscordRpcManager;
use crate::engine::GameEngine;
use crate::instances::{ensure_supported_loader, InstanceManager};
use crate::java::JavaDetector;
use crate::launcher::LauncherManager;
use crate::models::{Account, Instance, LauncherConfig, ModFileInfo, MojangManifest, SystemJavaInfo};
use crate::modpack::ModpackEngine;
use crate::modrinth::{ModrinthClient, ModrinthSearchResponse, ModrinthVersion};
use crate::versions::VersionFetcher;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

#[tauri::command]
pub fn get_instances() -> Result<Vec<Instance>, String> {
    LauncherManager::load_instances()
}

#[tauri::command]
pub async fn create_instance(
    name: String,
    mc_version: String,
    loader: String,
    loader_version: Option<String>,
    icon: Option<String>,
    memory_min_mb: Option<u64>,
    memory_max_mb: Option<u64>,
    jvm_args: Option<String>,
    pre_launch_command: Option<String>,
) -> Result<Instance, String> {
    let mut loader_version = loader_version;
    let loader_lower = loader.to_ascii_lowercase();

    if loader_lower == "forge" || loader_lower == "neoforge" {
        let id = crate::forge::ForgeInstaller::install(
            &mc_version,
            &loader_lower,
            loader_version.as_deref(),
        )
        .await?;

        loader_version = Some(if loader_lower == "forge" {
            id.trim_start_matches(&format!("{mc_version}-forge-")).to_string()
        } else {
            id.trim_start_matches("neoforge-").to_string()
        });
    }

    InstanceManager::create_instance(
        name,
        mc_version,
        loader,
        loader_version,
        icon,
        memory_min_mb,
        memory_max_mb,
        jvm_args,
        pre_launch_command,
    )
}

#[tauri::command]
pub fn delete_instance(id: String) -> Result<Vec<Instance>, String> {
    InstanceManager::delete_instance(&id)
}

#[tauri::command]
pub fn update_instance(instance: Instance) -> Result<Vec<Instance>, String> {
    let mut instances = LauncherManager::load_instances()?;
    if let Some(idx) = instances.iter().position(|i| i.id == instance.id) {
        // Cambiar a un loader sin motor dejaría una instancia que arranca vanilla.
        if !instances[idx].loader.eq_ignore_ascii_case(&instance.loader) {
            ensure_supported_loader(&instance.loader)?;
        }
        instances[idx] = instance;
        LauncherManager::save_instances(&instances)?;
    }
    Ok(instances)
}

#[tauri::command]
pub fn get_instance_mods(
    instance_id: String,
    kind: Option<String>,
) -> Result<Vec<ModFileInfo>, String> {
    InstanceManager::list_content(&instance_id, kind.as_deref().unwrap_or("mods"))
}

#[tauri::command]
pub fn toggle_instance_mod(
    instance_id: String,
    filename: String,
    kind: Option<String>,
) -> Result<ModFileInfo, String> {
    InstanceManager::toggle_content(&instance_id, &filename, kind.as_deref().unwrap_or("mods"))
}

#[tauri::command]
pub fn delete_instance_mod(
    instance_id: String,
    filename: String,
    kind: Option<String>,
) -> Result<(), String> {
    InstanceManager::delete_content(&instance_id, &filename, kind.as_deref().unwrap_or("mods"))
}

#[tauri::command]
pub fn get_config() -> Result<LauncherConfig, String> {
    LauncherManager::load_config()
}

#[tauri::command]
pub fn save_config(config: LauncherConfig) -> Result<(), String> {
    DiscordRpcManager::update_presence(
        config.enable_discord_rpc,
        &config.discord_Rpc_details,
        &config.discord_Rpc_state,
    );
    LauncherManager::save_config(&config)
}

#[tauri::command]
pub fn update_discord_rpc(enabled: bool, details: String, state: String) -> Result<(), String> {
    if let Ok(mut cfg) = LauncherManager::load_config() {
        cfg.enable_discord_rpc = enabled;
        cfg.discord_Rpc_details = details.clone();
        cfg.discord_Rpc_state = state.clone();
        let _ = LauncherManager::save_config(&cfg);
    }
    DiscordRpcManager::update_presence(enabled, &details, &state);
    Ok(())
}

#[tauri::command]
pub async fn get_java_releases() -> Result<Vec<u32>, String> {
    crate::java::adoptium::available_releases().await
}

#[tauri::command]
pub async fn download_java_runtime(
    vendor: String,
    major_version: u32,
) -> Result<SystemJavaInfo, String> {
    match vendor.to_ascii_lowercase().as_str() {
        "temurin" | "adoptium" | "eclipse" => crate::java::adoptium::install(major_version).await,
        other => Err(format!(
            "Proveedor '{other}' no soportado todavía; usa temurin (Adoptium)."
        )),
    }
}

#[tauri::command]
pub async fn detect_java() -> Result<Vec<SystemJavaInfo>, String> {
    // Escanear y sondear JVMs lanza procesos: fuera del hilo de la UI.
    tokio::task::spawn_blocking(JavaDetector::detect)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_mojang_versions() -> Result<MojangManifest, String> {
    VersionFetcher::fetch_mojang_manifest().await
}

#[tauri::command]
pub fn get_accounts() -> Result<Vec<Account>, String> {
    AccountManager::load_accounts()
}

#[tauri::command]
pub fn add_offline_account(username: String) -> Result<Vec<Account>, String> {
    AccountManager::add_account(&username)
}

#[tauri::command]
pub async fn iniciar_oauth_dispositivo() -> Result<DeviceCodeResponse, String> {
    AccountManager::iniciar_oauth_dispositivo().await
}

#[tauri::command]
pub async fn esperar_autorizacion_microsoft(
    device_code: String,
    interval: u64,
) -> Result<Account, String> {
    AccountManager::esperar_autorizacion_microsoft(&device_code, interval).await
}

#[tauri::command]
pub async fn login_elyby(
    correo: String,
    contrasena: String,
    totp: Option<String>,
) -> Result<Vec<Account>, String> {
    AccountManager::login_elyby(&correo, &contrasena, totp).await
}

#[tauri::command]
pub async fn login_elyby_account(
    username: String,
    password: String,
    totp: Option<String>,
) -> Result<Vec<Account>, String> {
    AccountManager::login_elyby(&username, &password, totp).await
}

#[tauri::command]
pub async fn login_microsoft_account(identifier: String) -> Result<Vec<Account>, String> {
    AccountManager::login_microsoft(&identifier).await
}

#[tauri::command]
pub async fn get_account_skin(account_id: String) -> Result<Option<String>, String> {
    crate::capes::skin_url(&account_id).await
}

#[tauri::command]
pub async fn get_account_capes(account_id: String) -> Result<Vec<Cape>, String> {
    crate::capes::list(&account_id).await
}

#[tauri::command]
pub async fn set_account_cape(
    account_id: String,
    cape_id: Option<String>,
) -> Result<Vec<Cape>, String> {
    crate::capes::set(&account_id, cape_id).await
}

#[tauri::command]
pub fn set_active_account(id: String) -> Result<Vec<Account>, String> {
    AccountManager::set_active_account(&id)
}

#[tauri::command]
pub fn update_account_skin(
    id: String,
    skin_url: Option<String>,
    skin_model: Option<String>,
) -> Result<Vec<Account>, String> {
    AccountManager::update_skin(&id, skin_url, skin_model)
}

#[tauri::command]
pub fn remove_account(id: String) -> Result<Vec<Account>, String> {
    AccountManager::remove_account(&id)
}

#[tauri::command]
pub fn open_launcher_folder() -> Result<(), String> {
    let dir = LauncherManager::get_root_dir()?;
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer").arg(dir).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(dir).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(dir).spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn open_instance_folder(instance_id: String) -> Result<(), String> {
    let dir = InstanceManager::get_instance_dir(&instance_id)?;
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("explorer").arg(dir).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(dir).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(dir).spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL no permitida".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}

#[tauri::command]
pub async fn launch_instance(app: AppHandle, instance_id: String) -> Result<String, String> {
    let instances = LauncherManager::load_instances()?;
    let target = instances
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or("La instancia seleccionada no existe")?;

    ensure_supported_loader(&target.loader)?;

    let loader = target.loader.to_ascii_lowercase();
    if loader == "forge" || loader == "neoforge" {
        let version = target.loader_version.clone().unwrap_or_default();
        let id = if loader == "forge" {
            format!("{}-forge-{}", target.mc_version, version)
        } else {
            format!("neoforge-{}", version)
        };
        let profile = LauncherManager::get_root_dir()?
            .join("versions")
            .join(&id)
            .join(format!("{id}.json"));
        if !profile.exists() {
            return Err(format!(
                "El perfil de {} no está instalado ({}). Crea la instancia desde Nueva Instancia para instalarlo.",
                target.loader, profile.display()
            ));
        }
    }

    GameEngine::launch_game_real(app, target).await
}

#[tauri::command]
pub fn stop_instance() -> Result<String, String> {
    GameEngine::kill_running_game()
}

#[tauri::command]
pub async fn search_modrinth(
    query: String,
    loader: Option<String>,
    mc_version: Option<String>,
    project_type: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    index: Option<String>,
) -> Result<ModrinthSearchResponse, String> {
    ModrinthClient::search_mods(
        &query,
        loader.as_deref(),
        mc_version.as_deref(),
        project_type.as_deref(),
        limit.unwrap_or(20),
        offset.unwrap_or(0),
        index.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn get_modrinth_versions(
    project_id: String,
    loader: Option<String>,
    mc_version: Option<String>,
) -> Result<Vec<ModrinthVersion>, String> {
    ModrinthClient::get_project_versions(&project_id, loader.as_deref(), mc_version.as_deref())
        .await
}

#[tauri::command]
pub async fn install_modrinth_mod(
    instance_id: String,
    download_url: String,
    filename: String,
) -> Result<ModFileInfo, String> {
    ModrinthClient::install_mod_file(&instance_id, &download_url, &filename).await
}

#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    path: String,
    custom_name: Option<String>,
) -> Result<Instance, String> {
    ModpackEngine::import_mrpack(&app, Path::new(&path), custom_name, None).await
}

#[tauri::command]
pub fn begin_modpack_upload(file_name: String) -> Result<String, String> {
    ModpackEngine::begin_upload(&file_name)
}

#[tauri::command]
pub fn append_modpack_chunk(temp_path: String, chunk_b64: String) -> Result<(), String> {
    ModpackEngine::append_upload_chunk(&temp_path, &chunk_b64)
}

#[tauri::command]
pub async fn finish_modpack_upload(
    app: AppHandle,
    temp_path: String,
    custom_name: Option<String>,
) -> Result<Instance, String> {
    ModpackEngine::finish_upload(&app, &temp_path, custom_name).await
}

#[tauri::command]
pub async fn import_mrpack_bytes(
    app: AppHandle,
    bytes: Vec<u8>,
    file_name: String,
    custom_name: Option<String>,
) -> Result<Instance, String> {
    ModpackEngine::import_mrpack_bytes(&app, &bytes, &file_name, custom_name, None).await
}

#[tauri::command]
pub async fn install_online_modpack(
    app: AppHandle,
    download_url: String,
    name: String,
    icon_url: Option<String>,
) -> Result<Instance, String> {
    ModpackEngine::install_online_modpack(&app, &download_url, Some(name), icon_url).await
}

#[tauri::command]
pub async fn export_instance(instance_id: String, format: String) -> Result<String, String> {
    crate::export::export(&instance_id, &format).await
}

#[tauri::command]
pub fn get_mod_icons(
    instance_id: String,
    filenames: Vec<String>,
    kind: Option<String>,
) -> Result<Vec<(String, Option<String>)>, String> {
    Ok(InstanceManager::mod_icons(
        &instance_id,
        &filenames,
        kind.as_deref().unwrap_or("mods"),
    ))
}

#[tauri::command]
pub fn duplicate_instance(id: String) -> Result<Instance, String> {
    InstanceManager::duplicate_instance(&id)
}
