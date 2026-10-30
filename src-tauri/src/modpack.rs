use crate::config::{get_cache_dir, get_instances_dir};
use crate::instances::create_instance;
use crate::models::{CreateInstanceRequest, Instance};
use futures_util::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MrpackIndex {
    #[serde(rename = "formatVersion")]
    pub format_version: u32,
    pub game: String,
    #[serde(rename = "versionId")]
    pub version_id: String,
    pub name: String,
    pub summary: Option<String>,
    pub dependencies: HashMap<String, String>,
    pub files: Vec<MrpackFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MrpackFileEnv {
    pub client: Option<String>,
    pub server: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MrpackFile {
    pub path: String,
    pub hashes: HashMap<String, String>,
    pub env: Option<MrpackFileEnv>,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseforgeModLoader {
    pub id: String,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseforgeMinecraftMeta {
    pub version: String,
    #[serde(rename = "modLoaders")]
    pub mod_loaders: Vec<CurseforgeModLoader>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseforgeFileEntry {
    #[serde(rename = "projectID")]
    pub project_id: u64,
    #[serde(rename = "fileID")]
    pub file_id: u64,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseforgeManifest {
    pub minecraft: CurseforgeMinecraftMeta,
    pub name: String,
    pub version: String,
    pub author: Option<String>,
    pub files: Vec<CurseforgeFileEntry>,
    pub overrides: Option<String>,
}

pub async fn install_mrpack(
    archive_path: &Path,
    custom_name: Option<String>,
) -> Result<Instance, String> {
    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open .mrpack file: {}", e))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    // 1. Read modrinth.index.json
    let index: MrpackIndex = {
        let mut index_file = zip
            .by_name("modrinth.index.json")
            .map_err(|e| format!("modrinth.index.json not found in mrpack: {}", e))?;
        let mut content = String::new();
        index_file
            .read_to_string(&mut content)
            .map_err(|e| format!("Failed to read modrinth.index.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse modrinth.index.json: {}", e))?
    };

    // 2. Resolve Minecraft version and loader
    let mc_version = index
        .dependencies
        .get("minecraft")
        .cloned()
        .unwrap_or_else(|| "1.21.4".to_string());

    let loader = if index.dependencies.contains_key("fabric-loader") {
        "fabric"
    } else if index.dependencies.contains_key("neoforge") {
        "neoforge"
    } else if index.dependencies.contains_key("forge") {
        "forge"
    } else if index.dependencies.contains_key("quilt-loader") {
        "quilt"
    } else {
        "vanilla"
    };

    let instance_name = custom_name.unwrap_or(index.name);

    // 3. Create Instance
    let instance = create_instance(CreateInstanceRequest {
        name: instance_name,
        mc_version,
        loader: loader.to_string(),
        memory_min_mb: Some(2048),
        memory_max_mb: Some(4096),
        jvm_args: None,
        pre_launch_command: None,
    })?;

    let instance_dir = get_instances_dir().join(&instance.id);

    // 4. Extract Overrides
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        let rel_dest = if let Some(stripped) = entry_name.strip_prefix("overrides/") {
            Some(stripped)
        } else if let Some(stripped) = entry_name.strip_prefix("client-overrides/") {
            Some(stripped)
        } else {
            None
        };

        if let Some(dest_path) = rel_dest {
            if !dest_path.is_empty() {
                let target = instance_dir.join(dest_path);
                if entry.is_dir() {
                    let _ = fs::create_dir_all(&target);
                } else {
                    if let Some(parent) = target.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let mut outfile = fs::File::create(&target).map_err(|e| e.to_string())?;
                    std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // 5. Download Files
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let mut download_tasks = Vec::new();
    for file in index.files {
        // Skip server-only files
        if let Some(env) = &file.env {
            if env.client.as_deref() == Some("unsupported") {
                continue;
            }
        }

        if let Some(url) = file.downloads.first() {
            let target_path = instance_dir.join(&file.path);
            download_tasks.push((url.clone(), target_path));
        }
    }

    let stream = stream::iter(download_tasks).map(|(url, target)| {
        let client = client.clone();
        async move {
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = fs::write(target, bytes);
                    }
                }
            }
        }
    });

    stream.buffer_unordered(12).collect::<Vec<()>>().await;

    Ok(instance)
}

pub async fn install_curseforge_pack(
    archive_path: &Path,
    custom_name: Option<String>,
) -> Result<Instance, String> {
    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open CurseForge zip: {}", e))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let manifest: CurseforgeManifest = {
        let mut manifest_file = zip
            .by_name("manifest.json")
            .map_err(|e| format!("manifest.json not found in CurseForge zip: {}", e))?;
        let mut content = String::new();
        manifest_file
            .read_to_string(&mut content)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse manifest.json: {}", e))?
    };

    let mc_version = manifest.minecraft.version;
    let loader_str = manifest
        .minecraft
        .mod_loaders
        .iter()
        .find(|l| l.primary)
        .map(|l| l.id.as_str())
        .unwrap_or("forge");

    let loader = if loader_str.starts_with("fabric") {
        "fabric"
    } else if loader_str.starts_with("neoforge") {
        "neoforge"
    } else {
        "forge"
    };

    let instance_name = custom_name.unwrap_or(manifest.name);

    let instance = create_instance(CreateInstanceRequest {
        name: instance_name,
        mc_version,
        loader: loader.to_string(),
        memory_min_mb: Some(4096),
        memory_max_mb: Some(6144),
        jvm_args: None,
        pre_launch_command: None,
    })?;

    let instance_dir = get_instances_dir().join(&instance.id);
    let overrides_prefix = manifest.overrides.unwrap_or_else(|| "overrides".to_string());
    let prefix_with_slash = format!("{}/", overrides_prefix);

    // Extract Overrides
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        if let Some(dest_path) = entry_name.strip_prefix(&prefix_with_slash) {
            if !dest_path.is_empty() {
                let target = instance_dir.join(dest_path);
                if entry.is_dir() {
                    let _ = fs::create_dir_all(&target);
                } else {
                    if let Some(parent) = target.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let mut outfile = fs::File::create(&target).map_err(|e| e.to_string())?;
                    std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    Ok(instance)
}

pub async fn download_and_install_online_modpack(
    download_url: &str,
    name: &str,
) -> Result<Instance, String> {
    let temp_file = get_cache_dir().join(format!("pack-{}.tmp", uuid::Uuid::new_v4().simple()));

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let bytes = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Download error: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    fs::write(&temp_file, bytes).map_err(|e| format!("Temp file error: {}", e))?;

    // Check if mrpack or curseforge
    let is_mrpack = download_url.contains(".mrpack") || {
        let f = fs::File::open(&temp_file).ok();
        f.and_then(|file| zip::ZipArchive::new(file).ok())
            .map(|mut z| z.by_name("modrinth.index.json").is_ok())
            .unwrap_or(false)
    };

    let result = if is_mrpack {
        install_mrpack(&temp_file, Some(name.to_string())).await
    } else {
        install_curseforge_pack(&temp_file, Some(name.to_string())).await
    };

    let _ = fs::remove_file(temp_file);
    result
}
