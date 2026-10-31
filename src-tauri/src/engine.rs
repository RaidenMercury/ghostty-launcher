use crate::accounts::AccountManager;
use crate::instances::InstanceManager;
use crate::launcher::LauncherManager;
use crate::models::Instance;
use crate::versions::VersionFetcher;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

pub static RUNNING_GAME: LazyLock<Arc<Mutex<Option<Child>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(None)));

#[derive(Clone, Serialize)]
pub struct LaunchProgressEvent {
    pub stage: String,
    pub current: usize,
    pub total: usize,
    pub detail: String,
}

#[derive(Clone, Serialize)]
pub struct GameLogEvent {
    pub line: String,
    pub level: String,
}

#[derive(Deserialize)]
struct AssetIndexFile {
    objects: HashMap<String, AssetObject>,
}

#[derive(Deserialize, Clone)]
struct AssetObject {
    hash: String,
    #[allow(dead_code)]
    size: u64,
}

pub struct GameEngine;

impl GameEngine {
    fn emit_progress(app: &AppHandle, stage: &str, current: usize, total: usize, detail: &str) {
        let _ = app.emit(
            "launch-progress",
            LaunchProgressEvent {
                stage: stage.to_string(),
                current,
                total,
                detail: detail.to_string(),
            },
        );
    }

    fn emit_log(app: &AppHandle, line: &str, level: &str) {
        let _ = app.emit(
            "game-log",
            GameLogEvent {
                line: line.to_string(),
                level: level.to_string(),
            },
        );
    }

    fn verify_sha1(path: &Path, expected_sha1: &str) -> bool {
        if expected_sha1.is_empty() {
            return path.exists();
        }
        if let Ok(bytes) = fs::read(path) {
            let mut hasher = Sha1::new();
            hasher.update(&bytes);
            let hash = format!("{:x}", hasher.finalize());
            return hash.eq_ignore_ascii_case(expected_sha1);
        }
        false
    }

    async fn download_if_needed(
        client: &reqwest::Client,
        url: &str,
        dest: &Path,
        expected_sha1: Option<&str>,
    ) -> Result<(), String> {
        if dest.exists() {
            if let Some(sha) = expected_sha1 {
                if Self::verify_sha1(dest, sha) {
                    return Ok(());
                }
            } else if let Ok(meta) = fs::metadata(dest) {
                if meta.len() > 0 {
                    return Ok(());
                }
            }
        }

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Fallo de red descargando {}: {}", url, e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} al descargar {}", resp.status(), url));
        }

        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        fs::write(dest, &bytes).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn current_os_name() -> &'static str {
        #[cfg(target_os = "windows")]
        {
            "windows"
        }
        #[cfg(target_os = "macos")]
        {
            "osx"
        }
        #[cfg(target_os = "linux")]
        {
            "linux"
        }
    }

    fn is_library_allowed(lib: &Value) -> bool {
        let os_name = Self::current_os_name();
        if let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) {
            let mut allowed = false;
            for rule in rules {
                let action = rule
                    .get("action")
                    .and_then(|a| a.as_str())
                    .unwrap_or("allow");
                if let Some(os_obj) = rule.get("os") {
                    if let Some(rule_os) = os_obj.get("name").and_then(|n| n.as_str()) {
                        if rule_os == os_name {
                            allowed = action == "allow";
                        }
                    }
                } else {
                    allowed = action == "allow";
                }
            }
            return allowed;
        }
        true
    }

    fn maven_to_path(coord: &str) -> Option<(String, String)> {
        let parts: Vec<&str> = coord.split(':').collect();
        if parts.len() < 3 {
            return None;
        }
        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        let classifier = if parts.len() >= 4 {
            Some(parts[3])
        } else {
            None
        };

        let filename = if let Some(c) = classifier {
            format!("{}-{}-{}.jar", artifact, version, c)
        } else {
            format!("{}-{}.jar", artifact, version)
        };

        let rel_path = format!("{}/{}/{}/{}", group, artifact, version, filename);
        Some((rel_path, filename))
    }

    fn extract_native_jar(jar_path: &Path, natives_dir: &Path) {
        if let Ok(file) = File::open(jar_path) {
            if let Ok(mut archive) = ZipArchive::new(file) {
                for i in 0..archive.len() {
                    if let Ok(mut entry) = archive.by_index(i) {
                        let name = entry.name().to_string();
                        if name.starts_with("META-INF") || entry.is_dir() {
                            continue;
                        }
                        if name.ends_with(".so")
                            || name.ends_with(".dll")
                            || name.ends_with(".dylib")
                        {
                            if let Some(fname) = Path::new(&name).file_name() {
                                let out_path = natives_dir.join(fname);
                                if let Ok(mut out_file) = File::create(out_path) {
                                    let _ = std::io::copy(&mut entry, &mut out_file);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pub async fn launch_game_real(app: AppHandle, instance: Instance) -> Result<String, String> {
        {
            let mut guard = RUNNING_GAME.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut child) = *guard {
                if let Ok(None) = child.try_wait() {
                    return Err("Ya hay una instancia de Minecraft en ejecución.".to_string());
                }
            }
        }

        let root_dir = LauncherManager::get_root_dir()?;
        let config = LauncherManager::load_config()?;
        let accounts = AccountManager::load_accounts()?;
        let active_account = accounts
            .into_iter()
            .find(|a| a.is_active)
            .ok_or("No hay ninguna cuenta activa seleccionada.")?;

        let instance_dir = InstanceManager::get_instance_dir(&instance.id)?;
        let versions_dir = root_dir.join("versions");
        let libraries_dir = root_dir.join("libraries");
        let assets_dir = root_dir.join("assets");
        let natives_dir = versions_dir.join(&instance.mc_version).join("natives");
        fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;

        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0 (https://github.com/ghostty-launcher)")
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;

        Self::emit_log(
            &app,
            &format!(
                "[GhosttyEngine] Preparando lanzamiento de '{}' (MC {} - {})",
                instance.name, instance.mc_version, instance.loader
            ),
            "INFO",
        );

        Self::emit_progress(
            &app,
            "Resolviendo versión de Mojang",
            1,
            5,
            &instance.mc_version,
        );
        let manifest = VersionFetcher::fetch_mojang_manifest().await?;
        let ver_entry = manifest
            .versions
            .iter()
            .find(|v| v.id == instance.mc_version)
            .ok_or_else(|| {
                format!(
                    "La versión {} no existe en el manifiesto oficial de Mojang.",
                    instance.mc_version
                )
            })?;

        let vanilla_ver_dir = versions_dir.join(&instance.mc_version);
        fs::create_dir_all(&vanilla_ver_dir).map_err(|e| e.to_string())?;
        let vanilla_json_path =
            vanilla_ver_dir.join(format!("{}.json", instance.mc_version));

        if !vanilla_json_path.exists() && !ver_entry.url.is_empty() {
            Self::download_if_needed(&client, &ver_entry.url, &vanilla_json_path, None).await?;
        }

        let vanilla_json_str = fs::read_to_string(&vanilla_json_path).map_err(|e| {
            format!(
                "No se pudo leer el JSON de la versión {}: {}",
                instance.mc_version, e
            )
        })?;
        let vanilla_json: Value =
            serde_json::from_str(&vanilla_json_str).map_err(|e| e.to_string())?;

        let client_jar_path =
            vanilla_ver_dir.join(format!("{}.jar", instance.mc_version));
        if let Some(dl_client) = vanilla_json.get("downloads").and_then(|d| d.get("client")) {
            let url = dl_client.get("url").and_then(|u| u.as_str()).unwrap_or("");
            let sha1 = dl_client.get("sha1").and_then(|s| s.as_str());
            if !url.is_empty() {
                Self::emit_progress(
                    &app,
                    "Verificando cliente base (.jar)",
                    1,
                    1,
                    &format!("{}.jar", instance.mc_version),
                );
                Self::download_if_needed(&client, url, &client_jar_path, sha1).await?;
            }
        }

        let mut main_class = vanilla_json
            .get("mainClass")
            .and_then(|m| m.as_str())
            .unwrap_or("net.minecraft.client.main.Main")
            .to_string();

        let mut all_libraries: Vec<Value> = vanilla_json
            .get("libraries")
            .and_then(|l| l.as_array())
            .cloned()
            .unwrap_or_default();

        let mut extra_jvm_args: Vec<String> = Vec::new();
        let mut extra_game_args: Vec<String> = Vec::new();

        if instance.loader.eq_ignore_ascii_case("fabric") {
            Self::emit_log(
                &app,
                "[GhosttyEngine] Resolviendo perfil de Fabric Loader...",
                "INFO",
            );
            let loader_ver = match &instance.loader_version {
                Some(v) if !v.is_empty() => v.clone(),
                _ => {
                    let meta_url = format!(
                        "https://meta.fabricmc.net/v2/versions/loader/{}",
                        instance.mc_version
                    );
                    let resp: Value = client
                        .get(&meta_url)
                        .send()
                        .await
                        .map_err(|e| e.to_string())?
                        .json()
                        .await
                        .map_err(|e| e.to_string())?;
                    resp.as_array()
                        .and_then(|arr| arr.first())
                        .and_then(|first| first.get("loader"))
                        .and_then(|l| l.get("version"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("0.16.10")
                        .to_string()
                }
            };

            let fabric_profile_url = format!(
                "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
                instance.mc_version, loader_ver
            );
            let fabric_json: Value = client
                .get(&fabric_profile_url)
                .send()
                .await
                .map_err(|e| format!("Error descargando perfil Fabric: {}", e))?
                .json()
                .await
                .map_err(|e| e.to_string())?;

            if let Some(mc) = fabric_json.get("mainClass").and_then(|m| m.as_str()) {
                main_class = mc.to_string();
            }
            if let Some(libs) = fabric_json.get("libraries").and_then(|l| l.as_array()) {
                for l in libs {
                    all_libraries.push(l.clone());
                }
            }
            if let Some(args) = fabric_json.get("arguments") {
                if let Some(jvm) = args.get("jvm").and_then(|j| j.as_array()) {
                    for a in jvm {
                        if let Some(s) = a.as_str() {
                            extra_jvm_args.push(s.to_string());
                        }
                    }
                }
                if let Some(game) = args.get("game").and_then(|g| g.as_array()) {
                    for a in game {
                        if let Some(s) = a.as_str() {
                            extra_game_args.push(s.to_string());
                        }
                    }
                }
            }
        } else if instance.loader.eq_ignore_ascii_case("quilt") {
            Self::emit_log(
                &app,
                "[GhosttyEngine] Resolviendo perfil de Quilt Loader...",
                "INFO",
            );
            let loader_ver = match &instance.loader_version {
                Some(v) if !v.is_empty() => v.clone(),
                _ => {
                    let meta_url = format!(
                        "https://meta.quiltmc.org/v3/versions/loader/{}",
                        instance.mc_version
                    );
                    let resp: Value = client
                        .get(&meta_url)
                        .send()
                        .await
                        .map_err(|e| e.to_string())?
                        .json()
                        .await
                        .map_err(|e| e.to_string())?;
                    resp.as_array()
                        .and_then(|arr| arr.first())
                        .and_then(|first| first.get("loader"))
                        .and_then(|l| l.get("version"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("0.27.1")
                        .to_string()
                }
            };

            let quilt_profile_url = format!(
                "https://meta.quiltmc.org/v3/versions/loader/{}/{}/profile/json",
                instance.mc_version, loader_ver
            );
            let quilt_json: Value = client
                .get(&quilt_profile_url)
                .send()
                .await
                .map_err(|e| format!("Error descargando perfil Quilt: {}", e))?
                .json()
                .await
                .map_err(|e| e.to_string())?;

            if let Some(mc) = quilt_json.get("mainClass").and_then(|m| m.as_str()) {
                main_class = mc.to_string();
            }
            if let Some(libs) = quilt_json.get("libraries").and_then(|l| l.as_array()) {
                for l in libs {
                    all_libraries.push(l.clone());
                }
            }
            if let Some(args) = quilt_json.get("arguments") {
                if let Some(jvm) = args.get("jvm").and_then(|j| j.as_array()) {
                    for a in jvm {
                        if let Some(s) = a.as_str() {
                            extra_jvm_args.push(s.to_string());
                        }
                    }
                }
                if let Some(game) = args.get("game").and_then(|g| g.as_array()) {
                    for a in game {
                        if let Some(s) = a.as_str() {
                            extra_game_args.push(s.to_string());
                        }
                    }
                }
            }
        }

        let mut classpath_entries: Vec<PathBuf> = Vec::new();
        let total_libs = all_libraries.len();

        for (idx, lib) in all_libraries.iter().enumerate() {
            if !Self::is_library_allowed(lib) {
                continue;
            }

            let lib_name = lib
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("unknown");
            Self::emit_progress(
                &app,
                "Descargando librerías",
                idx + 1,
                total_libs,
                lib_name,
            );

            if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                let path_str = artifact.get("path").and_then(|p| p.as_str()).unwrap_or("");
                let url = artifact.get("url").and_then(|u| u.as_str()).unwrap_or("");
                let sha1 = artifact.get("sha1").and_then(|s| s.as_str());

                if !path_str.is_empty() && !url.is_empty() {
                    let dest = libraries_dir.join(path_str);
                    Self::download_if_needed(&client, url, &dest, sha1).await?;

                    if lib_name.contains(":natives-") {
                        Self::extract_native_jar(&dest, &natives_dir);
                    } else {
                        classpath_entries.push(dest);
                    }
                }
            } else if let Some((rel_path, _)) = Self::maven_to_path(lib_name) {
                let base_url = lib
                    .get("url")
                    .and_then(|u| u.as_str())
                    .unwrap_or("https://libraries.minecraft.net/");
                let full_url = format!("{}{}", base_url.trim_end_matches('/'), format!("/{}", rel_path));
                let dest = libraries_dir.join(&rel_path);
                Self::download_if_needed(&client, &full_url, &dest, None).await?;
                classpath_entries.push(dest);
            }

            let os_key = format!("natives-{}", Self::current_os_name());
            if let Some(classifier_obj) = lib
                .get("downloads")
                .and_then(|d| d.get("classifiers"))
                .and_then(|c| c.get(&os_key))
            {
                let path_str = classifier_obj
                    .get("path")
                    .and_then(|p| p.as_str())
                    .unwrap_or("");
                let url = classifier_obj
                    .get("url")
                    .and_then(|u| u.as_str())
                    .unwrap_or("");
                let sha1 = classifier_obj.get("sha1").and_then(|s| s.as_str());
                if !path_str.is_empty() && !url.is_empty() {
                    let dest = libraries_dir.join(path_str);
                    Self::download_if_needed(&client, url, &dest, sha1).await?;
                    Self::extract_native_jar(&dest, &natives_dir);
                }
            }
        }

        classpath_entries.push(client_jar_path);

        let mut asset_index_id = instance.mc_version.clone();
        if let Some(asset_idx) = vanilla_json.get("assetIndex") {
            asset_index_id = asset_idx
                .get("id")
                .and_then(|i| i.as_str())
                .unwrap_or(&instance.mc_version)
                .to_string();
            let idx_url = asset_idx.get("url").and_then(|u| u.as_str()).unwrap_or("");
            let idx_sha1 = asset_idx.get("sha1").and_then(|s| s.as_str());

            if !idx_url.is_empty() {
                let idx_dest = assets_dir
                    .join("indexes")
                    .join(format!("{}.json", asset_index_id));
                Self::download_if_needed(&client, idx_url, &idx_dest, idx_sha1).await?;

                if let Ok(idx_content) = fs::read_to_string(&idx_dest) {
                    if let Ok(parsed_idx) = serde_json::from_str::<AssetIndexFile>(&idx_content) {
                        let objects_dir = assets_dir.join("objects");
                        let missing: Vec<(String, AssetObject)> = parsed_idx
                            .objects
                            .into_iter()
                            .filter(|(_, obj)| {
                                let prefix = &obj.hash[0..2];
                                !objects_dir.join(prefix).join(&obj.hash).exists()
                            })
                            .collect();

                        if !missing.is_empty() {
                            Self::emit_log(
                                &app,
                                &format!(
                                    "[GhosttyEngine] Descargando {} assets faltantes en paralelo...",
                                    missing.len()
                                ),
                                "INFO",
                            );
                            let total_missing = missing.len();
                            let chunk_size = 24;
                            for (chunk_idx, chunk) in missing.chunks(chunk_size).enumerate() {
                                let current_done =
                                    std::cmp::min((chunk_idx + 1) * chunk_size, total_missing);
                                Self::emit_progress(
                                    &app,
                                    "Descargando Assets de recursos",
                                    current_done,
                                    total_missing,
                                    &format!("{}/{} objetos", current_done, total_missing),
                                );

                                let mut tasks = Vec::new();
                                for (_name, obj) in chunk {
                                    let prefix = obj.hash[0..2].to_string();
                                    let hash = obj.hash.clone();
                                    let url = format!(
                                        "https://resources.download.minecraft.net/{}/{}",
                                        prefix, hash
                                    );
                                    let dest = objects_dir.join(&prefix).join(&hash);
                                    let c = client.clone();
                                    tasks.push(tokio::spawn(async move {
                                        let _ = Self::download_if_needed(&c, &url, &dest, None).await;
                                    }));
                                }
                                for t in tasks {
                                    let _ = t.await;
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some(ref pre_hook) = instance.pre_launch_hook {
            if !pre_hook.trim().is_empty() {
                Self::emit_log(
                    &app,
                    &format!("[GhosttyEngine] Ejecutando Pre-Launch Hook: {}", pre_hook),
                    "INFO",
                );
                #[cfg(target_os = "windows")]
                let _ = Command::new("cmd")
                    .args(["/C", pre_hook])
                    .current_dir(&instance_dir)
                    .status();
                #[cfg(not(target_os = "windows"))]
                let _ = Command::new("sh")
                    .args(["-c", pre_hook])
                    .current_dir(&instance_dir)
                    .status();
            }
        }

        let cp_sep = if cfg!(target_os = "windows") { ";" } else { ":" };
        let classpath_str = classpath_entries
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(cp_sep);

        let min_ram = instance.min_ram_mb.unwrap_or(config.min_ram_mb);
        let max_ram = instance.max_ram_mb.unwrap_or(config.max_ram_mb);
        let java_bin = if !instance.java_path.trim().is_empty() && instance.java_path != "java" {
            instance.java_path.clone()
        } else {
            config.java_path.clone()
        };

        let mut jvm_args: Vec<String> = vec![
            format!("-Xms{}M", min_ram),
            format!("-Xmx{}M", max_ram),
            format!("-Djava.library.path={}", natives_dir.to_string_lossy()),
            "-Dminecraft.launcher.brand=GhosttyLauncher".to_string(),
            "-Dminecraft.launcher.version=0.1.0".to_string(),
        ];

        if active_account.account_type == "ElyBy" {
            jvm_args.push("-Dminecraft.api.env=custom".to_string());
            jvm_args.push("-Dminecraft.api.auth.host=https://authserver.ely.by".to_string());
            jvm_args.push("-Dminecraft.api.account.host=https://account.ely.by".to_string());
            jvm_args.push("-Dminecraft.api.services.host=https://account.ely.by".to_string());
            jvm_args.push("-Dminecraft.api.session.host=https://sessionserver.ely.by".to_string());
        }

        let custom_args_str = if !instance.custom_jvm_args.trim().is_empty() {
            &instance.custom_jvm_args
        } else {
            &config.custom_jvm_args
        };
        for arg in custom_args_str.split_whitespace() {
            jvm_args.push(arg.to_string());
        }
        for arg in extra_jvm_args {
            jvm_args.push(arg);
        }

        jvm_args.push("-cp".to_string());
        jvm_args.push(classpath_str);
        jvm_args.push(main_class.clone());

        let access_token = active_account
            .access_token
            .clone()
            .unwrap_or_else(|| "0".to_string());
        let user_type = match active_account.account_type.as_str() {
            "Microsoft" => "msa",
            "ElyBy" => "mojang",
            _ => "legacy",
        };

        let mut game_args: Vec<String> = vec![
            "--username".to_string(),
            active_account.username.clone(),
            "--version".to_string(),
            instance.mc_version.clone(),
            "--gameDir".to_string(),
            instance_dir.to_string_lossy().to_string(),
            "--assetsDir".to_string(),
            assets_dir.to_string_lossy().to_string(),
            "--assetIndex".to_string(),
            asset_index_id,
            "--uuid".to_string(),
            active_account.uuid.replace('-', ""),
            "--accessToken".to_string(),
            access_token,
            "--userType".to_string(),
            user_type.to_string(),
            "--versionType".to_string(),
            "GhosttyLauncher".to_string(),
        ];

        if let Some(ref res) = instance.resolution {
            if let Some(s) = res.as_str() {
                let trimmed = s.trim().to_lowercase();
                if trimmed == "fullscreen" {
                    game_args.push("--fullscreen".to_string());
                } else if let Some((w, h)) = trimmed.split_once('x') {
                    if !w.is_empty() && !h.is_empty() {
                        game_args.push("--width".to_string());
                        game_args.push(w.to_string());
                        game_args.push("--height".to_string());
                        game_args.push(h.to_string());
                    }
                }
            } else if let Some(obj) = res.as_object() {
                if obj.get("fullscreen").and_then(|f| f.as_bool()).unwrap_or(false) {
                    game_args.push("--fullscreen".to_string());
                } else {
                    if let (Some(w), Some(h)) = (
                        obj.get("width").and_then(|v| v.as_u64()),
                        obj.get("height").and_then(|v| v.as_u64()),
                    ) {
                        game_args.push("--width".to_string());
                        game_args.push(w.to_string());
                        game_args.push("--height".to_string());
                        game_args.push(h.to_string());
                    }
                }
            }
        }

        if let Some(ref srv) = instance.server_auto_connect {
            if let Some(s) = srv.as_str() {
                let trimmed = s.trim();
                if !trimmed.is_empty() {
                    game_args.push("--quickPlayMultiplayer".to_string());
                    game_args.push(trimmed.to_string());
                }
            } else if let Some(obj) = srv.as_object() {
                if let Some(host) = obj.get("host").and_then(|h| h.as_str()) {
                    let trimmed = host.trim();
                    if !trimmed.is_empty() {
                        let port = obj.get("port").and_then(|p| p.as_u64()).unwrap_or(25565);
                        game_args.push("--quickPlayMultiplayer".to_string());
                        game_args.push(format!("{}:{}", trimmed, port));
                    }
                }
            }
        }

        for g in extra_game_args {
            game_args.push(g);
        }

        Self::emit_progress(
            &app,
            "Iniciando Máquina Virtual Java",
            5,
            5,
            &format!("{} ({}MB RAM)", java_bin, max_ram),
        );
        Self::emit_log(
            &app,
            &format!(
                "[GhosttyEngine] Ejecutando: {} -Xms{}M -Xmx{}M ... {}",
                java_bin, min_ram, max_ram, main_class
            ),
            "INFO",
        );

        let mut cmd = if let Some(ref wrapper) = instance.wrapper_command {
            if !wrapper.trim().is_empty() {
                let mut parts = wrapper.split_whitespace();
                let prog = parts.next().unwrap_or(&java_bin);
                let mut c = Command::new(prog);
                for p in parts {
                    c.arg(p);
                }
                c.arg(&java_bin);
                c
            } else {
                Command::new(&java_bin)
            }
        } else {
            Command::new(&java_bin)
        };

        cmd.args(&jvm_args)
            .args(&game_args)
            .envs(&instance.env_vars)
            .current_dir(&instance_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!(
                "No se pudo iniciar Java ('{}'). Verifica que tengas Java 17/21 instalado. Error: {}",
                java_bin, e
            )
        })?;

        let pid = child.id();
        crate::discord::DiscordRpcManager::set_playing_instance(
            &instance.name,
            &instance.mc_version,
            &instance.loader,
        );
        Self::emit_log(
            &app,
            &format!(
                "[GhosttyEngine] Proceso de Minecraft iniciado con PID: {}",
                pid
            ),
            "INFO",
        );

        if let Some(stdout) = child.stdout.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    let level = if line.contains("WARN") {
                        "WARN"
                    } else if line.contains("ERROR") || line.contains("Exception") {
                        "ERROR"
                    } else {
                        "INFO"
                    };
                    Self::emit_log(&app_clone, &line, level);
                }
            });
        }

        let post_exit = instance.post_exit_command.clone();
        let inst_dir_for_exit = instance_dir.clone();
        if let Some(stderr) = child.stderr.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().flatten() {
                    Self::emit_log(&app_clone, &line, "ERROR");
                }
                crate::discord::DiscordRpcManager::restore_idle();
                let _ = app_clone.emit("game-exited", ());
                if let Some(ref exit_cmd) = post_exit {
                    if !exit_cmd.trim().is_empty() {
                        #[cfg(target_os = "windows")]
                        let _ = Command::new("cmd")
                            .args(["/C", exit_cmd])
                            .current_dir(&inst_dir_for_exit)
                            .status();
                        #[cfg(not(target_os = "windows"))]
                        let _ = Command::new("sh")
                            .args(["-c", exit_cmd])
                            .current_dir(&inst_dir_for_exit)
                            .status();
                    }
                }
            });
        }

        {
            let mut guard = RUNNING_GAME.lock().map_err(|e| e.to_string())?;
            *guard = Some(child);
        }

        let mut instances = LauncherManager::load_instances()?;
        if let Some(inst) = instances.iter_mut().find(|i| i.id == instance.id) {
            inst.last_played = Some(chrono::Utc::now().to_rfc3339());
            inst.play_time_minutes += 1;
        }
        let _ = LauncherManager::save_instances(&instances);

        Ok(format!(
            "Minecraft {} ({}) en ejecución [PID {}]",
            instance.name, instance.mc_version, pid
        ))
    }

    pub fn kill_running_game() -> Result<String, String> {
        let mut guard = RUNNING_GAME.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            *guard = None;
            crate::discord::DiscordRpcManager::restore_idle();
            return Ok("Proceso de Minecraft detenido.".to_string());
        }
        Err("No hay ningún juego en ejecución.".to_string())
    }
}
