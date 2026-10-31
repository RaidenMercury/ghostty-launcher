//! Instalación headless de Forge y NeoForge.
//!
//! Descarga el instalador oficial y lo ejecuta con el JRE gestionado
//! (`--installClient`), que deja el perfil en `versions/<id>/<id>.json` con
//! `inheritsFrom` a la versión vanilla. El motor lo resuelve con `game::version`.

use std::path::Path;
use std::process::Command;

use serde_json::Value;

use crate::java::JavaDetector;
use crate::launcher::LauncherManager;

pub struct ForgeInstaller;

impl ForgeInstaller {
    /// Devuelve el id de versión instalado (p. ej. `1.20.1-forge-47.2.0`).
    pub async fn install(
        mc_version: &str,
        loader: &str,
        requested: Option<&str>,
    ) -> Result<String, String> {
        let loader = loader.to_ascii_lowercase();
        if loader != "forge" && loader != "neoforge" {
            return Err(format!("Loader '{loader}' no es Forge ni NeoForge"));
        }

        let root = LauncherManager::get_root_dir()?;
        for dir in ["versions", "libraries", "caches"] {
            std::fs::create_dir_all(root.join(dir)).map_err(|e| e.to_string())?;
        }
        ensure_launcher_profiles(&root)?;
        ensure_vanilla(&root, mc_version).await?;

        let version = match requested.map(str::trim).filter(|v| !v.is_empty()) {
            Some(v) => v.to_string(),
            None => latest_version(mc_version, &loader).await?,
        };

        let (url, file_name) = installer_url(mc_version, &loader, &version)?;
        let installer = root.join("caches").join(&file_name);
        download(&url, &installer).await?;

        let java = find_java(required_java_major(mc_version))?;
        let java_for_log = java.clone();
        let installer_for_log = installer.clone();
        let root_for_log = root.clone();

        // El instalador descarga librerías y ejecuta processors: puede tardar.
        let output = tokio::task::spawn_blocking(move || {
            Command::new(&java_for_log)
                .arg("-jar")
                .arg(&installer_for_log)
                .arg("--installClient")
                .current_dir(&root_for_log)
                .output()
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("No se pudo ejecutar el instalador: {e}"))?;

        let _ = std::fs::remove_file(&installer);

        let id = if loader == "forge" {
            format!("{mc_version}-forge-{version}")
        } else {
            format!("neoforge-{version}")
        };

        let profile = root.join("versions").join(&id).join(format!("{id}.json"));
        if !profile.exists() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let tail: String = stderr.lines().rev().take(12).collect::<Vec<_>>().join("\n");
            return Err(format!(
                "El instalador de {loader} terminó sin crear {}. Salida:\n{tail}",
                profile.display()
            ));
        }

        Ok(id)
    }
}

fn ensure_launcher_profiles(root: &Path) -> Result<(), String> {
    let path = root.join("launcher_profiles.json");
    if !path.exists() {
        std::fs::write(&path, r#"{"profiles":{},"settings":{},"version":3}"#)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

async fn ensure_vanilla(root: &Path, mc_version: &str) -> Result<(), String> {
    let versions_dir = root.join("versions").join(mc_version);
    std::fs::create_dir_all(&versions_dir).map_err(|e| e.to_string())?;

    let json_path = versions_dir.join(format!("{mc_version}.json"));
    let jar_path = versions_dir.join(format!("{mc_version}.jar"));

    if json_path.exists() && jar_path.exists() {
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (forge-install)")
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let manifest: Value = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| format!("No se pudo leer el manifiesto de Mojang: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let entry = manifest
        .get("versions")
        .and_then(Value::as_array)
        .and_then(|list| list.iter().find(|v| v.get("id").and_then(Value::as_str) == Some(mc_version)))
        .ok_or_else(|| format!("La versión {mc_version} no existe en Mojang"))?;

    let url = entry.get("url").and_then(Value::as_str).ok_or("Entrada sin URL")?;
    download(url, &json_path).await?;

    let json: Value = serde_json::from_str(
        &std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    let client_url = json
        .get("downloads")
        .and_then(|d| d.get("client"))
        .and_then(|c| c.get("url"))
        .and_then(Value::as_str)
        .ok_or("La versión no tiene descarga de cliente")?;

    if !jar_path.exists() {
        download(client_url, &jar_path).await?;
    }
    Ok(())
}

async fn latest_version(mc_version: &str, loader: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (loader-meta)")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    if loader == "forge" {
        let promos: Value = client
            .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
            .send()
            .await
            .map_err(|e| format!("No se pudo consultar Forge: {e}"))?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        let promos = promos.get("promos").cloned().unwrap_or(Value::Null);
        for key in [format!("{mc_version}-recommended"), format!("{mc_version}-latest")] {
            if let Some(v) = promos.get(&key).and_then(Value::as_str) {
                return Ok(v.to_string());
            }
        }
        return Err(format!("Forge no publica versión para {mc_version}"));
    }

    let xml = client
        .get("https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml")
        .send()
        .await
        .map_err(|e| format!("No se pudo consultar NeoForge: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let prefix = neoforge_prefix(mc_version)
        .ok_or_else(|| format!("No sé qué versión de NeoForge corresponde a {mc_version}"))?;
    let mut versions: Vec<String> = xml
        .split("<version>")
        .skip(1)
        .filter_map(|chunk| chunk.split("</version>").next())
        .map(str::trim)
        .filter(|v| v.starts_with(&prefix))
        .map(str::to_string)
        .collect();
    versions.sort_by(|a, b| version_key(a).cmp(&version_key(b)));
    versions
        .pop()
        .ok_or_else(|| format!("NeoForge no publica versión para {mc_version}"))
}

fn neoforge_prefix(mc_version: &str) -> Option<String> {
    let parts: Vec<&str> = mc_version.split('.').collect();
    if parts.len() < 2 {
        return None;
    }
    let minor = parts[1];
    let patch = parts.get(2).copied().unwrap_or("0");
    Some(format!("{minor}.{patch}."))
}

fn version_key(v: &str) -> Vec<u32> {
    v.split(|c: char| !c.is_ascii_digit())
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse().ok())
        .collect()
}

fn installer_url(mc_version: &str, loader: &str, version: &str) -> Result<(String, String), String> {
    if loader == "forge" {
        let coord = format!("{mc_version}-{version}");
        Ok((
            format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{coord}/forge-{coord}-installer.jar"
            ),
            format!("forge-{coord}-installer.jar"),
        ))
    } else {
        Ok((
            format!(
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar"
            ),
            format!("neoforge-{version}-installer.jar"),
        ))
    }
}

fn required_java_major(mc_version: &str) -> u32 {
    let parts: Vec<u32> = mc_version
        .split('.')
        .filter_map(|p| p.parse().ok())
        .collect();
    match parts.as_slice() {
        [1, minor, ..] if *minor >= 21 => 21,
        [1, minor, ..] if *minor >= 17 => 17,
        _ => 8,
    }
}

fn find_java(min_major: u32) -> Result<std::path::PathBuf, String> {
    let mut runtimes = JavaDetector::detect();
    runtimes.sort_by_key(|r| r.major_version);
    runtimes
        .iter()
        .find(|r| r.major_version >= min_major)
        .or_else(|| runtimes.first())
        .map(|r| std::path::PathBuf::from(&r.path))
        .ok_or_else(|| {
            format!(
                "No hay Java instalado. Instala un JRE {min_major}+ desde Ajustes → Java Runtime."
            )
        })
}

async fn download(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Fallo de red: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {} descargando {url}", response.status()));
    }

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{neoforge_prefix, required_java_major, version_key};

    #[test]
    fn maps_minecraft_to_neoforge_prefix() {
        assert_eq!(neoforge_prefix("1.21.1").as_deref(), Some("21.1."));
        assert_eq!(neoforge_prefix("1.20.4").as_deref(), Some("20.4."));
        assert_eq!(neoforge_prefix("1.21").as_deref(), Some("21.0."));
    }

    #[test]
    fn picks_java_per_minecraft_version() {
        assert_eq!(required_java_major("1.20.1"), 17);
        assert_eq!(required_java_major("1.21.4"), 21);
        assert_eq!(required_java_major("1.12.2"), 8);
    }

    #[test]
    fn sorts_versions_numerically() {
        let mut versions = vec!["21.1.9".to_string(), "21.1.10".to_string(), "21.1.2".to_string()];
        versions.sort_by(|a, b| version_key(a).cmp(&version_key(b)));
        assert_eq!(versions.last().unwrap(), "21.1.10");
    }
}
