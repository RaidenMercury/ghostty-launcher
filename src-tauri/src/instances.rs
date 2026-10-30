use crate::config::get_instances_dir;
use crate::models::{CreateInstanceRequest, Instance};
use std::fs;
use std::path::Path;

pub fn list_instances() -> Result<Vec<Instance>, String> {
    let dir = get_instances_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create instances dir: {}", e))?;
    }

    let mut instances = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read instances dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let json_path = path.join("instance.json");
            if json_path.exists() {
                if let Ok(content) = fs::read_to_string(&json_path) {
                    if let Ok(instance) = serde_json::from_str::<Instance>(&content) {
                        instances.push(instance);
                    }
                }
            }
        }
    }

    // Sort by last_played desc or name
    instances.sort_by(|a, b| b.last_played.cmp(&a.last_played));

    Ok(instances)
}

pub fn create_instance(req: CreateInstanceRequest) -> Result<Instance, String> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err("Instance name cannot be empty".to_string());
    }

    // Slugify name for directory id
    let id = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();
    let id = id.trim_matches('-').to_string();
    let id = if id.is_empty() { format!("instance-{}", uuid::Uuid::new_v4().simple()) } else { id };

    let instance_dir = get_instances_dir().join(&id);
    if instance_dir.exists() {
        return Err(format!("An instance with id '{}' already exists", id));
    }

    fs::create_dir_all(&instance_dir)
        .map_err(|e| format!("Failed to create instance directory: {}", e))?;
    fs::create_dir_all(instance_dir.join("mods"))
        .map_err(|e| format!("Failed to create mods directory: {}", e))?;
    fs::create_dir_all(instance_dir.join("resourcepacks"))
        .map_err(|e| format!("Failed to create resourcepacks directory: {}", e))?;
    fs::create_dir_all(instance_dir.join("config"))
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    let instance = Instance {
        id: id.clone(),
        name: name.to_string(),
        icon: "ghostty".to_string(),
        mc_version: req.mc_version,
        loader: req.loader,
        loader_version: None,
        memory_min_mb: req.memory_min_mb.unwrap_or(2048),
        memory_max_mb: req.memory_max_mb.unwrap_or(4096),
        java_path: None,
        jvm_args: None,
        total_playtime_secs: 0,
        last_played: None,
    };

    let json = serde_json::to_string_pretty(&instance)
        .map_err(|e| format!("Failed to serialize instance: {}", e))?;

    fs::write(instance_dir.join("instance.json"), json)
        .map_err(|e| format!("Failed to write instance.json: {}", e))?;

    Ok(instance)
}

pub fn update_instance(instance: Instance) -> Result<(), String> {
    let instance_dir = get_instances_dir().join(&instance.id);
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' not found", instance.id));
    }

    let json = serde_json::to_string_pretty(&instance)
        .map_err(|e| format!("Failed to serialize instance: {}", e))?;

    fs::write(instance_dir.join("instance.json"), json)
        .map_err(|e| format!("Failed to write instance.json: {}", e))?;

    Ok(())
}

pub fn delete_instance(instance_id: &str) -> Result<(), String> {
    let instance_dir = get_instances_dir().join(instance_id);
    if !instance_dir.exists() {
        return Err(format!("Instance '{}' not found", instance_id));
    }

    fs::remove_dir_all(&instance_dir)
        .map_err(|e| format!("Failed to remove instance directory: {}", e))?;

    Ok(())
}

pub fn export_instance_to_zip(instance_id: &str, target_path: &Path) -> Result<String, String> {
    let instance_dir = get_instances_dir().join(instance_id);
    if !instance_dir.exists() {
        return Err("Instance does not exist".to_string());
    }

    let file = fs::File::create(target_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for entry in walkdir::WalkDir::new(&instance_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.strip_prefix(&instance_dir).unwrap();

        if path.is_file() {
            let relative_name = name.to_str().unwrap().replace('\\', "/");
            zip.start_file(relative_name, options)
                .map_err(|e| format!("Failed to add file to zip: {}", e))?;
            let mut f = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
            std::io::copy(&mut f, &mut zip)
                .map_err(|e| format!("Failed to write file to zip: {}", e))?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}
