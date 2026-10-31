//! Exportación de instancias a formatos de la comunidad.
//!
//! - `mrpack`: formato de Modrinth. Los mods que existen en Modrinth se referencian
//!   por hash/URL; el resto viaja en `overrides/`.
//! - `prism`: instancia MultiMC/Prism (`instance.cfg` + `mmc-pack.json` + `.minecraft/`).
//! - `curseforge`: manifiesto CF con `files: []` y todo en `overrides/` (sin API key
//!   no hay projectID/fileID, así que CF lo importa pero no trackea los mods).

use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::instances::InstanceManager;
use crate::launcher::LauncherManager;
use crate::models::Instance;

const SKIP_DIRS: &[&str] = &[
    "logs",
    "crash-reports",
    ".mixin.out",
    "saves",
    "backups",
    "downloads",
];
const SKIP_FILES: &[&str] = &["session.lock", "usercache.json", "usernamecache.json"];

pub async fn export(instance_id: &str, format: &str) -> Result<String, String> {
    let instances = LauncherManager::load_instances()?;
    let instance = instances
        .into_iter()
        .find(|i| i.id == instance_id)
        .ok_or("La instancia no existe")?;
    let dir = InstanceManager::get_instance_dir(instance_id)?;
    if !dir.exists() {
        return Err("La carpeta de la instancia no existe".to_string());
    }

    match format.to_ascii_lowercase().as_str() {
        "mrpack" => export_mrpack(&instance, &dir).await,
        "prism" => export_prism(&instance, &dir),
        "curseforge" | "cf" => export_curseforge(&instance, &dir),
        other => Err(format!("Formato de export desconocido: {other}")),
    }
}

async fn export_mrpack(instance: &Instance, dir: &Path) -> Result<String, String> {
    let mods = jars(dir);
    let hashes: Vec<String> = mods.iter().map(|p| sha1_file(p)).collect::<Result<_, _>>()?;
    let lookup = modrinth_lookup(&hashes).await.unwrap_or_default();

    let mut files = Vec::new();
    let mut unmatched: Vec<PathBuf> = Vec::new();
    let mut matched: HashSet<PathBuf> = HashSet::new();

    for (jar, hash) in mods.iter().zip(hashes.iter()) {
        match lookup.get(hash) {
            Some(version) => {
                matched.insert(jar.clone());
                files.push(modrinth_entry(instance, jar, hash, version));
            }
            None => unmatched.push(jar.clone()),
        }
    }

    let target = target_path(instance, "mrpack");
    let file = File::create(&target).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    let index = json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": "1.0.0",
        "name": instance.name,
        "summary": "Exportado desde GhosttyLauncher",
        "files": files,
        "dependencies": dependencies(instance),
    });
    add_bytes(&mut zip, "modrinth.index.json", index.to_string().as_bytes())?;

    for path in collect_files(dir) {
        // Los jars resueltos por Modrinth ya viajan en `files[]`; duplicarlos en
        // overrides haría que el pack instalara el mod dos veces.
        if matched.contains(&path) {
            continue;
        }
        let rel = path.strip_prefix(dir).map_err(|e| e.to_string())?;
        if unmatched.iter().any(|o| o == &path) {
            add_file(&mut zip, &format!("overrides/mods/{}", file_name(&path)), &path)?;
        } else {
            add_file(&mut zip, &format!("overrides/{}", to_slash(rel)), &path)?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

fn modrinth_entry(instance: &Instance, jar: &Path, hash: &str, version: &Value) -> Value {
    let file = version
        .get("files")
        .and_then(Value::as_array)
        .and_then(|files| files.first())
        .cloned()
        .unwrap_or(Value::Null);

    let mut entry = json!({
        "path": format!("mods/{}", file_name(jar)),
        "hashes": { "sha1": hash },
        "env": { "client": "required", "server": "optional" },
        "fileSize": file.get("size").and_then(Value::as_u64).unwrap_or(0),
    });

    if let Some(url) = file.get("url").and_then(Value::as_str) {
        entry["downloads"] = json!([url]);
    }
    if let Some(sha512) = file
        .get("hashes")
        .and_then(|h| h.get("sha512"))
        .and_then(Value::as_str)
    {
        entry["hashes"]["sha512"] = json!(sha512);
    }
    let _ = instance;
    entry
}

fn dependencies(instance: &Instance) -> Value {
    let mut deps = serde_json::Map::new();
    deps.insert("minecraft".into(), json!(instance.mc_version));

    let key = match instance.loader.to_ascii_lowercase().as_str() {
        "fabric" => Some("fabric-loader"),
        "quilt" => Some("quilt-loader"),
        "forge" => Some("forge"),
        "neoforge" => Some("neoforge"),
        _ => None,
    };
    if let (Some(key), Some(version)) = (key, instance.loader_version.clone()) {
        deps.insert(key.into(), json!(version));
    }
    Value::Object(deps)
}

fn export_prism(instance: &Instance, dir: &Path) -> Result<String, String> {
    let target = target_path(instance, "prism.zip");
    let file = File::create(&target).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    let cfg = format!(
        "[General]\nname={}\nInstanceType=OneSix\n",
        instance.name.replace('\n', " ")
    );
    add_bytes(&mut zip, "instance.cfg", cfg.as_bytes())?;

    let mut components = vec![json!({
        "uid": "net.minecraft",
        "version": instance.mc_version,
        "important": true
    })];
    if let (Some(uid), Some(version)) = (prism_uid(&instance.loader), instance.loader_version.clone()) {
        components.push(json!({ "uid": uid, "version": version }));
    }
    let pack = json!({ "formatVersion": 1, "components": components });
    add_bytes(&mut zip, "mmc-pack.json", pack.to_string().as_bytes())?;

    for path in collect_files(dir) {
        let rel = path.strip_prefix(dir).map_err(|e| e.to_string())?;
        add_file(&mut zip, &format!(".minecraft/{}", to_slash(rel)), &path)?;
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

fn prism_uid(loader: &str) -> Option<&'static str> {
    match loader.to_ascii_lowercase().as_str() {
        "fabric" => Some("net.fabricmc.fabric-loader"),
        "quilt" => Some("org.quiltmc.quilt-loader"),
        "forge" => Some("net.minecraftforge"),
        "neoforge" => Some("net.neoforged"),
        _ => None,
    }
}

fn export_curseforge(instance: &Instance, dir: &Path) -> Result<String, String> {
    let target = target_path(instance, "curseforge.zip");
    let file = File::create(&target).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    let mut mod_loaders = Vec::new();
    if let (Some(prefix), Some(version)) = (cf_loader(instance), instance.loader_version.clone()) {
        mod_loaders.push(json!({ "id": format!("{prefix}{version}"), "primary": true }));
    }

    let manifest = json!({
        "minecraft": {
            "version": instance.mc_version,
            "modLoaders": mod_loaders
        },
        "manifestType": "minecraftModpack",
        "manifestVersion": 1,
        "name": instance.name,
        "version": "1.0.0",
        "author": "GhosttyLauncher",
        "files": [],
        "overrides": "overrides"
    });
    add_bytes(&mut zip, "manifest.json", manifest.to_string().as_bytes())?;

    for path in collect_files(dir) {
        let rel = path.strip_prefix(dir).map_err(|e| e.to_string())?;
        add_file(&mut zip, &format!("overrides/{}", to_slash(rel)), &path)?;
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

fn cf_loader(instance: &Instance) -> Option<&'static str> {
    match instance.loader.to_ascii_lowercase().as_str() {
        "fabric" => Some("fabric-"),
        "quilt" => Some("quilt-"),
        "forge" => Some("forge-"),
        "neoforge" => Some("neoforge-"),
        _ => None,
    }
}

async fn modrinth_lookup(hashes: &[String]) -> Result<HashMap<String, Value>, String> {
    if hashes.is_empty() {
        return Ok(HashMap::new());
    }
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (export)")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post("https://api.modrinth.com/v2/version_files")
        .json(&json!({ "hashes": hashes, "algorithm": "sha1" }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Modrinth devolvió {}", response.status()));
    }

    response.json().await.map_err(|e| e.to_string())
}

fn jars(dir: &Path) -> Vec<PathBuf> {
    let mods = dir.join("mods");
    let Ok(entries) = fs::read_dir(&mods) else {
        return Vec::new();
    };
    let mut out: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|e| e.to_str()) == Some("jar")
                && p.is_file()
        })
        .collect();
    out.sort();
    out
}

fn collect_files(dir: &Path) -> Vec<PathBuf> {
    WalkDir::new(dir)
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_dir() {
                !SKIP_DIRS.contains(&name.as_ref())
            } else {
                !SKIP_FILES.contains(&name.as_ref())
            }
        })
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(|e| e.into_path())
        .collect()
}

fn sha1_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn add_file<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    name: &str,
    path: &Path,
) -> Result<(), String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    add_bytes(zip, name, &data)
}

fn add_bytes<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
    name: &str,
    data: &[u8],
) -> Result<(), String> {
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.start_file(name, options).map_err(|e| e.to_string())?;
    zip.write_all(data).map_err(|e| e.to_string())
}

fn to_slash(path: &Path) -> String {
    path.components()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("/")
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "mod.jar".to_string())
}

fn target_path(instance: &Instance, extension: &str) -> PathBuf {
    let base = sanitize(&instance.name);
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let dir = dirs::download_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("GhosttyLauncher");
    let _ = fs::create_dir_all(&dir);
    dir.join(format!("{base}-{stamp}.{extension}"))
}

fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let trimmed = cleaned.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "instancia".to_string()
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::{sanitize, to_slash};
    use std::path::Path;

    #[test]
    fn sanitizes_instance_names() {
        assert_eq!(sanitize("Mi Pack / 1.20"), "Mi-Pack---1-20");
        assert_eq!(sanitize("???"), "instancia");
    }

    #[test]
    fn paths_use_forward_slashes() {
        assert_eq!(to_slash(Path::new("config/foo.toml")), "config/foo.toml");
    }
}
