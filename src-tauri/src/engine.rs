use crate::config::{get_assets_dir, get_instances_dir, get_libraries_dir, get_versions_dir};
use crate::models::{Account, Instance};
use futures_util::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangAssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: Option<u64>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangDownloadItem {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangDownloads {
    pub client: MojangDownloadItem,
    pub server: Option<MojangDownloadItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangLibraryDownloadArtifact {
    pub path: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangLibraryDownloads {
    pub artifact: Option<MojangLibraryDownloadArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangRuleOs {
    pub name: Option<String>,
    pub arch: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangRule {
    pub action: String, // "allow" or "disallow"
    pub os: Option<MojangRuleOs>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangLibrary {
    pub name: String,
    pub downloads: Option<MojangLibraryDownloads>,
    pub rules: Option<Vec<MojangRule>>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangVersionPackage {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<MojangAssetIndexRef>,
    pub assets: Option<String>,
    pub downloads: MojangDownloads,
    pub libraries: Vec<MojangLibrary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangAssetObject {
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MojangAssetIndex {
    pub objects: HashMap<String, MojangAssetObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricProfile {
    pub id: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub libraries: Vec<FabricLibrary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLibrary {
    pub name: String,
    pub url: Option<String>,
}

pub fn is_rule_allowed(rules: Option<&[MojangRule]>) -> bool {
    let rules = match rules {
        Some(r) => r,
        None => return true,
    };
    if rules.is_empty() {
        return true;
    }

    let current_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let mut allowed = false;
    for rule in rules {
        let matches_os = match &rule.os {
            Some(os) => os.name.as_deref() == Some(current_os),
            None => true,
        };

        if matches_os {
            allowed = rule.action == "allow";
        }
    }
    allowed
}

pub fn maven_to_path(name: &str) -> Option<String> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() >= 4 { Some(parts[3]) } else { None };

    let filename = if let Some(c) = classifier {
        format!("{}-{}-{}.jar", artifact, version, c)
    } else {
        format!("{}-{}.jar", artifact, version)
    };

    Some(format!("{}/{}/{}/{}", group, artifact, version, filename))
}

pub async fn fetch_version_package(mc_version: &str) -> Result<MojangVersionPackage, String> {
    let versions_dir = get_versions_dir().join(mc_version);
    fs::create_dir_all(&versions_dir)
        .map_err(|e| format!("Failed to create versions dir: {}", e))?;
    let pkg_file = versions_dir.join(format!("{}.json", mc_version));

    if pkg_file.exists() {
        if let Ok(content) = fs::read_to_string(&pkg_file) {
            if let Ok(pkg) = serde_json::from_str::<MojangVersionPackage>(&content) {
                return Ok(pkg);
            }
        }
    }

    // Get Mojang manifest to find version URL
    let manifest = crate::versions::get_mojang_manifest().await?;
    let target = manifest
        .versions
        .into_iter()
        .find(|v| v.id == mc_version)
        .ok_or_else(|| format!("Minecraft version '{}' not found in Mojang manifest", mc_version))?;

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let resp = client
        .get(&target.url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch version JSON from Mojang: {}", e))?;

    let content = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read version JSON: {}", e))?;

    let pkg: MojangVersionPackage = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse version JSON: {}", e))?;

    let _ = fs::write(pkg_file, &content);
    Ok(pkg)
}

pub async fn download_client_jar(pkg: &MojangVersionPackage) -> Result<PathBuf, String> {
    let versions_dir = get_versions_dir().join(&pkg.id);
    fs::create_dir_all(&versions_dir).map_err(|e| format!("Dir error: {}", e))?;
    let target = versions_dir.join(format!("{}.jar", pkg.id));

    if target.exists() {
        let size = fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
        if size == pkg.downloads.client.size {
            return Ok(target);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let bytes = client
        .get(&pkg.downloads.client.url)
        .send()
        .await
        .map_err(|e| format!("Failed downloading client.jar: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed reading client.jar: {}", e))?;

    fs::write(&target, bytes).map_err(|e| format!("Failed writing client.jar: {}", e))?;
    Ok(target)
}

pub async fn download_libraries(pkg: &MojangVersionPackage) -> Result<Vec<PathBuf>, String> {
    let libs_base = get_libraries_dir();
    fs::create_dir_all(&libs_base).map_err(|e| format!("Libs dir error: {}", e))?;

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let mut library_paths = Vec::new();

    for lib in &pkg.libraries {
        if !is_rule_allowed(lib.rules.as_deref()) {
            continue;
        }

        let (rel_path, url, expected_size) = if let Some(artifact) = &lib.downloads.as_ref().and_then(|d| d.artifact.as_ref()) {
            (artifact.path.clone(), artifact.url.clone(), artifact.size)
        } else if let Some(path) = maven_to_path(&lib.name) {
            let base_url = lib.url.as_deref().unwrap_or("https://libraries.minecraft.net/");
            let full_url = if base_url.ends_with('/') {
                format!("{}{}", base_url, path)
            } else {
                format!("{}/{}", base_url, path)
            };
            (path, full_url, None)
        } else {
            continue;
        };

        let target_file = libs_base.join(&rel_path);
        if let Some(parent) = target_file.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let needs_download = if target_file.exists() {
            if let Some(exp) = expected_size {
                fs::metadata(&target_file).map(|m| m.len()).unwrap_or(0) != exp
            } else {
                false
            }
        } else {
            true
        };

        if needs_download {
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = fs::write(&target_file, bytes);
                    }
                }
            }
        }

        if target_file.exists() {
            library_paths.push(target_file);
        }
    }

    Ok(library_paths)
}

pub async fn download_assets(pkg: &MojangVersionPackage) -> Result<(), String> {
    let index_ref = match &pkg.asset_index {
        Some(idx) => idx,
        None => return Ok(()),
    };

    let assets_base = get_assets_dir();
    let indexes_dir = assets_base.join("indexes");
    let objects_dir = assets_base.join("objects");
    fs::create_dir_all(&indexes_dir).map_err(|e| format!("Indexes dir error: {}", e))?;
    fs::create_dir_all(&objects_dir).map_err(|e| format!("Objects dir error: {}", e))?;

    let index_file = indexes_dir.join(format!("{}.json", index_ref.id));

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let index_json = if index_file.exists() {
        fs::read_to_string(&index_file).map_err(|e| format!("Read index error: {}", e))?
    } else {
        let content = client
            .get(&index_ref.url)
            .send()
            .await
            .map_err(|e| format!("Download asset index error: {}", e))?
            .text()
            .await
            .map_err(|e| format!("Read asset index error: {}", e))?;
        let _ = fs::write(&index_file, &content);
        content
    };

    let asset_index: MojangAssetIndex = serde_json::from_str(&index_json)
        .map_err(|e| format!("Parse asset index error: {}", e))?;

    // Collect missing asset tasks
    let mut tasks = Vec::new();
    for (_, obj) in asset_index.objects {
        if obj.hash.len() < 2 {
            continue;
        }
        let prefix = &obj.hash[..2];
        let target = objects_dir.join(prefix).join(&obj.hash);
        let exists = target.exists() && fs::metadata(&target).map(|m| m.len()).unwrap_or(0) == obj.size;
        if !exists {
            let url = format!("https://resources.download.minecraft.net/{}/{}", prefix, obj.hash);
            tasks.push((target, url));
        }
    }

    if tasks.is_empty() {
        return Ok(());
    }

    // Parallel streaming downloads with concurrency 16
    let stream = stream::iter(tasks).map(|(target, url)| {
        let client = client.clone();
        async move {
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = fs::write(&target, bytes);
                    }
                }
            }
        }
    });

    stream.buffer_unordered(16).collect::<Vec<()>>().await;
    Ok(())
}

pub async fn resolve_fabric(mc_version: &str) -> Result<(Vec<PathBuf>, String), String> {
    let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}/profile/json", mc_version);
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Fabric profile query error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Fabric profile not found for {}", mc_version));
    }

    let profile: FabricProfile = resp
        .json()
        .await
        .map_err(|e| format!("Parse fabric profile error: {}", e))?;

    let libs_base = get_libraries_dir();
    let mut paths = Vec::new();

    for lib in profile.libraries {
        if let Some(rel_path) = maven_to_path(&lib.name) {
            let target = libs_base.join(&rel_path);
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if !target.exists() {
                let base_url = lib.url.as_deref().unwrap_or("https://maven.fabricmc.net/");
                let download_url = if base_url.ends_with('/') {
                    format!("{}{}", base_url, rel_path)
                } else {
                    format!("{}/{}", base_url, rel_path)
                };

                if let Ok(r) = client.get(&download_url).send().await {
                    if r.status().is_success() {
                        if let Ok(bytes) = r.bytes().await {
                            let _ = fs::write(&target, bytes);
                        }
                    }
                }
            }

            if target.exists() {
                paths.push(target);
            }
        }
    }

    Ok((paths, profile.main_class))
}

pub async fn launch_game_real(
    instance: &mut Instance,
    account: &Account,
) -> Result<String, String> {
    let now = chrono::Local::now().to_rfc3339();
    instance.last_played = Some(now);
    let _ = crate::instances::update_instance(instance.clone());

    let instance_dir = get_instances_dir().join(&instance.id);
    let assets_dir = get_assets_dir();

    // 1. Fetch Mojang version package
    let pkg = fetch_version_package(&instance.mc_version).await?;

    // 2. Download client.jar
    let client_jar = download_client_jar(&pkg).await?;

    // 3. Download Mojang libraries
    let mut all_libraries = download_libraries(&pkg).await?;

    // 4. Determine main class & modloader
    let main_class = if instance.loader.to_lowercase() == "fabric" {
        match resolve_fabric(&instance.mc_version).await {
            Ok((fabric_libs, fabric_main)) => {
                all_libraries.extend(fabric_libs);
                fabric_main
            }
            Err(_) => pkg.main_class.clone(),
        }
    } else {
        pkg.main_class.clone()
    };

    // 5. Download assets in background / check
    let _ = download_assets(&pkg).await;

    // 6. Build Classpath
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    let mut cp_entries: Vec<String> = all_libraries
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    cp_entries.push(client_jar.to_string_lossy().to_string());
    let classpath = cp_entries.join(separator);

    // 7. Prepare Process & Arguments
    let java_bin = instance.java_path.clone().unwrap_or_else(|| "java".to_string());
    let asset_index_id = pkg.asset_index.map(|i| i.id).unwrap_or_else(|| "legacy".to_string());

    let mut cmd = Command::new(&java_bin);
    cmd.current_dir(&instance_dir);

    // JVM Args
    cmd.arg(format!("-Xms{}M", instance.memory_min_mb));
    cmd.arg(format!("-Xmx{}M", instance.memory_max_mb));

    if let Some(extra_jvm) = &instance.jvm_args {
        for arg in extra_jvm.split_whitespace() {
            cmd.arg(arg);
        }
    }

    // Classpath
    cmd.arg("-cp").arg(&classpath);
    cmd.arg(&main_class);

    // Game Arguments
    cmd.arg("--username").arg(&account.username);
    cmd.arg("--version").arg(&instance.mc_version);
    cmd.arg("--gameDir").arg(instance_dir.to_string_lossy().to_string());
    cmd.arg("--assetsDir").arg(assets_dir.to_string_lossy().to_string());
    cmd.arg("--assetIndex").arg(&asset_index_id);
    cmd.arg("--uuid").arg(&account.uuid);
    cmd.arg("--accessToken").arg(account.access_token.as_deref().unwrap_or("0"));
    cmd.arg("--userType").arg("mojang");
    cmd.arg("--versionType").arg("GhosttyLauncher");

    // Pre-launch hook command if specified
    if let Some(pre) = &instance.pre_launch_command {
        if !pre.trim().is_empty() {
            let _ = Command::new("sh").arg("-c").arg(pre).status();
        }
    }

    // Spawn Minecraft Java as detached child process
    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            Ok(format!(
                "Minecraft Java iniciado con éxito (PID: {}).\nVersión: {} ({})\nJugador: {}\nDirectorio: {}",
                pid,
                instance.mc_version,
                instance.loader,
                account.username,
                instance_dir.display()
            ))
        }
        Err(e) => Err(format!(
            "Fallo al ejecutar el binario Java '{}': {}. Revisa tu ruta de Java en Ajustes.",
            java_bin, e
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_rule_allowed() {
        assert!(is_rule_allowed(None));
        assert!(is_rule_allowed(Some(&[])));

        let linux_allow = vec![MojangRule {
            action: "allow".to_string(),
            os: Some(MojangRuleOs {
                name: Some("linux".to_string()),
                arch: None,
                version: None,
            }),
        }];

        let windows_only_allow = vec![MojangRule {
            action: "allow".to_string(),
            os: Some(MojangRuleOs {
                name: Some("windows".to_string()),
                arch: None,
                version: None,
            }),
        }];

        if cfg!(target_os = "linux") {
            assert!(is_rule_allowed(Some(&linux_allow)));
            assert!(!is_rule_allowed(Some(&windows_only_allow)));
        }
    }

    #[test]
    fn test_maven_to_path() {
        assert_eq!(
            maven_to_path("org.ow2.asm:asm:9.7.1"),
            Some("org/ow2/asm/asm/9.7.1/asm-9.7.1.jar".to_string())
        );

        assert_eq!(
            maven_to_path("org.lwjgl:lwjgl:3.3.3:natives-linux"),
            Some("org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar".to_string())
        );

        assert_eq!(maven_to_path("invalid-coord"), None);
    }
}

