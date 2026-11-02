//! Descarga de JRE de Eclipse Temurin (Adoptium) verificados por SHA-256.
//!
//! Se instalan en `<data>/runtimes/<paquete>/` y se devuelve el binario ya sondeado,
//! para que Ajustes pueda seleccionarlo sin reiniciar.

use std::fs;
use std::io::Write;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::java::{find_java_binary, JavaDetector};
use crate::launcher::LauncherManager;
use crate::models::SystemJavaInfo;

/// Versiones mayores que Adoptium publica hoy (para el selector de Ajustes).
pub async fn available_releases() -> Result<Vec<u32>, String> {
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (adoptium-releases)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let info: serde_json::Value = client
        .get("https://api.adoptium.net/v3/info/available_releases")
        .send()
        .await
        .map_err(|e| format!("No se pudo consultar Adoptium: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Respuesta de Adoptium ilegible: {e}"))?;

    let mut releases: Vec<u32> = info
        .get("available_releases")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_u64())
                .map(|v| v as u32)
                .collect()
        })
        .unwrap_or_default();

    if releases.is_empty() {
        return Err("Adoptium no devolvió versiones disponibles".to_string());
    }
    releases.sort_unstable();
    Ok(releases)
}

pub async fn install(major: u32) -> Result<SystemJavaInfo, String> {
    let os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x64"
    };

    let api = format!(
        "https://api.adoptium.net/v3/assets/latest/{major}/hotspot\
         ?architecture={arch}&image_type=jre&os={os}&vendor=eclipse"
    );
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (adoptium-download)")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let assets: serde_json::Value = client
        .get(&api)
        .send()
        .await
        .map_err(|e| format!("No se pudo consultar Adoptium: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Respuesta de Adoptium ilegible: {e}"))?;

    let package = assets
        .get(0)
        .and_then(|a| a.get("binary"))
        .and_then(|b| b.get("package"))
        .ok_or("Adoptium no devolvió paquetes para esta plataforma")?;

    let link = package
        .get("link")
        .and_then(|v| v.as_str())
        .ok_or("Paquete sin URL de descarga")?;
    let checksum = package
        .get("checksum")
        .and_then(|v| v.as_str())
        .ok_or("Paquete sin checksum")?
        .to_lowercase();
    let name = package
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Paquete sin nombre")?;

    let root = LauncherManager::get_root_dir()?.join("runtimes");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let archive = root.join(format!(".download-{name}"));
    download_verified(&client, link, &archive, &checksum).await?;

    let dest = root.join(stem(name));
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    extract(&archive, &dest, name)?;
    let _ = fs::remove_file(&archive);

    let binary = find_java_binary(&dest, 6).ok_or("El paquete no contiene bin/java")?;
    make_executable(&binary)?;

    JavaDetector::probe(&binary).ok_or_else(|| {
        format!(
            "Java se instaló en {} pero no respondió a -version",
            binary.display()
        )
    })
}

async fn download_verified(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    expected_sha256: &str,
) -> Result<(), String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Fallo de red descargando Java: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {} descargando Java", response.status()));
    }

    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Descarga interrumpida: {e}"))?
    {
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }
    file.flush().map_err(|e| e.to_string())?;

    let digest = format!("{:x}", hasher.finalize());
    if digest != expected_sha256 {
        let _ = fs::remove_file(dest);
        return Err(format!(
            "Checksum inválido (esperado {expected_sha256}, obtenido {digest}). Descarga descartada."
        ));
    }
    Ok(())
}

pub(crate) fn extract(archive: &Path, dest: &Path, name: &str) -> Result<(), String> {
    if name.ends_with(".zip") {
        let file = fs::File::open(archive).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
            // `enclosed_name` descarta rutas con .. o absolutas.
            let Some(rel) = entry.enclosed_name() else {
                continue;
            };
            let out = dest.join(rel);
            if entry.is_dir() {
                fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = out.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut target = fs::File::create(&out).map_err(|e| e.to_string())?;
                std::io::copy(&mut entry, &mut target).map_err(|e| e.to_string())?;
            }
        }
    } else {
        let file = fs::File::open(archive).map_err(|e| e.to_string())?;
        let decoder = flate2::read::GzDecoder::new(file);
        let mut tar = tar::Archive::new(decoder);
        for entry in tar.entries().map_err(|e| e.to_string())? {
            let mut entry = entry.map_err(|e| e.to_string())?;
            entry.unpack_in(dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub(crate) fn stem(name: &str) -> String {
    name.trim_end_matches(".tar.gz")
        .trim_end_matches(".zip")
        .to_string()
}

pub(crate) fn make_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    let _ = path;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::stem;

    #[test]
    fn strips_archive_extensions() {
        assert_eq!(
            stem("OpenJDK21U-jre_x64_linux_hotspot_21.0.13_9.tar.gz"),
            "OpenJDK21U-jre_x64_linux_hotspot_21.0.13_9"
        );
        assert_eq!(stem("OpenJDK21U-jre_x64_windows_hotspot.zip"), "OpenJDK21U-jre_x64_windows_hotspot");
    }
}
