use crate::launcher::LauncherManager;
use crate::models::{Instance, ModFileInfo};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub struct InstanceManager;

impl InstanceManager {
    pub fn get_instance_dir(instance_id: &str) -> Result<PathBuf, String> {
        let root = LauncherManager::get_root_dir()?;
        let dir = root.join("instances").join(instance_id);
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(dir)
    }

    pub fn get_mods_dir(instance_id: &str) -> Result<PathBuf, String> {
        let dir = Self::get_instance_dir(instance_id)?.join("mods");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        }
        Ok(dir)
    }

    pub fn create_instance(
        name: String,
        mc_version: String,
        loader: String,
        loader_version: Option<String>,
        icon: Option<String>,
    ) -> Result<Instance, String> {
        // Forge y NeoForge no tienen instalador todavía: mejor un error claro que una
        // instancia que arranca vanilla y crashea (ver PLAN_REPARACION F2).
        const SUPPORTED: [&str; 3] = ["vanilla", "fabric", "quilt"];
        if !SUPPORTED.contains(&loader.to_ascii_lowercase().as_str()) {
            return Err(format!(
                "El loader '{}' aún no está soportado. Por ahora: vanilla, Fabric y Quilt.",
                loader
            ));
        }

        let mut instances = LauncherManager::load_instances()?;
        let id = Uuid::new_v4().to_string();

        let new_instance = Instance {
            id: id.clone(),
            name,
            mc_version,
            loader,
            loader_version,
            icon,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_played: None,
            play_time_minutes: 0,
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
        };

        let inst_dir = Self::get_instance_dir(&id)?;
        for sub in ["mods", "config", "resourcepacks", "shaderpacks", "saves"] {
            fs::create_dir_all(inst_dir.join(sub)).map_err(|e| e.to_string())?;
        }

        instances.push(new_instance.clone());
        LauncherManager::save_instances(&instances)?;
        Ok(new_instance)
    }

    pub fn delete_instance(id: &str) -> Result<Vec<Instance>, String> {
        let mut instances = LauncherManager::load_instances()?;
        instances.retain(|i| i.id != id);
        LauncherManager::save_instances(&instances)?;

        let root = LauncherManager::get_root_dir()?;
        let dir = root.join("instances").join(id);
        if dir.exists() {
            let _ = fs::remove_dir_all(dir);
        }

        Ok(instances)
    }

    pub fn list_mods(instance_id: &str) -> Result<Vec<ModFileInfo>, String> {
        let mods_dir = Self::get_mods_dir(instance_id)?;
        let mut mods = Vec::new();

        if let Ok(entries) = fs::read_dir(mods_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        if fname.ends_with(".jar") || fname.ends_with(".jar.disabled") {
                            let enabled = fname.ends_with(".jar");
                            mods.push(ModFileInfo {
                                filename: fname,
                                enabled,
                                size: meta.len(),
                            });
                        }
                    }
                }
            }
        }

        mods.sort_by(|a, b| a.filename.to_lowercase().cmp(&b.filename.to_lowercase()));
        Ok(mods)
    }

    pub fn toggle_mod(instance_id: &str, filename: &str) -> Result<ModFileInfo, String> {
        let mods_dir = Self::get_mods_dir(instance_id)?;
        let old_path = mods_dir.join(filename);
        if !old_path.exists() {
            return Err("El archivo del mod no existe".to_string());
        }

        let new_filename = if filename.ends_with(".disabled") {
            filename.trim_end_matches(".disabled").to_string()
        } else {
            format!("{}.disabled", filename)
        };

        let new_path = mods_dir.join(&new_filename);
        fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
        let meta = fs::metadata(&new_path).map_err(|e| e.to_string())?;

        Ok(ModFileInfo {
            filename: new_filename.clone(),
            enabled: new_filename.ends_with(".jar"),
            size: meta.len(),
        })
    }

    pub fn delete_mod(instance_id: &str, filename: &str) -> Result<(), String> {
        let mods_dir = Self::get_mods_dir(instance_id)?;
        let path = mods_dir.join(filename);
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}
