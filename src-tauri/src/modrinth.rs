use crate::instances::InstanceManager;
use crate::launcher::LauncherManager;
use crate::models::ModFileInfo;
use crate::modpack::{compute_file_sha1, compute_file_sha512, is_safe_rel_path};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use tokio::sync::Mutex as TokioMutex;
use uuid::Uuid;
use zip::ZipArchive;

static INSTANCE_LOCKS: OnceLock<StdMutex<HashMap<String, Arc<TokioMutex<()>>>>> = OnceLock::new();

fn get_instance_lock(instance_id: &str) -> Arc<TokioMutex<()>> {
    let registry = INSTANCE_LOCKS.get_or_init(|| StdMutex::new(HashMap::new()));
    let mut map = registry.lock().unwrap();
    map.entry(instance_id.to_string())
        .or_insert_with(|| Arc::new(TokioMutex::new(())))
        .clone()
}

const MAX_MOD_FILE_SIZE: u64 = 350 * 1024 * 1024; // 350 MB
const MAX_METADATA_SIZE: u64 = 512 * 1024; // 512 KB
const MAX_DEPENDENCY_ITEMS: usize = 25;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthSearchResponse {
    pub hits: Vec<ModrinthSearchHit>,
    pub offset: u32,
    pub limit: u32,
    pub total_hits: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthSearchHit {
    pub project_id: String,
    pub project_type: String,
    pub slug: String,
    pub author: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub display_categories: Option<Vec<String>>,
    pub versions: Vec<String>,
    pub downloads: u64,
    pub follows: u64,
    pub icon_url: Option<String>,
    pub date_created: String,
    pub date_modified: String,
    pub latest_version: Option<String>,
    pub license: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthDependency {
    pub version_id: Option<String>,
    pub project_id: Option<String>,
    pub file_name: Option<String>,
    pub dependency_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
    #[serde(default)]
    pub hashes: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthVersion {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModrinthFile>,
    #[serde(default)]
    pub dependencies: Vec<ModrinthDependency>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthProject {
    pub id: String,
    pub slug: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct InstalledModsManifest {
    #[serde(default)]
    pub mods: HashMap<String, InstalledModEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct InstalledModEntry {
    pub filename: String,
    pub version_id: Option<String>,
}

pub struct ModrinthClient;

fn url_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn validate_modrinth_url(url: &str) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("La URL de descarga debe usar HTTPS seguro".to_string());
    }
    let lower = url.to_lowercase();
    let is_trusted_cdn = lower.starts_with("https://cdn.modrinth.com/")
        || lower.starts_with("https://edge.modrinth.com/")
        || lower.starts_with("https://modrinth.com/");
    if !is_trusted_cdn {
        return Err("Dominio no permitido: solo se admiten servidores CDN oficiales de Modrinth".to_string());
    }
    Ok(())
}

fn extract_mod_ids_from_jar(path: &Path) -> Vec<String> {
    let mut ids = Vec::new();
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return ids,
    };
    let mut archive = match ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return ids,
    };

    if let Ok(mut entry) = archive.by_name("fabric.mod.json") {
        let mut s = String::new();
        if entry.by_ref().take(MAX_METADATA_SIZE).read_to_string(&mut s).is_ok() {
            if let Ok(v) = serde_json::from_str::<Value>(&s) {
                if let Some(id) = v.get("id").and_then(|i| i.as_str()) {
                    ids.push(id.to_string());
                }
                if let Some(provides) = v.get("provides").and_then(|p| p.as_array()) {
                    for p in provides {
                        if let Some(s) = p.as_str() {
                            let clean = s.trim();
                            if !clean.is_empty() {
                                ids.push(clean.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(mut entry) = archive.by_name("quilt.mod.json") {
        let mut s = String::new();
        if entry.by_ref().take(MAX_METADATA_SIZE).read_to_string(&mut s).is_ok() {
            if let Ok(v) = serde_json::from_str::<Value>(&s) {
                if let Some(ql) = v.get("quilt_loader") {
                    if let Some(id) = ql.get("id").and_then(|i| i.as_str()) {
                        ids.push(id.to_string());
                    }
                    if let Some(provides) = ql.get("provides").and_then(|p| p.as_array()) {
                        for p in provides {
                            if let Some(s) = p.as_str() {
                                let clean = s.trim();
                                if !clean.is_empty() {
                                    ids.push(clean.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(mut entry) = archive.by_name("mcmod.info") {
        let mut s = String::new();
        if entry.by_ref().take(MAX_METADATA_SIZE).read_to_string(&mut s).is_ok() {
            if let Ok(v) = serde_json::from_str::<Value>(&s) {
                let list = if let Some(arr) = v.as_array() {
                    Some(arr)
                } else {
                    v.get("modList").and_then(|m| m.as_array())
                };
                if let Some(arr) = list {
                    for item in arr {
                        if let Some(mid) = item.get("modid").and_then(|m| m.as_str()) {
                            let clean = mid.trim();
                            if !clean.is_empty() {
                                ids.push(clean.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    for name in &["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
        if let Ok(mut entry) = archive.by_name(name) {
            let mut s = String::new();
            if entry.by_ref().take(MAX_METADATA_SIZE).read_to_string(&mut s).is_ok() {
                let mut in_mods = false;
                for line in s.lines() {
                    let trim = line.trim();
                    let clean_line = if let Some(idx) = trim.find('#') {
                        &trim[..idx]
                    } else {
                        trim
                    }.trim();
                    if clean_line.starts_with('[') {
                        if clean_line.starts_with("[[mods]]") || clean_line.starts_with("[mods]") {
                            in_mods = true;
                        } else {
                            in_mods = false;
                        }
                    } else if in_mods && clean_line.starts_with("modId") {
                        if let Some(val) = clean_line.split('=').nth(1) {
                            let clean = val.trim().trim_matches('"').trim_matches('\'').trim();
                            if !clean.is_empty() {
                                ids.push(clean.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    ids.sort();
    ids.dedup();
    ids
}

fn validate_version_compatibility(
    ver: &ModrinthVersion,
    loader: &str,
    mc_version: &str,
) -> Result<(), String> {
    if !mc_version.is_empty() && mc_version != "all" {
        if !ver.game_versions.iter().any(|v| v == mc_version) {
            return Err(format!(
                "La versión {} no es compatible con Minecraft {}",
                ver.version_number, mc_version
            ));
        }
    }
    if !loader.is_empty() && loader != "vanilla" && loader != "all" {
        if !ver.loaders.iter().any(|l| l.eq_ignore_ascii_case(loader)) {
            return Err(format!(
                "La versión {} no es compatible con el cargador {}",
                ver.version_number, loader
            ));
        }
    }
    Ok(())
}

fn safe_replace_file(src: &Path, dest: &Path) -> Result<(), std::io::Error> {
    if dest.exists() {
        let bak = dest.with_extension(format!("bak.{}", Uuid::new_v4()));
        fs::rename(dest, &bak)?;
        if let Err(e) = fs::rename(src, dest) {
            let _ = fs::rename(&bak, dest);
            return Err(e);
        }
        let _ = fs::remove_file(bak);
        Ok(())
    } else {
        fs::rename(src, dest)
    }
}

fn load_and_prune_manifest(mods_dir: &Path) -> (InstalledModsManifest, HashMap<String, InstalledModEntry>) {
    let manifest_path = mods_dir.join(".ghostty-mods.json");
    let mut manifest: InstalledModsManifest = fs::read_to_string(&manifest_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();

    manifest.mods.retain(|_, entry| {
        let p = Path::new(&entry.filename);
        is_safe_rel_path(p) && mods_dir.join(p).is_file()
    });

    let mut seen_files: HashMap<String, String> = HashMap::new();
    let mut duplicates = Vec::new();
    for (pid, entry) in &manifest.mods {
        if let Some(prev_pid) = seen_files.insert(entry.filename.clone(), pid.clone()) {
            duplicates.push(prev_pid);
        }
    }
    for dup in duplicates {
        manifest.mods.remove(&dup);
    }

    let manifest_mods = manifest.mods.clone();
    (manifest, manifest_mods)
}

fn collect_installed_identifiers(
    mods_dir: &Path,
) -> (
    HashSet<String>,
    HashMap<String, String>,
    HashMap<String, InstalledModEntry>,
) {
    let mut installed_project_ids = HashSet::new();
    let mut installed_mod_map = HashMap::new();

    let (_manifest, manifest_mods) = load_and_prune_manifest(mods_dir);
    for proj_id in manifest_mods.keys() {
        installed_project_ids.insert(proj_id.clone());
    }

    if let Ok(entries) = fs::read_dir(mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".jar") || name.ends_with(".jar.disabled") {
                    for mid in extract_mod_ids_from_jar(&path) {
                        installed_mod_map.insert(mid, name.clone());
                    }
                }
            }
        }
    }

    (installed_project_ids, installed_mod_map, manifest_mods)
}

impl ModrinthClient {
    fn get_http_client() -> Result<reqwest::Client, String> {
        reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0 (github.com/ghostty-launcher)")
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 3 {
                    attempt.error("Demasiadas redirecciones")
                } else {
                    let next_url = attempt.url().as_str();
                    if validate_modrinth_url(next_url).is_ok() {
                        attempt.follow()
                    } else {
                        attempt.error("Redirección a host no confiable rechazada")
                    }
                }
            }))
            .build()
            .map_err(|e| e.to_string())
    }

    pub async fn search_mods(
        query: &str,
        loader: Option<&str>,
        mc_version: Option<&str>,
        project_type: Option<&str>,
        limit: u32,
        offset: u32,
        index: Option<&str>,
    ) -> Result<ModrinthSearchResponse, String> {
        let client = Self::get_http_client()?;

        let p_type = project_type.unwrap_or("mod");
        let mut facets = vec![vec![format!("project_type:{}", p_type)]];

        if let Some(l) = loader {
            if !l.is_empty() && l != "vanilla" && l != "all" && (p_type == "mod" || p_type == "modpack") {
                facets.push(vec![format!("categories:{}", l.to_lowercase())]);
            }
        }
        if let Some(v) = mc_version {
            if !v.is_empty() && v != "all" {
                facets.push(vec![format!("versions:{}", v)]);
            }
        }

        let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;
        let sort_index = index.unwrap_or("downloads");

        let url = format!(
            "https://api.modrinth.com/v2/search?query={}&facets={}&limit={}&offset={}&index={}",
            url_encode(query),
            url_encode(&facets_json),
            limit,
            offset,
            url_encode(sort_index)
        );

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Error conectando a Modrinth: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Modrinth API devolvió estado: {}", res.status()));
        }

        let data: ModrinthSearchResponse = res
            .json()
            .await
            .map_err(|e| format!("Error parseando respuesta de Modrinth: {}", e))?;

        Ok(data)
    }

    pub async fn get_project_versions(
        project_id: &str,
        loader: Option<&str>,
        mc_version: Option<&str>,
    ) -> Result<Vec<ModrinthVersion>, String> {
        let client = Self::get_http_client()?;
        let mut url = format!("https://api.modrinth.com/v2/project/{}/version", url_encode(project_id));

        let mut params = Vec::new();
        if let Some(l) = loader {
            if !l.is_empty() && l != "vanilla" {
                let loaders_json = serde_json::to_string(&vec![l.to_lowercase()]).unwrap();
                params.push(format!("loaders={}", url_encode(&loaders_json)));
            }
        }
        if let Some(v) = mc_version {
            if !v.is_empty() {
                let vers_json = serde_json::to_string(&vec![v]).unwrap();
                params.push(format!("game_versions={}", url_encode(&vers_json)));
            }
        }

        if !params.is_empty() {
            url = format!("{}?{}", url, params.join("&"));
        }

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Error obteniendo versiones de Modrinth: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Modrinth API versiones devolvió estado: {}", res.status()));
        }

        let versions: Vec<ModrinthVersion> = res
            .json()
            .await
            .map_err(|e| format!("Error leyendo versiones: {}", e))?;

        Ok(versions)
    }

    pub async fn get_version(version_id: &str) -> Result<ModrinthVersion, String> {
        let client = Self::get_http_client()?;
        let url = format!("https://api.modrinth.com/v2/version/{}", url_encode(version_id));
        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Error consultando versión {}: {}", version_id, e))?;

        if !res.status().is_success() {
            return Err(format!("Modrinth API versión {} devolvió estado: {}", version_id, res.status()));
        }

        let ver: ModrinthVersion = res
            .json()
            .await
            .map_err(|e| format!("Error parseando versión de Modrinth: {}", e))?;

        Ok(ver)
    }

    async fn download_file_to(
        client: &reqwest::Client,
        url: &str,
        dest_path: &Path,
        expected_size: u64,
        expected_hashes: &HashMap<String, String>,
    ) -> Result<u64, String> {
        validate_modrinth_url(url)?;

        let mut res = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Fallo al descargar {}: {}", url, e))?;

        if !res.status().is_success() {
            return Err(format!("HTTP {} al descargar {}", res.status(), url));
        }

        let part_path = dest_path.with_extension(format!("part.{}", Uuid::new_v4()));
        let mut out_file = File::create(&part_path).map_err(|e| e.to_string())?;

        let has_hash = expected_hashes.contains_key("sha512") || expected_hashes.contains_key("sha1");
        let mut downloaded_bytes = 0u64;
        let size_limit = if expected_size > 0 && !has_hash {
            expected_size
        } else if expected_size > 0 {
            expected_size.saturating_add(2 * 1024 * 1024)
        } else {
            MAX_MOD_FILE_SIZE
        };

        while let Some(chunk_bytes) = res.chunk().await.map_err(|e| e.to_string())? {
            downloaded_bytes = downloaded_bytes.saturating_add(chunk_bytes.len() as u64);
            if downloaded_bytes > size_limit || downloaded_bytes > MAX_MOD_FILE_SIZE {
                let _ = fs::remove_file(&part_path);
                return Err(format!("Descarga excedió el límite de tamaño permitido para {}", url));
            }
            out_file.write_all(&chunk_bytes).map_err(|e| e.to_string())?;
        }
        out_file.flush().map_err(|e| e.to_string())?;

        if let Some(sha512) = expected_hashes.get("sha512") {
            let actual = compute_file_sha512(&part_path).ok_or_else(|| {
                let _ = fs::remove_file(&part_path);
                format!("No se pudo calcular hash SHA-512 para {}", url)
            })?;
            if !actual.eq_ignore_ascii_case(sha512) {
                let _ = fs::remove_file(&part_path);
                return Err(format!("Integridad fallida SHA-512 para {}", url));
            }
        } else if let Some(sha1) = expected_hashes.get("sha1") {
            let actual = compute_file_sha1(&part_path).ok_or_else(|| {
                let _ = fs::remove_file(&part_path);
                format!("No se pudo calcular hash SHA-1 para {}", url)
            })?;
            if !actual.eq_ignore_ascii_case(sha1) {
                let _ = fs::remove_file(&part_path);
                return Err(format!("Integridad fallida SHA-1 para {}", url));
            }
        } else if expected_size > 0 {
            if downloaded_bytes != expected_size {
                let _ = fs::remove_file(&part_path);
                return Err(format!(
                    "Tamaño inconsistente para {}: esperado {}, recibido {}",
                    url, expected_size, downloaded_bytes
                ));
            }
        } else {
            let _ = fs::remove_file(&part_path);
            return Err(format!("Metadatos de integridad ausentes: se requiere SHA-512 o SHA-1 para {}", url));
        }

        fs::rename(&part_path, dest_path).map_err(|e| {
            let _ = fs::remove_file(&part_path);
            format!("Error guardando archivo {}: {}", dest_path.display(), e)
        })?;

        Ok(downloaded_bytes)
    }

    pub async fn install_mod_file(
        instance_id: &str,
        download_url: &str,
        filename: &str,
        version_id: Option<&str>,
    ) -> Result<ModFileInfo, String> {
        let clean_filename = filename.trim();
        let rel_path = Path::new(clean_filename);
        if !is_safe_rel_path(rel_path) {
            return Err(format!("Nombre de archivo inválido o peligroso: {}", filename));
        }

        let instance_lock = get_instance_lock(instance_id);
        let _guard = instance_lock.lock().await;

        let instances = LauncherManager::load_instances()?;
        let instance = instances
            .iter()
            .find(|i| i.id == instance_id)
            .ok_or_else(|| format!("Estancia con ID {} no encontrada", instance_id))?;

        let loader = instance.loader.to_lowercase();
        let mc_version = instance.mc_version.clone();

        let client = Self::get_http_client()?;
        let mods_dir = InstanceManager::get_mods_dir(instance_id)?;
        let staging_dir = mods_dir.join(format!(".staging_{}", Uuid::new_v4()));
        fs::create_dir_all(&staging_dir).map_err(|e| e.to_string())?;

        let (mut installed_project_ids, installed_mod_map, manifest_mods) =
            collect_installed_identifiers(&mods_dir);

        let resolved_vid = version_id.map(String::from).or_else(|| {
            let parts: Vec<&str> = download_url.split("/versions/").collect();
            if parts.len() > 1 {
                parts[1].split('/').next().map(String::from)
            } else {
                None
            }
        });

        let mut root_hashes = HashMap::new();
        let mut root_size = 0u64;
        let mut root_project_id: Option<String> = None;
        let mut dependencies_to_fetch: Vec<ModrinthDependency> = Vec::new();

        if let Some(ref vid) = resolved_vid {
            let ver = Self::get_version(vid).await.map_err(|e| {
                let _ = fs::remove_dir_all(&staging_dir);
                format!("Fallo consultando versión raíz {}: {}", vid, e)
            })?;

            validate_version_compatibility(&ver, &loader, &mc_version).map_err(|e| {
                let _ = fs::remove_dir_all(&staging_dir);
                e
            })?;

            root_project_id = Some(ver.project_id.clone());
            installed_project_ids.insert(ver.project_id.clone());

            let primary_file = ver
                .files
                .iter()
                .find(|f| f.filename == clean_filename)
                .or_else(|| ver.files.iter().find(|f| f.primary))
                .or_else(|| ver.files.first())
                .ok_or_else(|| {
                    let _ = fs::remove_dir_all(&staging_dir);
                    format!("No se encontraron archivos en la versión {}", vid)
                })?;

            root_hashes = primary_file.hashes.clone();
            root_size = primary_file.size;

            for dep in ver.dependencies {
                if dep.dependency_type == "required" {
                    dependencies_to_fetch.push(dep);
                }
            }
        }

        let root_existing_path = mods_dir.join(clean_filename);
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.eq_ignore_ascii_case(clean_filename) && name != clean_filename {
                    let is_own_old_file = root_project_id
                        .as_ref()
                        .and_then(|r_pid| manifest_mods.get(r_pid).map(|e| e.filename == name))
                        .unwrap_or(false);
                    if !is_own_old_file {
                        let _ = fs::remove_dir_all(&staging_dir);
                        return Err(format!(
                            "Colisión de nombres de archivo case-insensitive: '{}' colisiona con '{}' existente en disco",
                            clean_filename, name
                        ));
                    }
                }
            }
        }

        if root_existing_path.exists() {
            let existing_owners: Vec<&String> = manifest_mods
                .iter()
                .filter(|(_, entry)| entry.filename == clean_filename)
                .map(|(pid, _)| pid)
                .collect();

            if !existing_owners.is_empty() {
                if let Some(ref r_pid) = root_project_id {
                    if existing_owners.len() > 1 || existing_owners[0] != r_pid {
                        let _ = fs::remove_dir_all(&staging_dir);
                        return Err(format!(
                            "Colisión de nombres de archivo: '{}' ya pertenece a otro proyecto mod instalado ({:?})",
                            clean_filename, existing_owners
                        ));
                    }
                } else {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Colisión de nombres de archivo: '{}' ya pertenece a un mod registrado en el manifiesto",
                        clean_filename
                    ));
                }
            } else {
                let mut matches = false;
                if let Some(sha512) = root_hashes.get("sha512") {
                    if let Some(actual) = compute_file_sha512(&root_existing_path) {
                        if actual.eq_ignore_ascii_case(sha512) {
                            matches = true;
                        }
                    }
                } else if let Some(sha1) = root_hashes.get("sha1") {
                    if let Some(actual) = compute_file_sha1(&root_existing_path) {
                        if actual.eq_ignore_ascii_case(sha1) {
                            matches = true;
                        }
                    }
                }
                if !matches {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Colisión de nombres de archivo: '{}' ya existe en mods y no coincide con el mod a instalar",
                        clean_filename
                    ));
                }
            }
        }

        let mut staged_filenames: HashSet<String> = HashSet::new();
        staged_filenames.insert(clean_filename.to_lowercase());

        let mut files_to_download: Vec<(String, String, ModrinthFile)> = Vec::new();
        let mut queue: VecDeque<ModrinthDependency> = VecDeque::from(dependencies_to_fetch);
        let mut visited_projects: HashMap<String, String> = HashMap::new();
        if let (Some(ref r_pid), Some(ref r_vid)) = (&root_project_id, &resolved_vid) {
            visited_projects.insert(r_pid.clone(), r_vid.clone());
        }

        let mut installed_records: Vec<(String, String, Option<String>)> = Vec::new();
        if let Some(r_pid) = root_project_id.clone() {
            installed_records.push((r_pid, clean_filename.to_string(), resolved_vid.clone()));
        }

        let mut items_processed = 0;
        while let Some(dep) = queue.pop_front() {
            items_processed += 1;
            if items_processed > MAX_DEPENDENCY_ITEMS {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!(
                    "Se excedió el límite máximo de dependencias recursivas ({})",
                    MAX_DEPENDENCY_ITEMS
                ));
            }

            if dep.dependency_type != "required" {
                continue;
            }

            let pid_opt = dep.project_id.clone();
            if let Some(ref pid) = pid_opt {
                if let Some(selected_vid) = visited_projects.get(pid) {
                    if let Some(ref req_vid) = dep.version_id {
                        if selected_vid != req_vid {
                            let _ = fs::remove_dir_all(&staging_dir);
                            return Err(format!(
                                "Conflicto de versiones: el proyecto {} requiere la versión {}, pero ya se seleccionó la versión {}",
                                pid, req_vid, selected_vid
                            ));
                        }
                    }
                    continue;
                }
            }

            let dep_ver = if let Some(ref d_vid) = dep.version_id {
                let ver = Self::get_version(d_vid).await.map_err(|e| {
                    let _ = fs::remove_dir_all(&staging_dir);
                    format!("No se pudo resolver la dependencia requerida (versión {}): {}", d_vid, e)
                })?;
                validate_version_compatibility(&ver, &loader, &mc_version).map_err(|e| {
                    let _ = fs::remove_dir_all(&staging_dir);
                    e
                })?;
                if let Some(ref pid) = dep.project_id {
                    if pid != &ver.project_id {
                        let _ = fs::remove_dir_all(&staging_dir);
                        return Err(format!(
                            "Incoherencia en metadatos de dependencia: project_id '{}' no coincide con versión '{}' ('{}')",
                            pid, d_vid, ver.project_id
                        ));
                    }
                }
                ver
            } else if let Some(ref pid) = dep.project_id {
                let vers = Self::get_project_versions(pid, Some(&loader), Some(&mc_version))
                    .await
                    .map_err(|e| {
                        let _ = fs::remove_dir_all(&staging_dir);
                        format!("Fallo buscando versión compatible para dependencia {}: {}", pid, e)
                    })?;

                vers.into_iter().next().ok_or_else(|| {
                    let _ = fs::remove_dir_all(&staging_dir);
                    format!(
                        "No existe versión compatible de la dependencia {} para {} en Minecraft {}",
                        pid, loader, mc_version
                    )
                })?
            } else {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err("Dependencia requerida sin project_id ni version_id válidos".to_string());
            };

            if let Some(selected_vid) = visited_projects.get(&dep_ver.project_id) {
                if selected_vid != &dep_ver.id {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Conflicto de versiones: el proyecto {} requiere la versión {}, pero ya se seleccionó la versión {}",
                        dep_ver.project_id, dep_ver.id, selected_vid
                    ));
                }
                continue;
            }
            visited_projects.insert(dep_ver.project_id.clone(), dep_ver.id.clone());

            let primary = dep_ver
                .files
                .iter()
                .find(|f| f.primary)
                .cloned()
                .or_else(|| dep_ver.files.first().cloned())
                .ok_or_else(|| {
                    let _ = fs::remove_dir_all(&staging_dir);
                    format!("Dependencia {} no contiene ningún archivo descargable", dep_ver.id)
                })?;

            let dep_file_rel = Path::new(&primary.filename);
            if !is_safe_rel_path(dep_file_rel) {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!(
                    "Dependencia {} contiene un nombre de archivo no seguro: {}",
                    dep_ver.id, primary.filename
                ));
            }

            if let Some(installed_entry) = manifest_mods.get(&dep_ver.project_id) {
                let inst_path = mods_dir.join(&installed_entry.filename);
                if inst_path.is_file() && !installed_entry.filename.ends_with(".disabled") {
                    let mut hash_valid = false;
                    if let Some(sha512) = primary.hashes.get("sha512") {
                        if let Some(actual) = compute_file_sha512(&inst_path) {
                            if actual.eq_ignore_ascii_case(sha512) {
                                hash_valid = true;
                            }
                        }
                    } else if let Some(sha1) = primary.hashes.get("sha1") {
                        if let Some(actual) = compute_file_sha1(&inst_path) {
                            if actual.eq_ignore_ascii_case(sha1) {
                                hash_valid = true;
                            }
                        }
                    }
                    if hash_valid {
                        if let Some(ref req_vid) = dep.version_id {
                            if installed_entry.version_id.as_deref() == Some(req_vid) {
                                for sub_dep in &dep_ver.dependencies {
                                    if sub_dep.dependency_type == "required" {
                                        queue.push_back(sub_dep.clone());
                                    }
                                }
                                continue;
                            }
                        } else {
                            for sub_dep in &dep_ver.dependencies {
                                if sub_dep.dependency_type == "required" {
                                    queue.push_back(sub_dep.clone());
                                }
                            }
                            continue;
                        }
                    }
                }
            }

            if let Ok(entries) = fs::read_dir(&mods_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.eq_ignore_ascii_case(&primary.filename) && name != primary.filename {
                        let is_own_old_file = manifest_mods
                            .get(&dep_ver.project_id)
                            .map(|e| e.filename == name)
                            .unwrap_or(false);
                        if !is_own_old_file {
                            let _ = fs::remove_dir_all(&staging_dir);
                            return Err(format!(
                                "Colisión de nombres de archivo case-insensitive: '{}' colisiona con '{}' existente en mods",
                                primary.filename, name
                            ));
                        }
                    }
                }
            }

            let existing_in_mods = mods_dir.join(&primary.filename);
            let mut matches_existing = false;
            if existing_in_mods.exists() {
                if let Some(sha512) = primary.hashes.get("sha512") {
                    if let Some(actual) = compute_file_sha512(&existing_in_mods) {
                        if actual.eq_ignore_ascii_case(sha512) {
                            matches_existing = true;
                        }
                    }
                } else if let Some(sha1) = primary.hashes.get("sha1") {
                    if let Some(actual) = compute_file_sha1(&existing_in_mods) {
                        if actual.eq_ignore_ascii_case(sha1) {
                            matches_existing = true;
                        }
                    }
                }
            }

            if !matches_existing {
                if existing_in_mods.exists() {
                    let existing_owners: Vec<&String> = manifest_mods
                        .iter()
                        .filter(|(_, entry)| entry.filename.eq_ignore_ascii_case(&primary.filename))
                        .map(|(pid, _)| pid)
                        .collect();

                    if !existing_owners.is_empty() {
                        if existing_owners.len() > 1 || existing_owners[0] != &dep_ver.project_id {
                            let _ = fs::remove_dir_all(&staging_dir);
                            return Err(format!(
                                "Colisión de nombres de archivo: '{}' ya pertenece a otro mod instalado ({:?})",
                                primary.filename, existing_owners
                            ));
                        }
                    } else {
                        let _ = fs::remove_dir_all(&staging_dir);
                        return Err(format!(
                            "Colisión de nombres de archivo: '{}' ya existe en mods y no coincide con la dependencia {}",
                            primary.filename, dep_ver.project_id
                        ));
                    }
                }

                if staged_filenames.contains(&primary.filename.to_lowercase()) {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Colisión de nombres de archivo entre dependencias requeridas: {}",
                        primary.filename
                    ));
                }
                staged_filenames.insert(primary.filename.to_lowercase());
                files_to_download.push((dep_ver.project_id.clone(), dep_ver.id.clone(), primary.clone()));
            } else {
                if let Some((owner_pid, _)) = manifest_mods.iter().find(|(pid, e)| {
                    e.filename.eq_ignore_ascii_case(&primary.filename) && *pid != &dep_ver.project_id
                }) {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Colisión de propiedad: '{}' ya pertenece a otro proyecto mod instalado ('{}')",
                        primary.filename, owner_pid
                    ));
                }

                if staged_filenames.contains(&primary.filename.to_lowercase()) {
                    let _ = fs::remove_dir_all(&staging_dir);
                    return Err(format!(
                        "Colisión de nombres de archivo entre dependencias: {}",
                        primary.filename
                    ));
                }
                staged_filenames.insert(primary.filename.to_lowercase());
                installed_records.push((
                    dep_ver.project_id.clone(),
                    primary.filename.clone(),
                    Some(dep_ver.id.clone()),
                ));
            }

            for sub_dep in dep_ver.dependencies {
                if sub_dep.dependency_type == "required" {
                    queue.push_back(sub_dep);
                }
            }
        }

        let staging_root_path = staging_dir.join(clean_filename);
        let root_res = Self::download_file_to(
            &client,
            download_url,
            &staging_root_path,
            root_size,
            &root_hashes,
        )
        .await;

        if let Err(e) = root_res {
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(format!("Error descargando archivo principal {}: {}", clean_filename, e));
        }

        for (pid, vid, dep_file) in files_to_download {
            let staging_dep_path = staging_dir.join(&dep_file.filename);
            let dep_res = Self::download_file_to(
                &client,
                &dep_file.url,
                &staging_dep_path,
                dep_file.size,
                &dep_file.hashes,
            )
            .await;

            if let Err(e) = dep_res {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!("Error descargando dependencia {}: {}", dep_file.filename, e));
            }

            installed_records.push((pid, dep_file.filename, Some(vid)));
        }

        let mut staged_mod_ids: HashMap<String, String> = HashMap::new();
        let staging_entries_check = fs::read_dir(&staging_dir).map_err(|e| e.to_string())?;
        for entry in staging_entries_check.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().map(|e| e == "jar").unwrap_or(false) {
                let staged_fname = entry.file_name().to_string_lossy().to_string();
                let staged_mids = extract_mod_ids_from_jar(&path);
                for mid in staged_mids {
                    if let Some(other_staged) = staged_mod_ids.get(&mid) {
                        if other_staged != &staged_fname {
                            let _ = fs::remove_dir_all(&staging_dir);
                            return Err(format!(
                                "Colisión de mod ID '{}': declarado tanto en '{}' como en '{}'",
                                mid, other_staged, staged_fname
                            ));
                        }
                    }
                    staged_mod_ids.insert(mid.clone(), staged_fname.clone());

                    if let Some(existing_file) = installed_mod_map.get(&mid) {
                        let is_replacing_same_project = installed_records.iter().any(|(pid, new_fname, _)| {
                            new_fname == &staged_fname && (
                                existing_file == &staged_fname ||
                                manifest_mods.get(pid).map(|e| &e.filename) == Some(existing_file)
                            )
                        });
                        if !is_replacing_same_project {
                            let _ = fs::remove_dir_all(&staging_dir);
                            return Err(format!(
                                "Colisión de mod ID '{}': ya está implementado por el archivo instalado '{}'",
                                mid, existing_file
                            ));
                        }
                    }
                }
            }
        }

        let backup_dir = staging_dir.join(".backup");
        fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

        let mut backed_up: Vec<(PathBuf, PathBuf)> = Vec::new();
        let mut moved_to_mods: Vec<PathBuf> = Vec::new();
        let mut final_size = 0u64;

        let commit_res = (|| -> Result<(), String> {
            for (pid, new_fname, _) in &installed_records {
                if let Some(old_entry) = manifest_mods.get(pid) {
                    if old_entry.filename != *new_fname {
                        let old_path = mods_dir.join(&old_entry.filename);
                        if old_path.exists() {
                            let b_dest = backup_dir.join(&old_entry.filename);
                            fs::rename(&old_path, &b_dest).map_err(|e| {
                                format!(
                                    "Fallo creando backup de versión previa {}: {}",
                                    old_entry.filename, e
                                )
                            })?;
                            backed_up.push((b_dest, old_path));
                        }
                    }
                }
            }

            let staging_entries = fs::read_dir(&staging_dir).map_err(|e| e.to_string())?;
            for entry in staging_entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let fname = entry.file_name();
                    let dest = mods_dir.join(&fname);
                    if fname.to_string_lossy() == clean_filename {
                        final_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    }
                    if dest.exists() {
                        let b_dest = backup_dir.join(&fname);
                        fs::rename(&dest, &b_dest).map_err(|e| {
                            format!("Fallo creando backup de {}: {}", fname.to_string_lossy(), e)
                        })?;
                        backed_up.push((b_dest, dest.clone()));
                    }
                    fs::rename(&path, &dest).map_err(|e| {
                        format!("Error instalando archivo {}: {}", fname.to_string_lossy(), e)
                    })?;
                    moved_to_mods.push(dest);
                }
            }

            let manifest_path = mods_dir.join(".ghostty-mods.json");
            let (mut manifest, _) = load_and_prune_manifest(&mods_dir);

            for (pid, fname, vid) in &installed_records {
                manifest.mods.retain(|k, v| k == pid || &v.filename != fname);
                manifest.mods.insert(
                    pid.clone(),
                    InstalledModEntry {
                        filename: fname.clone(),
                        version_id: vid.clone(),
                    },
                );
            }

            let manifest_json = serde_json::to_string_pretty(&manifest)
                .map_err(|e| format!("Fallo serializando manifiesto: {}", e))?;
            let temp_manifest = manifest_path.with_extension(format!("tmp.{}", Uuid::new_v4()));

            fs::write(&temp_manifest, manifest_json).map_err(|e| {
                let _ = fs::remove_file(&temp_manifest);
                format!("Error escribiendo manifiesto temporal: {}", e)
            })?;

            safe_replace_file(&temp_manifest, &manifest_path).map_err(|e| {
                let _ = fs::remove_file(&temp_manifest);
                format!("Error renombrando manifiesto final: {}", e)
            })?;

            Ok(())
        })();

        if let Err(e) = commit_res {
            let mut failed_cleanups = Vec::new();
            for moved in &moved_to_mods {
                if moved.exists() {
                    if let Err(err) = fs::remove_file(moved) {
                        failed_cleanups.push(format!("Fallo eliminando {}: {}", moved.display(), err));
                    }
                }
            }
            for (b_src, orig_dest) in &backed_up {
                if let Err(err) = safe_replace_file(b_src, orig_dest) {
                    failed_cleanups.push(format!("Fallo restaurando backup {}: {}", orig_dest.display(), err));
                }
            }
            if !failed_cleanups.is_empty() {
                return Err(format!(
                    "Fallo durante instalación de mods: {}. ALERTA: No se pudieron limpiar/restaurar algunos archivos; el directorio de staging y los backups se han conservado intactos en '{}'. Errores: {}",
                    e,
                    backup_dir.display(),
                    failed_cleanups.join("; ")
                ));
            }
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(e);
        }

        let _ = fs::remove_dir_all(&staging_dir);

        Ok(ModFileInfo {
            icon: None,
            filename: clean_filename.to_string(),
            enabled: clean_filename.ends_with(".jar"),
            size: final_size,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_mod_ids_from_dummy() {
        let temp_dir = std::env::temp_dir();
        let dummy_path = temp_dir.join(format!("dummy_{}.jar", Uuid::new_v4()));
        {
            let file = File::create(&dummy_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            zip.start_file("fabric.mod.json", zip::write::SimpleFileOptions::default()).unwrap();
            zip.write_all(br#"{"id": "test-mod", "version": "1.0.0"}"#).unwrap();
            zip.finish().unwrap();
        }

        let ids = extract_mod_ids_from_jar(&dummy_path);
        assert_eq!(ids, vec!["test-mod"]);
        let _ = fs::remove_file(dummy_path);
    }

    #[test]
    fn test_validate_modrinth_url() {
        assert!(validate_modrinth_url("https://cdn.modrinth.com/data/ABC/file.jar").is_ok());
        assert!(validate_modrinth_url("https://edge.modrinth.com/data/ABC/file.jar").is_ok());
        assert!(validate_modrinth_url("http://cdn.modrinth.com/insecure.jar").is_err());
        assert!(validate_modrinth_url("https://evil.com/malicious.jar").is_err());
    }
}
