use crate::models::{Instance, LauncherConfig};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

pub struct LauncherManager;

impl LauncherManager {
    pub fn get_root_dir() -> Result<PathBuf, String> {
        let base_dir = dirs::data_local_dir()
            .or_else(dirs::home_dir)
            .ok_or("No se pudo determinar el directorio base del sistema")?;
        let data_dir = base_dir.join("GhosttyLauncher");
        if !data_dir.exists() {
            fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        }
        Ok(data_dir)
    }

    pub fn ensure_structure() -> Result<(), String> {
        let root = Self::get_root_dir()?;
        let subdirs = ["instances", "assets", "libraries", "runtimes", "versions", "caches"];
        for dir in subdirs {
            let p = root.join(dir);
            if !p.exists() {
                fs::create_dir_all(&p).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub fn get_config_path() -> Result<PathBuf, String> {
        Ok(Self::get_root_dir()?.join("config.json"))
    }

    pub fn load_config() -> Result<LauncherConfig, String> {
        Self::ensure_structure()?;
        let path = Self::get_config_path()?;
        if !path.exists() {
            let default_cfg = LauncherConfig::default();
            Self::save_config(&default_cfg)?;
            return Ok(default_cfg);
        }

        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let cfg: LauncherConfig = serde_json::from_str(&content).unwrap_or_default();
        Ok(cfg)
    }

    pub fn save_config(config: &LauncherConfig) -> Result<(), String> {
        let path = Self::get_config_path()?;
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_instances_file_path() -> Result<PathBuf, String> {
        Ok(Self::get_root_dir()?.join("instances.json"))
    }

    pub fn load_instances() -> Result<Vec<Instance>, String> {
        Self::ensure_structure()?;
        let path = Self::get_instances_file_path()?;
        if !path.exists() {
            let demo_instances = vec![
                Instance {
                    id: "vanilla-latest".to_string(),
                    name: "Vanilla Survival".to_string(),
                    mc_version: "1.21.4".to_string(),
                    loader: "vanilla".to_string(),
                    loader_version: None,
                    icon: Some("grass".to_string()),
                    created_at: chrono::Utc::now().to_rfc3339(),
                    last_played: None,
                    play_time_minutes: 120,
                    java_path: "java".to_string(),
                    custom_jvm_args: String::new(),
                    env_vars: HashMap::new(),
                    min_ram_mb: None,
                    max_ram_mb: None,
                    pre_launch_hook: None,
                    post_exit_command: None,
                    wrapper_command: None,
                    resolution: None,
                    server_auto_connect: None,
                },
                Instance {
                    id: "fabric-sodium".to_string(),
                    name: "Fabric Optimizado".to_string(),
                    mc_version: "1.20.4".to_string(),
                    loader: "fabric".to_string(),
                    loader_version: Some("0.16.9".to_string()),
                    icon: Some("fabric".to_string()),
                    created_at: chrono::Utc::now().to_rfc3339(),
                    last_played: None,
                    play_time_minutes: 340,
                    java_path: "java".to_string(),
                    custom_jvm_args: String::new(),
                    env_vars: HashMap::new(),
                    min_ram_mb: None,
                    max_ram_mb: None,
                    pre_launch_hook: None,
                    post_exit_command: None,
                    wrapper_command: None,
                    resolution: None,
                    server_auto_connect: None,
                },
            ];
            Self::save_instances(&demo_instances)?;
            for inst in &demo_instances {
                let inst_dir = Self::get_root_dir()?
                    .join("instances")
                    .join(&inst.id)
                    .join("mods");
                let _ = fs::create_dir_all(inst_dir);
            }
            return Ok(demo_instances);
        }

        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let instances: Vec<Instance> = serde_json::from_str(&content).unwrap_or_default();
        Ok(instances)
    }

    pub fn save_instances(instances: &[Instance]) -> Result<(), String> {
        let path = Self::get_instances_file_path()?;
        let content = serde_json::to_string_pretty(instances).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}
