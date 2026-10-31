use crate::instances::InstanceManager;
use crate::launcher::LauncherManager;
use crate::models::Instance;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize)]
pub struct ModrinthIndex {
    #[serde(rename = "formatVersion", default)]
    pub format_version: u32,
    #[serde(default)]
    pub game: String,
    #[serde(rename = "versionId", default)]
    pub version_id: String,
    #[serde(default)]
    pub name: String,
    pub summary: Option<String>,
    #[serde(default)]
    pub files: Vec<ModpackFile>,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModpackFile {
    pub path: String,
    #[serde(default)]
    pub hashes: HashMap<String, String>,
    #[serde(default)]
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize", default)]
    pub file_size: u64,
}

#[derive(Clone, Serialize)]
pub struct ModpackProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
}

fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let mut lut = [255u8; 256];
    for (i, &b) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        .iter()
        .enumerate()
    {
        lut[b as usize] = i as u8;
    }

    let clean: Vec<u8> = input
        .bytes()
        .filter(|&b| !b.is_ascii_whitespace())
        .collect();
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);

    for chunk in clean.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let c0 = lut[chunk[0] as usize];
        let c1 = lut[chunk[1] as usize];
        if c0 == 255 || c1 == 255 {
            return Err("Base64 inválido".to_string());
        }
        out.push((c0 << 2) | (c1 >> 4));

        if chunk.len() > 2 && chunk[2] != b'=' {
            let c2 = lut[chunk[2] as usize];
            if c2 == 255 {
                return Err("Base64 inválido".to_string());
            }
            out.push(((c1 & 0x0F) << 4) | (c2 >> 2));

            if chunk.len() > 3 && chunk[3] != b'=' {
                let c3 = lut[chunk[3] as usize];
                if c3 == 255 {
                    return Err("Base64 inválido".to_string());
                }
                out.push(((c2 & 0x03) << 6) | c3);
            }
        }
    }

    Ok(out)
}

fn compute_file_sha1(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha1::new();
    let mut buf = [0u8; 32768];
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(format!("{:x}", hasher.finalize()))
}

pub struct ModpackEngine;

impl ModpackEngine {
    pub fn begin_upload(file_name: &str) -> Result<String, String> {
        let root = LauncherManager::get_root_dir()?;
        let cache_dir = root.join("caches");
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

        let ext = if file_name.to_lowercase().ends_with(".zip") {
            "zip"
        } else {
            "mrpack"
        };
        let temp_file = cache_dir.join(format!("upload_{}.{}", Uuid::new_v4(), ext));
        File::create(&temp_file).map_err(|e| e.to_string())?;
        Ok(temp_file.to_string_lossy().to_string())
    }

    pub fn append_upload_chunk(temp_path: &str, chunk_b64: &str) -> Result<(), String> {
        let decoded = decode_base64(chunk_b64)?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(temp_path)
            .map_err(|e| e.to_string())?;
        file.write_all(&decoded).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn finish_upload(
        app: &AppHandle,
        temp_path: &str,
        custom_name: Option<String>,
    ) -> Result<Instance, String> {
        let path_buf = PathBuf::from(temp_path);
        let mut resolved_icon: Option<String> = None;

        if let Some(sha1_hex) = compute_file_sha1(&path_buf) {
            if let Ok(client) = reqwest::Client::builder()
                .user_agent("GhosttyLauncher/0.1.0")
                .timeout(Duration::from_secs(5))
                .build()
            {
                let ver_url = format!("https://api.modrinth.com/v2/version_file/{}", sha1_hex);
                if let Ok(resp) = client.get(&ver_url).send().await {
                    if resp.status().is_success() {
                        if let Ok(ver_json) = resp.json::<Value>().await {
                            if let Some(proj_id) =
                                ver_json.get("project_id").and_then(|p| p.as_str())
                            {
                                let proj_url =
                                    format!("https://api.modrinth.com/v2/project/{}", proj_id);
                                if let Ok(p_resp) = client.get(&proj_url).send().await {
                                    if let Ok(p_json) = p_resp.json::<Value>().await {
                                        if let Some(ic) =
                                            p_json.get("icon_url").and_then(|u| u.as_str())
                                        {
                                            resolved_icon = Some(ic.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let res = Self::import_mrpack(app, &path_buf, custom_name, resolved_icon).await;
        let _ = fs::remove_file(&path_buf);
        res
    }

    pub async fn install_online_modpack(
        app: &AppHandle,
        download_url: &str,
        custom_name: Option<String>,
        custom_icon: Option<String>,
    ) -> Result<Instance, String> {
        let root = LauncherManager::get_root_dir()?;
        let cache_dir = root.join("caches");
        fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "modpack-progress",
            ModpackProgress {
                current: 1,
                total: 100,
                filename: "Descargando archivo .mrpack...".to_string(),
            },
        );

        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0 (contact@ghostty.dev)")
            .build()
            .map_err(|e| e.to_string())?;

        let mut res = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Error descargando .mrpack: {}", e))?;

        let temp_file = cache_dir.join(format!("online_{}.mrpack", Uuid::new_v4()));
        {
            let mut out = File::create(&temp_file).map_err(|e| e.to_string())?;
            while let Some(chunk) = res.chunk().await.map_err(|e| e.to_string())? {
                out.write_all(&chunk).map_err(|e| e.to_string())?;
            }
        }

        let result = Self::import_mrpack(app, &temp_file, custom_name, custom_icon).await;
        let _ = fs::remove_file(&temp_file);
        result
    }

    pub async fn import_mrpack_bytes(
        app: &AppHandle,
        bytes: &[u8],
        file_name: &str,
        custom_name: Option<String>,
        custom_icon: Option<String>,
    ) -> Result<Instance, String> {
        let temp_path = Self::begin_upload(file_name)?;
        fs::write(&temp_path, bytes).map_err(|e| e.to_string())?;
        let res = Self::import_mrpack(app, Path::new(&temp_path), custom_name, custom_icon).await;
        let _ = fs::remove_file(&temp_path);
        res
    }

    pub async fn import_mrpack(
        app: &AppHandle,
        mrpack_path: &Path,
        custom_name: Option<String>,
        custom_icon: Option<String>,
    ) -> Result<Instance, String> {
        let path_owned = mrpack_path.to_path_buf();
        let custom_name_clone = custom_name.clone();
        let custom_icon_clone = custom_icon.clone();

        let (instance, inst_dir, files_to_download) =
            tokio::task::spawn_blocking(move || -> Result<(Instance, PathBuf, Vec<ModpackFile>), String> {
                let file = File::open(&path_owned)
                    .map_err(|e| format!("No se pudo abrir el paquete: {}", e))?;
                let mut archive = ZipArchive::new(file)
                    .map_err(|e| format!("Archivo comprimido inválido o corrupto: {}", e))?;

                let mut modrinth_index: Option<ModrinthIndex> = None;
                let mut curse_manifest: Option<Value> = None;
                let mut embedded_icon: Option<String> = None;

                for i in 0..archive.len() {
                    if let Ok(mut entry) = archive.by_index(i) {
                        let lower = entry.name().to_lowercase();
                        if lower == "modrinth.index.json" || lower.ends_with("/modrinth.index.json") {
                            if entry.size() < 16 * 1024 * 1024 {
                                let mut s = String::new();
                                if entry.read_to_string(&mut s).is_ok() {
                                    modrinth_index = serde_json::from_str::<ModrinthIndex>(&s).ok();
                                }
                            }
                        } else if lower == "manifest.json" || lower.ends_with("/manifest.json") {
                            if entry.size() < 8 * 1024 * 1024 {
                                let mut s = String::new();
                                if entry.read_to_string(&mut s).is_ok() {
                                    curse_manifest = serde_json::from_str::<Value>(&s).ok();
                                }
                            }
                        } else if embedded_icon.is_none()
                            && (lower == "icon.png"
                                || lower == "pack.png"
                                || lower == "overrides/icon.png")
                            && entry.size() > 64
                            && entry.size() <= 98304
                        {
                            let mut buf = Vec::with_capacity(entry.size() as usize);
                            if entry.read_to_end(&mut buf).is_ok() {
                                embedded_icon = Some(format!(
                                    "data:image/png;base64,{}",
                                    encode_base64(&buf)
                                ));
                            }
                        }
                    }
                }

                let fallback_title = path_owned
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Modpack Importado")
                    .to_string();

                let mut pack_name = custom_name_clone.clone().unwrap_or(fallback_title);
                let mut mc_version = "1.21.4".to_string();
                let mut loader = "fabric".to_string();
                let mut loader_version: Option<String> = None;
                let mut files_to_download: Vec<ModpackFile> = Vec::new();

                if let Some(ref idx) = modrinth_index {
                    if custom_name_clone.is_none() && !idx.name.trim().is_empty() {
                        pack_name = if !idx.version_id.trim().is_empty()
                            && !idx
                                .name
                                .to_lowercase()
                                .contains(&idx.version_id.to_lowercase())
                        {
                            format!("{} ({})", idx.name.trim(), idx.version_id.trim())
                        } else {
                            idx.name.trim().to_string()
                        };
                    }
                    if let Some(mc) = idx.dependencies.get("minecraft") {
                        mc_version = mc.clone();
                    }
                    if let Some(v) = idx.dependencies.get("fabric-loader") {
                        loader = "fabric".to_string();
                        loader_version = Some(v.clone());
                    } else if let Some(v) = idx.dependencies.get("quilt-loader") {
                        loader = "quilt".to_string();
                        loader_version = Some(v.clone());
                    } else if let Some(v) = idx.dependencies.get("neoforge") {
                        loader = "neoforge".to_string();
                        loader_version = Some(v.clone());
                    } else if let Some(v) = idx.dependencies.get("forge") {
                        loader = "forge".to_string();
                        loader_version = Some(v.clone());
                    } else {
                        loader = "vanilla".to_string();
                    }
                    files_to_download = idx.files.clone();
                } else if let Some(ref cf) = curse_manifest {
                    if custom_name_clone.is_none() {
                        if let Some(n) = cf.get("name").and_then(|v| v.as_str()) {
                            if !n.trim().is_empty() {
                                pack_name = n.trim().to_string();
                            }
                        }
                    }
                    if let Some(mc) = cf
                        .get("minecraft")
                        .and_then(|m| m.get("version"))
                        .and_then(|v| v.as_str())
                    {
                        mc_version = mc.to_string();
                    }
                    if let Some(loaders) = cf
                        .get("minecraft")
                        .and_then(|m| m.get("modLoaders"))
                        .and_then(|l| l.as_array())
                    {
                        if let Some(first_id) = loaders
                            .first()
                            .and_then(|f| f.get("id"))
                            .and_then(|i| i.as_str())
                        {
                            let lower_id = first_id.to_lowercase();
                            if let Some(ver) = lower_id.strip_prefix("neoforge-") {
                                loader = "neoforge".to_string();
                                loader_version = Some(ver.to_string());
                            } else if let Some(ver) = lower_id.strip_prefix("forge-") {
                                loader = "forge".to_string();
                                loader_version = Some(ver.to_string());
                            } else if let Some(ver) = lower_id.strip_prefix("fabric-") {
                                loader = "fabric".to_string();
                                loader_version = Some(ver.to_string());
                            } else if let Some(ver) = lower_id.strip_prefix("quilt-") {
                                loader = "quilt".to_string();
                                loader_version = Some(ver.to_string());
                            }
                        }
                    }
                }

                if loader.eq_ignore_ascii_case("forge") || loader.eq_ignore_ascii_case("neoforge") {
                    return Err(format!(
                        "Este modpack requiere {} {} y ese loader todavía no está soportado.\
                         Se puede importar cuando llegue el instalador (F2 del plan).",
                        loader.to_uppercase(),
                        loader_version.clone().unwrap_or_default()
                    ));
                }

                let final_icon = custom_icon_clone
                    .or(embedded_icon)
                    .or_else(|| Some("minecraft".to_string()));

                let instance = InstanceManager::create_instance(
                    pack_name,
                    mc_version,
                    loader,
                    loader_version,
                    final_icon,
                    None,
                    None,
                    None,
                    None,
                )?;

                let inst_dir = InstanceManager::get_instance_dir(&instance.id)?;

                for i in 0..archive.len() {
                    let mut zip_entry = match archive.by_index(i) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };
                    if zip_entry.is_dir() {
                        continue;
                    }
                    let entry_name = zip_entry.name().replace('\\', "/");

                    let relative = if let Some(r) = entry_name.strip_prefix("overrides/") {
                        Some(r.to_string())
                    } else if let Some(r) = entry_name.strip_prefix("client-overrides/") {
                        Some(r.to_string())
                    } else if let Some(idx) = entry_name.find("/overrides/") {
                        Some(entry_name[idx + "/overrides/".len()..].to_string())
                    } else if entry_name.starts_with("mods/")
                        || entry_name.starts_with("config/")
                        || entry_name.starts_with("resourcepacks/")
                        || entry_name.starts_with("shaderpacks/")
                        || entry_name == "options.txt"
                        || entry_name == "servers.dat"
                    {
                        Some(entry_name)
                    } else {
                        None
                    };

                    if let Some(rel_path) = relative {
                        let clean_rel = rel_path.trim_start_matches('/');
                        if clean_rel.is_empty() || clean_rel.contains("..") {
                            continue;
                        }
                        let out_path = inst_dir.join(clean_rel);
                        if let Some(parent) = out_path.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        if let Ok(mut out_file) = File::create(&out_path) {
                            let _ = io::copy(&mut zip_entry, &mut out_file);
                        }
                    }
                }

                Ok((instance, inst_dir, files_to_download))
            })
            .await
            .map_err(|e| e.to_string())??;

        if !files_to_download.is_empty() {
            let client = reqwest::Client::builder()
                .user_agent("GhosttyLauncher/0.1.0 (contact@ghostty.dev)")
                .timeout(Duration::from_secs(45))
                .build()
                .map_err(|e| e.to_string())?;

            let total = files_to_download.len();
            let chunk_size = 6;
            let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));

            for (chunk_idx, chunk) in files_to_download.chunks(chunk_size).enumerate() {
                let mut tasks = Vec::new();
                for (offset_in_chunk, mod_file) in chunk.iter().enumerate() {
                    let current_num = chunk_idx * chunk_size + offset_in_chunk + 1;
                    let rel_clean = mod_file.path.replace('\\', "/");
                    if rel_clean.contains("..") {
                        continue;
                    }
                    let target_path = inst_dir.join(&rel_clean);
                    if let Some(parent) = target_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    let short_name = Path::new(&rel_clean)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&rel_clean)
                        .to_string();

                    let should_emit = if current_num == 1 || current_num == total {
                        true
                    } else if let Ok(mut guard) = last_emit.lock() {
                        if guard.elapsed() >= Duration::from_millis(110) {
                            *guard = Instant::now();
                            true
                        } else {
                            false
                        }
                    } else {
                        false
                    };

                    if should_emit {
                        let _ = app.emit(
                            "modpack-progress",
                            ModpackProgress {
                                current: current_num,
                                total,
                                filename: short_name,
                            },
                        );
                    }

                    if let Some(url) = mod_file.downloads.first().cloned() {
                        let c = client.clone();
                        let expected_size = mod_file.file_size;
                        tasks.push(tokio::spawn(async move {
                            if expected_size > 0 {
                                if let Ok(meta) = fs::metadata(&target_path) {
                                    if meta.len() == expected_size {
                                        return;
                                    }
                                }
                            }
                            if let Ok(mut res) = c.get(&url).send().await {
                                if res.status().is_success() {
                                    if let Ok(mut out_file) = File::create(&target_path) {
                                        while let Ok(Some(chunk_bytes)) = res.chunk().await {
                                            if out_file.write_all(&chunk_bytes).is_err() {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }));
                    }
                }
                for t in tasks {
                    let _ = t.await;
                }
            }
        }

        Ok(instance)
    }
}
