use crate::launcher::LauncherManager;
use crate::models::{Instance, ModFileInfo};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use uuid::Uuid;

/// Forge y NeoForge no tienen instalador todavía: mejor un error claro que una
/// instancia que arranca vanilla y crashea (ver PLAN_REPARACION F2).
pub const SUPPORTED_LOADERS: [&str; 5] = ["vanilla", "fabric", "quilt", "forge", "neoforge"];

pub fn ensure_supported_loader(loader: &str) -> Result<(), String> {
    if SUPPORTED_LOADERS.contains(&loader.to_ascii_lowercase().as_str()) {
        Ok(())
    } else {
        Err(format!(
            "El loader '{}' aún no está soportado. Por ahora: vanilla, Fabric y Quilt.",
            loader
        ))
    }
}

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

    #[allow(clippy::too_many_arguments)]
    pub fn create_instance(
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
        ensure_supported_loader(&loader)?;

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
            custom_jvm_args: jvm_args.unwrap_or_default(),
            env_vars: HashMap::new(),
            min_ram_mb: memory_min_mb,
            max_ram_mb: memory_max_mb,
            pre_launch_hook: pre_launch_command,
            post_exit_command: None,
            wrapper_command: None,
            resolution: None,
            server_auto_connect: None,
            favorite: false,
            group: None,
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
                                icon: mod_icon(&entry.path()),
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
            icon: None,
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

/// Icono del mod dentro del jar (`icon.png`, `logo.png`, `pack.png`), como data URI.
fn mod_icon(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;

    let mut best: Option<(u8, String)> = None;
    for i in 0..archive.len() {
        let Ok(entry) = archive.by_index(i) else {
            continue;
        };
        let name = entry.name().to_string();
        let lower = name.to_lowercase();
        let rank = if lower == "icon.png" || lower == "pack.png" {
            0
        } else if lower.ends_with("/icon.png") {
            1
        } else if lower.ends_with("logo.png") {
            2
        } else {
            continue;
        };
        if best.as_ref().map(|(r, _)| rank < *r).unwrap_or(true) {
            best = Some((rank, name));
        }
    }

    let (_, name) = best?;
    let mut entry = archive.by_name(&name).ok()?;
    if entry.size() > 256 * 1024 {
        return None;
    }
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    std::io::Read::read_to_end(&mut entry, &mut bytes).ok()?;

    Some(format!("data:image/png;base64,{}", encode_base64(&bytes)))
}

fn encode_base64(data: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        out.push(TABLE[(b[0] >> 2) as usize] as char);
        out.push(TABLE[(((b[0] & 0x03) << 4) | (b[1] >> 4)) as usize] as char);
        out.push(if chunk.len() > 1 { TABLE[(((b[1] & 0x0f) << 2) | (b[2] >> 6)) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { TABLE[(b[2] & 0x3f) as usize] as char } else { '=' });
    }
    out
}
