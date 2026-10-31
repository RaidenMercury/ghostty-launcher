use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub last_played: Option<String>,
    pub play_time_minutes: u64,
    #[serde(default = "default_java_path")]
    pub java_path: String,
    #[serde(default)]
    pub custom_jvm_args: String,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub min_ram_mb: Option<u64>,
    #[serde(default)]
    pub max_ram_mb: Option<u64>,
    #[serde(default)]
    pub pre_launch_hook: Option<String>,
    #[serde(default)]
    pub post_exit_command: Option<String>,
    #[serde(default)]
    pub wrapper_command: Option<String>,
    #[serde(default)]
    pub resolution: Option< serde_json::Value >,
    #[serde(default)]
    pub server_auto_connect: Option< serde_json::Value >,
}

fn default_java_path() -> String {
    "java".to_string()
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherConfig {
    pub min_ram_mb: u64,
    pub max_ram_mb: u64,
    pub java_path: String,
    pub custom_jvm_args: String,
    pub theme: String,
    pub accent_color: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_true")]
    #[allow(non_snake_case)]
    pub enable_Animations: bool,
    #[serde(default = "default_ui_scale")]
    pub ui_scale: f32,
    #[serde(default = "default_zero")]
    pub max_concurrent_downloads: u32,
    #[serde(default = "default_zero")]
    pub bandwidth_limit_mbps: u32,
    #[serde(default)]
    pub close_on_launch: String,
    #[serde(default)]
    pub custom_instances_dir: Option<String>,
    #[serde(default = "default_true")]
    pub enable_discord_rpc: bool,
    #[serde(default = "default_rpc_details")]
    #[allow(non_snake_case)]
    pub discord_Rpc_details: String,
    #[serde(default = "default_rpc_state")]
    #[allow(non_snake_case)]
    pub discord_Rpc_state: String,
}

fn default_rpc_details() -> String {
    "Jugando en GhosttyLauncher".to_string()
}
fn default_rpc_state() -> String {
    "En el menú principal".to_string()
}

fn default_language() -> String {
    "es".to_string()
}
fn default_true() -> bool {
    true
}
fn default_ui_scale() -> f32 {
    1.0
}
fn default_zero() -> u32 {
    0
}

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            min_ram_mb: 1024,
            max_ram_mb: 4096,
            java_path: "java".to_string(),
            custom_jvm_args: "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC".to_string(),
            theme: "dark".to_string(),
            accent_color: "#FF6B00".to_string(),
            language: "es".to_string(),
            enable_Animations: true,
            ui_scale: 1.0,
            max_concurrent_downloads: 10,
            bandwidth_limit_mbps: 0,
            close_on_launch: "keep-open".to_string(),
            custom_instances_dir: None,
            enable_discord_rpc: true,
            discord_Rpc_details: default_rpc_details(),
            discord_Rpc_state: default_rpc_state(),
        }
    }
}

fn default_account_type() -> String {
    "Offline".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub uuid: String,
    #[serde(default = "default_account_type")]
    pub account_type: String,
    pub is_active: bool,
    pub skin_url: Option<String>,
    #[serde(default)]
    pub skin_model: Option<String>,
    #[serde(default)]
    pub access_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MojangManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModFileInfo {
    pub filename: String,
    pub enabled: bool,
    pub size: u64,
}
