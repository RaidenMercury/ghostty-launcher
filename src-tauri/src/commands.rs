use crate::accounts;
use crate::instances;
use crate::launcher;
use crate::models::{
    Account, CreateInstanceRequest, Instance, ModrinthSearchResult, ModrinthVersion, MojangManifest,
    SystemJavaInfo,
};
use crate::modrinth;
use crate::versions;
use std::path::PathBuf;

#[tauri::command]
pub fn get_accounts() -> Result<Vec<Account>, String> {
    accounts::load_accounts()
}

#[tauri::command]
pub fn add_offline_account(username: String) -> Result<Account, String> {
    accounts::add_offline_account(&username)
}

#[tauri::command]
pub fn set_active_account(account_id: String) -> Result<(), String> {
    accounts::set_active_account(&account_id)
}

#[tauri::command]
pub fn delete_account(account_id: String) -> Result<(), String> {
    accounts::delete_account(&account_id)
}

#[tauri::command]
pub fn get_instances() -> Result<Vec<Instance>, String> {
    instances::list_instances()
}

#[tauri::command]
pub fn create_instance(request: CreateInstanceRequest) -> Result<Instance, String> {
    instances::create_instance(request)
}

#[tauri::command]
pub fn update_instance(instance: Instance) -> Result<(), String> {
    instances::update_instance(instance)
}

#[tauri::command]
pub fn delete_instance(instance_id: String) -> Result<(), String> {
    instances::delete_instance(&instance_id)
}

#[tauri::command]
pub fn export_instance(instance_id: String, target_path: String) -> Result<String, String> {
    instances::export_instance_to_zip(&instance_id, &PathBuf::from(target_path))
}

#[tauri::command]
pub async fn get_mojang_manifest() -> Result<MojangManifest, String> {
    match versions::get_mojang_manifest().await {
        Ok(m) => Ok(m),
        Err(_) => Ok(versions::get_fallback_manifest()),
    }
}

#[tauri::command]
pub async fn get_fabric_loaders(mc_version: String) -> Result<Vec<String>, String> {
    versions::get_fabric_loaders_for_mc(&mc_version).await
}

#[tauri::command]
pub async fn search_modrinth(
    query: String,
    loader: Option<String>,
    game_version: Option<String>,
    project_type: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<ModrinthSearchResult, String> {
    modrinth::search_modrinth(
        &query,
        loader.as_deref(),
        game_version.as_deref(),
        &project_type,
        limit.unwrap_or(20),
        offset.unwrap_or(0),
    )
    .await
}

#[tauri::command]
pub async fn get_modrinth_versions(
    project_id: String,
    loader: Option<String>,
    game_version: Option<String>,
) -> Result<Vec<ModrinthVersion>, String> {
    modrinth::get_project_versions(&project_id, loader.as_deref(), game_version.as_deref()).await
}

#[tauri::command]
pub async fn install_modrinth_mod(
    instance_id: String,
    download_url: String,
    filename: String,
) -> Result<String, String> {
    modrinth::download_and_install_mod(&instance_id, &download_url, &filename).await
}

#[tauri::command]
pub fn detect_java() -> Vec<SystemJavaInfo> {
    launcher::detect_java_installations()
}

#[tauri::command]
pub fn get_instance_mods(instance_id: String) -> Result<Vec<launcher::ModFileInfo>, String> {
    launcher::list_instance_mods(&instance_id)
}

#[tauri::command]
pub fn toggle_instance_mod(instance_id: String, filename: String) -> Result<bool, String> {
    launcher::toggle_mod(&instance_id, &filename)
}

#[tauri::command]
pub fn launch_game(mut instance: Instance, username: String, uuid: String) -> Result<String, String> {
    launcher::launch_instance(&mut instance, &username, &uuid)
}
