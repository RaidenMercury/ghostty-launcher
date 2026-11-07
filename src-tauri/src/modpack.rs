use crate::instances::InstanceManager;
use crate::launcher::LauncherManager;
use crate::models::Instance;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use sha2::{Sha256, Sha512};
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

pub fn compute_file_sha1(path: &Path) -> Option<String> {
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

pub fn compute_file_sha512(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha512::new();
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

pub fn compute_file_sha256(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut hasher = Sha256::new();
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

pub fn find_expected_hash<'a>(hashes: &'a HashMap<String, String>, algo: &str) -> Option<&'a String> {
    hashes.iter().find_map(|(k, v)| {
        let norm = k.to_lowercase().replace(['-', '_'], "");
        if norm == algo {
            Some(v)
        } else {
            None
        }
    })
}

#[derive(Debug)]
struct ModpackScan {
    pack_name: String,
    mc_version: String,
    loader: String,
    loader_version: Option<String>,
    embedded_icon: Option<String>,
    files_to_download: Vec<ModpackFile>,
    overrides_dir: String,
}

fn scan_archive(path: &Path, custom_name: Option<String>) -> Result<ModpackScan, String> {
    let file = File::open(path).map_err(|e| format!("No se pudo abrir el paquete: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Archivo comprimido inválido o corrupto: {}", e))?;

    if archive.len() > 25000 {
        return Err("El modpack contiene demasiadas entradas (máximo 25000)".to_string());
    }

    let mut modrinth_index: Option<ModrinthIndex> = None;
    let mut curse_manifest: Option<Value> = None;
    let mut embedded_icon: Option<String> = None;

    for i in 0..archive.len() {
        if let Ok(mut entry) = archive.by_index(i) {
            let lower = entry.name().to_lowercase().replace('\\', "/");
            let depth = lower.split('/').count();
            if (lower == "modrinth.index.json" || (depth <= 2 && lower.ends_with("/modrinth.index.json")))
                && entry.size() < 16 * 1024 * 1024
            {
                let mut s = String::new();
                if entry.by_ref().take(16 * 1024 * 1024).read_to_string(&mut s).is_ok() {
                    modrinth_index = serde_json::from_str::<ModrinthIndex>(&s).ok();
                }
            } else if (lower == "manifest.json" || (depth <= 2 && lower.ends_with("/manifest.json")))
                && entry.size() < 8 * 1024 * 1024
            {
                let mut s = String::new();
                if entry.by_ref().take(8 * 1024 * 1024).read_to_string(&mut s).is_ok() {
                    curse_manifest = serde_json::from_str::<Value>(&s).ok();
                }
            } else if embedded_icon.is_none()
                && (lower == "icon.png"
                    || lower == "pack.png"
                    || lower == "overrides/icon.png")
                && entry.size() > 64
                && entry.size() <= 98304
            {
                let mut buf = Vec::new();
                if entry.by_ref().take(98304).read_to_end(&mut buf).is_ok() {
                    embedded_icon = Some(format!(
                        "data:image/png;base64,{}",
                        encode_base64(&buf)
                    ));
                }
            }
        }
        if (modrinth_index.is_some() || curse_manifest.is_some()) && embedded_icon.is_some() {
            break;
        }
    }

    if modrinth_index.is_none() && curse_manifest.is_none() {
        return Err("No se encontró ningún manifiesto válido (modrinth.index.json o manifest.json) en el archivo.".to_string());
    }

    let fallback_title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Modpack Importado")
        .to_string();

    let mut pack_name = custom_name.clone().unwrap_or(fallback_title);
    let mut mc_version = "1.21.4".to_string();
    let mut loader = "fabric".to_string();
    let mut loader_version: Option<String> = None;
    let mut files_to_download: Vec<ModpackFile> = Vec::new();
    let mut overrides_dir = "overrides".to_string();

    if let Some(ref idx) = modrinth_index {
        if custom_name.is_none() && !idx.name.trim().is_empty() {
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
        if custom_name.is_none() {
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
        if let Some(ovr) = cf.get("overrides").and_then(|v| v.as_str()) {
            if !ovr.trim().is_empty() {
                overrides_dir = ovr.trim().to_string();
            }
        }
        if let Some(loaders) = cf
            .get("minecraft")
            .and_then(|m| m.get("modLoaders"))
            .and_then(|l| l.as_array())
        {
            let primary_loader = loaders
                .iter()
                .find(|l| l.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
                .or_else(|| loaders.first());

            if let Some(first_id) = primary_loader
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

    Ok(ModpackScan {
        pack_name,
        mc_version,
        loader,
        loader_version,
        embedded_icon,
        files_to_download,
        overrides_dir,
    })
}

pub fn is_safe_rel_path(path: &Path) -> bool {
    let mut depth: usize = 0;
    for comp in path.components() {
        match comp {
            std::path::Component::Normal(os_str) => {
                let s = os_str.to_string_lossy();
                if s.is_empty() || s.contains(':') || s.ends_with('.') || s.ends_with(' ') {
                    return false;
                }
                let upper = s.to_ascii_uppercase();
                let stem = upper.split('.').next().unwrap_or(&upper);
                if matches!(
                    stem,
                    "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
                        | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
                        | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
                ) {
                    return false;
                }
                depth += 1;
            }
            _ => return false,
        }
    }
    depth > 0
}

fn extract_overrides(path: &Path, inst_dir: &Path, overrides_dir: &str) -> Result<(), String> {
    let file = File::open(path).map_err(|e| format!("No se pudo abrir el archivo para extracción: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Archivo zip inválido: {}", e))?;

    if archive.len() > 25000 {
        return Err("El modpack contiene demasiadas entradas (máximo 25000)".to_string());
    }

    let overrides_prefix = format!("{}/", overrides_dir.trim_end_matches('/'));
    const MAX_TOTAL_BYTES: u64 = 4 * 1024 * 1024 * 1024; // 4 GB
    const MAX_FILE_BYTES: u64 = 1024 * 1024 * 1024; // 1 GB
    let mut total_extracted: u64 = 0;

    for i in 0..archive.len() {
        let mut zip_entry = match archive.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };
        if zip_entry.is_dir() {
            continue;
        }

        let entry_name = zip_entry.name().replace('\\', "/");

        let relative = if let Some(r) = entry_name.strip_prefix(&overrides_prefix) {
            Some(r.to_string())
        } else if let Some(r) = entry_name.strip_prefix("client-overrides/") {
            Some(r.to_string())
        } else if let Some(idx) = entry_name.find(&format!("/{}", overrides_prefix)) {
            Some(entry_name[idx + overrides_prefix.len() + 1..].to_string())
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

        if let Some(rel_path_str) = relative {
            let clean_rel = rel_path_str.trim_start_matches('/');
            let rel_path = Path::new(clean_rel);
            if !is_safe_rel_path(rel_path) {
                continue;
            }

            let out_path = inst_dir.join(rel_path);
            if !out_path.starts_with(inst_dir) {
                continue;
            }

            let remaining_budget = MAX_TOTAL_BYTES.saturating_sub(total_extracted);
            if remaining_budget == 0 {
                return Err("El contenido total descomprimido del modpack excede el límite de 4 GB".to_string());
            }
            let file_budget = MAX_FILE_BYTES.min(remaining_budget);

            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Error creando directorio {:?}: {}", parent, e))?;
            }
            let mut out_file = File::create(&out_path)
                .map_err(|e| format!("Error creando archivo {:?}: {}", out_path, e))?;

            let mut limited_reader = zip_entry.by_ref().take(file_budget + 1);
            let bytes_copied = io::copy(&mut limited_reader, &mut out_file)
                .map_err(|e| {
                    let _ = fs::remove_file(&out_path);
                    format!("Error extrayendo archivo {:?}: {}", out_path, e)
                })?;

            if bytes_copied > file_budget {
                let _ = fs::remove_file(&out_path);
                return Err(format!("Extracción de {:?} excedió el límite permitido", out_path));
            }
            total_extracted = total_extracted.saturating_add(bytes_copied);
        }
    }
    Ok(())
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

    pub fn validate_cache_temp_path(temp_path: &str) -> Result<PathBuf, String> {
        let clean = temp_path.trim();
        if clean.is_empty() {
            return Err("Ruta de archivo temporal vacía".to_string());
        }
        let root = LauncherManager::get_root_dir()?;
        let cache_dir = root.join("caches");
        let path = PathBuf::from(clean);

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "Nombre de archivo temporal inválido".to_string())?;

        if !file_name.starts_with("upload_") || (!file_name.ends_with(".mrpack") && !file_name.ends_with(".zip")) {
            return Err("Nombre de archivo temporal no reconocido".to_string());
        }

        let expected = cache_dir.join(file_name);
        if path != expected {
            return Err("Ruta de archivo temporal fuera de la caché permitida".to_string());
        }

        Ok(expected)
    }

    pub fn append_upload_chunk(temp_path: &str, chunk_b64: &str) -> Result<(), String> {
        let valid_path = Self::validate_cache_temp_path(temp_path)?;
        let decoded = decode_base64(chunk_b64)?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&valid_path)
            .map_err(|e| e.to_string())?;
        file.write_all(&decoded).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn finish_upload(
        app: &AppHandle,
        temp_path: &str,
        custom_name: Option<String>,
    ) -> Result<Instance, String> {
        let path_buf = Self::validate_cache_temp_path(temp_path)?;
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

        let scan = tokio::task::spawn_blocking(move || {
            scan_archive(&path_owned, custom_name_clone)
        })
        .await
        .map_err(|e| e.to_string())??;

        let mut loader_version = scan.loader_version;
        let loader_lower = scan.loader.to_ascii_lowercase();

        if loader_lower == "forge" || loader_lower == "neoforge" {
            let _ = app.emit(
                "modpack-progress",
                ModpackProgress {
                    current: 1,
                    total: 100,
                    filename: format!(
                        "Instalando {} {}...",
                        loader_lower.to_uppercase(),
                        loader_version.as_deref().unwrap_or("latest")
                    ),
                },
            );

            let id = crate::forge::ForgeInstaller::install(
                &scan.mc_version,
                &loader_lower,
                loader_version.as_deref(),
            )
            .await
            .map_err(|e| format!("Error instalando {}: {}", loader_lower.to_uppercase(), e))?;

            loader_version = Some(if loader_lower == "forge" {
                let prefix = format!("{}-forge-", scan.mc_version);
                id.strip_prefix(&prefix).unwrap_or(&id).to_string()
            } else {
                id.strip_prefix("neoforge-").unwrap_or(&id).to_string()
            });
        }

        let final_icon = custom_icon
            .or(scan.embedded_icon)
            .or_else(|| Some("minecraft".to_string()));

        let pack_name = scan.pack_name.clone();
        let mc_ver = scan.mc_version.clone();
        let loader_clone = scan.loader.clone();
        let l_ver = loader_version.clone();
        let final_icon_clone = final_icon.clone();

        let (instance, inst_dir) = tokio::task::spawn_blocking(move || -> Result<(Instance, PathBuf), String> {
            let inst = InstanceManager::create_instance(
                pack_name,
                mc_ver,
                loader_clone,
                l_ver,
                final_icon_clone,
                None,
                None,
                None,
                None,
            )?;
            let dir = match InstanceManager::get_instance_dir(&inst.id) {
                Ok(d) => d,
                Err(e) => {
                    let _ = InstanceManager::delete_instance(&inst.id);
                    return Err(e);
                }
            };
            Ok((inst, dir))
        })
        .await
        .map_err(|e| e.to_string())??;

        let path_for_extract = mrpack_path.to_path_buf();
        let inst_dir_clone = inst_dir.clone();
        let ovr_dir = scan.overrides_dir.clone();
        let extract_res = tokio::task::spawn_blocking(move || {
            extract_overrides(&path_for_extract, &inst_dir_clone, &ovr_dir)
        })
        .await
        .map_err(|e| e.to_string());

        if let Err(e) = extract_res.and_then(|r| r) {
            let _ = InstanceManager::delete_instance(&instance.id);
            return Err(format!("Fallo extrayendo archivos del modpack: {}", e));
        }

        if !scan.files_to_download.is_empty() {
            let client = reqwest::Client::builder()
                .user_agent("GhosttyLauncher/0.1.0 (contact@ghostty.dev)")
                .timeout(Duration::from_secs(45))
                .build()
                .map_err(|e| e.to_string())?;

            let total = scan.files_to_download.len();
            let chunk_size = 6;
            let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));

            for (chunk_idx, chunk) in scan.files_to_download.chunks(chunk_size).enumerate() {
                let mut tasks = Vec::new();
                for (offset_in_chunk, mod_file) in chunk.iter().enumerate() {
                    let current_num = chunk_idx * chunk_size + offset_in_chunk + 1;
                    let rel_clean = mod_file.path.replace('\\', "/");
                    let clean_rel = rel_clean.trim_start_matches('/');
                    let rel_path = Path::new(clean_rel);
                    if !is_safe_rel_path(rel_path) {
                        continue;
                    }

                    let target_path = inst_dir.join(rel_path);
                    if !target_path.starts_with(&inst_dir) {
                        continue;
                    }

                    if let Some(parent) = target_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    let short_name = rel_path
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(clean_rel)
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
                        let expected_hashes = mod_file.hashes.clone();
                        let target_path_clone = target_path.clone();
                        tasks.push(tokio::spawn(async move {
                            if target_path_clone.exists() {
                                let mut valid = false;
                                if let Some(sha512) = find_expected_hash(&expected_hashes, "sha512") {
                                    if let Some(actual) = compute_file_sha512(&target_path_clone) {
                                        if actual.eq_ignore_ascii_case(sha512) {
                                            valid = true;
                                        }
                                    }
                                } else if let Some(sha256) = find_expected_hash(&expected_hashes, "sha256") {
                                    if let Some(actual) = compute_file_sha256(&target_path_clone) {
                                        if actual.eq_ignore_ascii_case(sha256) {
                                            valid = true;
                                        }
                                    }
                                } else if let Some(sha1) = find_expected_hash(&expected_hashes, "sha1") {
                                    if let Some(actual) = compute_file_sha1(&target_path_clone) {
                                        if actual.eq_ignore_ascii_case(sha1) {
                                            valid = true;
                                        }
                                    }
                                } else if expected_size > 0 {
                                    if let Ok(meta) = fs::metadata(&target_path_clone) {
                                        let diff = (meta.len() as i64 - expected_size as i64).abs() as u64;
                                        if meta.len() > 0 && (diff <= 8192 || (diff as f64 / expected_size as f64) <= 0.05) {
                                            valid = true;
                                        }
                                    }
                                }
                                if valid {
                                    return Ok(());
                                }
                            }

                            let mut res = c.get(&url).send().await.map_err(|e| e.to_string())?;
                            if !res.status().is_success() {
                                return Err(format!("HTTP {} al descargar {}", res.status(), url));
                            }

                            let part_path = target_path_clone.with_extension(format!("part.{}", Uuid::new_v4()));
                            let write_res = async {
                                let mut out_file = File::create(&part_path).map_err(|e| e.to_string())?;
                                while let Some(chunk_bytes) = res.chunk().await.map_err(|e| e.to_string())? {
                                    out_file.write_all(&chunk_bytes).map_err(|e| e.to_string())?;
                                }
                                out_file.flush().map_err(|e| e.to_string())?;
                                Ok::<(), String>(())
                            }
                            .await;

                            if let Err(e) = write_res {
                                let _ = fs::remove_file(&part_path);
                                return Err(e);
                            }

                            // Si se especifican hashes criptográficos (SHA-512, SHA-256 o SHA-1), verificamos la integridad con ellos.
                            // Si el hash coincide, aceptamos el archivo aunque haya una leve discrepancia de tamaño en metadatos del CDN.
                            // Solo si NO se proporcionan hashes recurrimos a la comprobación de tamaño con tolerancia razonable.
                            if let Some(sha512) = find_expected_hash(&expected_hashes, "sha512") {
                                let actual = compute_file_sha512(&part_path)
                                    .ok_or_else(|| {
                                        let _ = fs::remove_file(&part_path);
                                        format!("No se pudo calcular hash SHA-512 para {}", url)
                                    })?;
                                if !actual.eq_ignore_ascii_case(sha512) {
                                    let _ = fs::remove_file(&part_path);
                                    return Err(format!("Integridad fallida (SHA-512 erróneo) para {}", url));
                                }
                            } else if let Some(sha256) = find_expected_hash(&expected_hashes, "sha256") {
                                let actual = compute_file_sha256(&part_path)
                                    .ok_or_else(|| {
                                        let _ = fs::remove_file(&part_path);
                                        format!("No se pudo calcular hash SHA-256 para {}", url)
                                    })?;
                                if !actual.eq_ignore_ascii_case(sha256) {
                                    let _ = fs::remove_file(&part_path);
                                    return Err(format!("Integridad fallida (SHA-256 erróneo) para {}", url));
                                }
                            } else if let Some(sha1) = find_expected_hash(&expected_hashes, "sha1") {
                                let actual = compute_file_sha1(&part_path)
                                    .ok_or_else(|| {
                                        let _ = fs::remove_file(&part_path);
                                        format!("No se pudo calcular hash SHA-1 para {}", url)
                                    })?;
                                if !actual.eq_ignore_ascii_case(sha1) {
                                    let _ = fs::remove_file(&part_path);
                                    return Err(format!("Integridad fallida (SHA-1 erróneo) para {}", url));
                                }
                            } else if expected_size > 0 {
                                let meta = fs::metadata(&part_path).map_err(|e| {
                                    let _ = fs::remove_file(&part_path);
                                    format!("No se pudo verificar tamaño de {}: {}", url, e)
                                })?;
                                let diff = (meta.len() as i64 - expected_size as i64).abs() as u64;
                                // Solo fallar si está vacío o si la discrepancia supera tanto 8KB como el 5% del archivo esperado
                                if meta.len() == 0 || (diff > 8192 && (diff as f64 / expected_size as f64) > 0.05) {
                                    let _ = fs::remove_file(&part_path);
                                    return Err(format!(
                                        "Tamaño de descarga inconsistente para {}: esperado {}, recibido {}",
                                        url, expected_size, meta.len()
                                    ));
                                }
                            }

                            fs::rename(&part_path, &target_path_clone).map_err(|e| {
                                let _ = fs::remove_file(&part_path);
                                format!("Error guardando archivo {}: {}", target_path_clone.display(), e)
                            })?;

                            Ok(())
                        }));
                    }
                }

                let mut first_error: Option<String> = None;
                for t in &mut tasks {
                    if first_error.is_some() {
                        t.abort();
                    }
                    match t.await {
                        Ok(Ok(())) => {}
                        Ok(Err(e)) => {
                            if first_error.is_none() {
                                first_error = Some(e);
                            }
                        }
                        Err(join_err) => {
                            if first_error.is_none() && !join_err.is_cancelled() {
                                first_error = Some(format!("Error en tarea de descarga: {}", join_err));
                            }
                        }
                    }
                }

                if let Some(err) = first_error {
                    let _ = InstanceManager::delete_instance(&instance.id);
                    return Err(format!("Error descargando mods del modpack: {}", err));
                }
            }
        }

        Ok(instance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn scans_modrinth_forge_pack() {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            zip.start_file("modrinth.index.json", SimpleFileOptions::default()).unwrap();
            zip.write_all(br#"{
                "formatVersion": 1,
                "game": "minecraft",
                "versionId": "1.0.0",
                "name": "Forge Test Pack",
                "dependencies": {
                    "minecraft": "1.20.1",
                    "forge": "47.2.0"
                },
                "files": []
            }"#).unwrap();
            zip.finish().unwrap();
        }

        let temp_dir = std::env::temp_dir();
        let test_zip_path = temp_dir.join(format!("test_modpack_{}.zip", uuid::Uuid::new_v4()));
        std::fs::write(&test_zip_path, &buf).unwrap();

        let scan = scan_archive(&test_zip_path, None).expect("debería escanear correctamente");
        assert_eq!(scan.pack_name, "Forge Test Pack (1.0.0)");
        assert_eq!(scan.mc_version, "1.20.1");
        assert_eq!(scan.loader, "forge");
        assert_eq!(scan.loader_version, Some("47.2.0".to_string()));

        let _ = std::fs::remove_file(test_zip_path);
    }

    #[test]
    fn scans_curseforge_neoforge_pack() {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
            zip.start_file("manifest.json", SimpleFileOptions::default()).unwrap();
            zip.write_all(br#"{
                "name": "NeoForge Test Pack",
                "version": "2.0.0",
                "minecraft": {
                    "version": "1.21.1",
                    "modLoaders": [
                        { "id": "neoforge-21.1.50", "primary": true }
                    ]
                },
                "files": []
            }"#).unwrap();
            zip.finish().unwrap();
        }

        let temp_dir = std::env::temp_dir();
        let test_zip_path = temp_dir.join(format!("test_curse_{}.zip", uuid::Uuid::new_v4()));
        std::fs::write(&test_zip_path, &buf).unwrap();

        let scan = scan_archive(&test_zip_path, None).expect("debería escanear correctamente");
        assert_eq!(scan.pack_name, "NeoForge Test Pack");
        assert_eq!(scan.mc_version, "1.21.1");
        assert_eq!(scan.loader, "neoforge");
        assert_eq!(scan.loader_version, Some("21.1.50".to_string()));

        let _ = std::fs::remove_file(test_zip_path);
    }

    #[test]
    fn validates_safe_rel_paths() {
        assert!(is_safe_rel_path(Path::new("mods/jei-1.20.1.jar")));
        assert!(is_safe_rel_path(Path::new("config/fancymenu/options.txt")));
        assert!(is_safe_rel_path(Path::new("options.txt")));

        // Rejections: Parent traversal, absolute root, prefixes
        assert!(!is_safe_rel_path(Path::new("../secret.txt")));
        assert!(!is_safe_rel_path(Path::new("mods/../../secret.txt")));
        assert!(!is_safe_rel_path(Path::new("/etc/passwd")));

        // Windows ADS and trailing space/dot
        assert!(!is_safe_rel_path(Path::new("mods/file.txt:evil.exe")));
        assert!(!is_safe_rel_path(Path::new("mods/evil. ")));
        assert!(!is_safe_rel_path(Path::new("mods/evil..")));

        // Reserved Windows names
        assert!(!is_safe_rel_path(Path::new("nul")));
        assert!(!is_safe_rel_path(Path::new("con.txt")));
        assert!(!is_safe_rel_path(Path::new("mods/aux.jar")));
    }
}
