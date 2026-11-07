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

pub fn is_valid_instance_id(id: &str) -> bool {
    let clean = id.trim();
    !clean.is_empty()
        && clean.len() <= 64
        && clean.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn safe_content_path(mods_dir: &Path, filename: &str) -> Result<PathBuf, String> {
    let clean = filename.trim();
    if clean.is_empty() || clean.contains('/') || clean.contains('\\') || clean.contains("..") {
        return Err("Nombre de archivo no válido o sospechoso".to_string());
    }
    let Some(file_name) = Path::new(clean).file_name().and_then(|f| f.to_str()) else {
        return Err("Nombre de archivo inválido".to_string());
    };
    if file_name != clean {
        return Err("Nombre de archivo no coincide con su nombre base".to_string());
    }
    let path = mods_dir.join(file_name);
    if !path.starts_with(mods_dir) {
        return Err("Ruta de archivo fuera del directorio de contenido".to_string());
    }
    Ok(path)
}

impl InstanceManager {
    pub fn get_instance_dir(instance_id: &str) -> Result<PathBuf, String> {
        if !is_valid_instance_id(instance_id) {
            return Err(format!("Identificador de instancia inválido: '{}'", instance_id));
        }
        let root = LauncherManager::get_root_dir()?;
        let instances_root = root.join("instances");
        let dir = instances_root.join(instance_id);
        if !dir.starts_with(&instances_root) {
            return Err("Ruta de instancia fuera de los límites permitidos".to_string());
        }
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

    pub fn mod_icons(instance_id: &str, filenames: &[String], kind: &str) -> Vec<(String, Option<String>)> {
        let Ok(mods_dir) = Self::content_dir(instance_id, kind) else {
            return Vec::new();
        };
        filenames
            .iter()
            .map(|name| (name.clone(), mod_icon(&mods_dir.join(name))))
            .collect()
    }

    pub fn duplicate_instance(id: &str) -> Result<Instance, String> {
        let mut instances = LauncherManager::load_instances()?;
        let source = instances
            .iter()
            .find(|i| i.id == id)
            .cloned()
            .ok_or("La instancia no existe")?;

        let copies = instances
            .iter()
            .filter(|i| i.name.starts_with(&format!("{} (copia", source.name)))
            .count();
        let new_id = Uuid::new_v4().to_string();
        let new_name = format!("{} (copia {})", source.name, copies + 2);

        let new_instance = Instance {
            id: new_id.clone(),
            name: new_name,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_played: None,
            play_time_minutes: 0,
            favorite: false,
            ..source
        };

        let src_dir = Self::get_instance_dir(id)?;
        let dst_dir = Self::get_instance_dir(&new_id)?;
        fs::create_dir_all(&dst_dir).map_err(|e| e.to_string())?;

        for entry in walkdir::WalkDir::new(&src_dir).into_iter().filter_map(Result::ok) {
            let rel = match entry.path().strip_prefix(&src_dir) {
                Ok(rel) => rel,
                Err(_) => continue,
            };
            let first = rel.components().next().and_then(|c| c.as_os_str().to_str());
            if matches!(first, Some("logs") | Some("crash-reports")) {
                continue;
            }
            if rel.file_name().and_then(|n| n.to_str()) == Some("session.lock") {
                continue;
            }
            let target = dst_dir.join(rel);
            if entry.file_type().is_dir() {
                fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
            }
        }

        instances.push(new_instance.clone());
        LauncherManager::save_instances(&instances)?;
        Ok(new_instance)
    }

    pub fn delete_instance(id: &str) -> Result<Vec<Instance>, String> {
        if !is_valid_instance_id(id) {
            return Err(format!("Identificador de instancia inválido: '{}'", id));
        }
        let mut instances = LauncherManager::load_instances()?;
        instances.retain(|i| i.id != id);
        LauncherManager::save_instances(&instances)?;

        let root = LauncherManager::get_root_dir()?;
        let instances_root = root.join("instances");
        let dir = instances_root.join(id);
        if dir.starts_with(&instances_root) && dir.exists() {
            let _ = fs::remove_dir_all(dir);
        }

        Ok(instances)
    }

    fn content_dir(instance_id: &str, kind: &str) -> Result<std::path::PathBuf, String> {
        let inst = Self::get_instance_dir(instance_id)?;
        let dir = inst.join(match kind {
            "resourcepacks" => "resourcepacks",
            "shaderpacks" => "shaderpacks",
            _ => "mods",
        });
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir)
    }

    pub fn list_content(instance_id: &str, kind: &str) -> Result<Vec<ModFileInfo>, String> {
        let mods_dir = Self::content_dir(instance_id, kind)?;
        let mut mods = Vec::new();

        if let Ok(entries) = fs::read_dir(mods_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        let fname = entry.file_name().to_string_lossy().to_string();
                        let is_jar = fname.ends_with(".jar") || fname.ends_with(".jar.disabled");
                        let is_pack = fname.ends_with(".zip") || fname.ends_with(".zip.disabled");
                        if is_jar || is_pack {
                            let enabled = !fname.ends_with(".disabled");
                            mods.push(ModFileInfo {
                                icon: None,
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

    pub fn toggle_content(instance_id: &str, filename: &str, kind: &str) -> Result<ModFileInfo, String> {
        let mods_dir = Self::content_dir(instance_id, kind)?;
        let old_path = safe_content_path(&mods_dir, filename)?;
        if !old_path.exists() {
            return Err("El archivo del mod no existe".to_string());
        }

        let new_filename = if filename.ends_with(".disabled") {
            filename.trim_end_matches(".disabled").to_string()
        } else {
            format!("{}.disabled", filename)
        };

        let new_path = safe_content_path(&mods_dir, &new_filename)?;
        fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
        let meta = fs::metadata(&new_path).map_err(|e| e.to_string())?;

        Ok(ModFileInfo {
            icon: None,
            filename: new_filename.clone(),
            enabled: !new_filename.ends_with(".disabled"),
            size: meta.len(),
        })
    }

    pub fn delete_content(instance_id: &str, filename: &str, kind: &str) -> Result<(), String> {
        let mods_dir = Self::content_dir(instance_id, kind)?;
        let path = safe_content_path(&mods_dir, filename)?;
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn import_local_content(
        instance_id: &str,
        paths: &[String],
    ) -> Result<Vec<crate::models::ImportedContentItem>, String> {
        let mut results = Vec::new();

        for raw_path in paths {
            let path = Path::new(raw_path);
            if !path.exists() {
                continue;
            }

            let file_name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };

            let lower_name = file_name.to_lowercase();
            let mut category = "mods";

            if lower_name.ends_with(".jar") {
                category = "mods";
            } else if lower_name.ends_with(".zip") {
                category = "resourcepacks";
                if let Ok(file) = fs::File::open(path) {
                    if let Ok(mut archive) = zip::ZipArchive::new(file) {
                        let mut has_shaders = false;
                        let mut has_pack_mcmeta = false;
                        let mut has_mod_meta = false;

                        for i in 0..archive.len().min(128) {
                            if let Ok(entry) = archive.by_index(i) {
                                let ename = entry.name().to_lowercase();
                                if ename == "pack.mcmeta" || ename.starts_with("assets/") {
                                    has_pack_mcmeta = true;
                                }
                                if ename.starts_with("shaders/") || ename.ends_with(".vsh") || ename.ends_with(".fsh") {
                                    has_shaders = true;
                                }
                                if ename == "fabric.mod.json" || ename.starts_with("meta-inf/mods.toml") || ename == "quilt.mod.json" {
                                    has_mod_meta = true;
                                }
                            }
                        }

                        if has_shaders {
                            category = "shaderpacks";
                        } else if has_mod_meta {
                            category = "mods";
                        } else if has_pack_mcmeta {
                            category = "resourcepacks";
                        }
                    }
                }
            } else if path.is_dir() {
                if path.join("shaders").exists() {
                    category = "shaderpacks";
                } else if path.join("pack.mcmeta").exists() {
                    category = "resourcepacks";
                }
            } else {
                continue;
            }

            let dest_dir = Self::content_dir(instance_id, category)?;
            let dest_path = dest_dir.join(&file_name);

            if path.is_dir() {
                copy_dir_recursive(path, &dest_path).map_err(|e| e.to_string())?;
                results.push(crate::models::ImportedContentItem {
                    filename: file_name,
                    category: category.to_string(),
                    target_path: dest_path.to_string_lossy().to_string(),
                    size: 0,
                });
            } else {
                fs::copy(path, &dest_path).map_err(|e| e.to_string())?;
                let size = dest_path.metadata().map(|m| m.len()).unwrap_or(0);
                results.push(crate::models::ImportedContentItem {
                    filename: file_name,
                    category: category.to_string(),
                    target_path: dest_path.to_string_lossy().to_string(),
                    size,
                });
            }
        }

        Ok(results)
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
    if entry.size() > 48 * 1024 {
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

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_instance_id_security() {
        assert!(is_valid_instance_id("550e8400-e29b-41d4-a716-446655440000"));
        assert!(is_valid_instance_id("my_instance-123"));
        assert!(!is_valid_instance_id(""));
        assert!(!is_valid_instance_id("../evil"));
        assert!(!is_valid_instance_id("inst/sub"));
        assert!(!is_valid_instance_id("inst\\sub"));
        assert!(!is_valid_instance_id("inst;calc"));
        assert!(!is_valid_instance_id("inst name"));
    }

    #[test]
    fn validates_safe_content_path_security() {
        let base = PathBuf::from("/mock/mods");
        assert!(safe_content_path(&base, "jei-1.21.jar").is_ok());
        assert!(safe_content_path(&base, "sodium.jar.disabled").is_ok());
        assert!(safe_content_path(&base, "../other.jar").is_err());
        assert!(safe_content_path(&base, "/etc/passwd").is_err());
        assert!(safe_content_path(&base, "sub/mod.jar").is_err());
        assert!(safe_content_path(&base, "sub\\mod.jar").is_err());
        assert!(safe_content_path(&base, "").is_err());
    }
}
