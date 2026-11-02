//! Descarga de JRE de Azul Zulu e instalación en el directorio de runtimes.

use std::fs;
use std::io::Write;
use std::path::Path;

use crate::java::adoptium::{extract, make_executable, stem};
use crate::java::{find_java_binary, JavaDetector};
use crate::launcher::LauncherManager;
use crate::models::SystemJavaInfo;

pub async fn install(major: u32) -> Result<SystemJavaInfo, String> {
    let os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x64"
    };
    let ext = if cfg!(windows) { "zip" } else { "tar.gz" };

    let api = format!(
        "https://api.azul.com/metadata/v1/zulu/packages/?os={os}&arch={arch}&archive_type={ext}&java_version={major}&page_size=1"
    );
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (zulu-download)")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let packages: serde_json::Value = client
        .get(&api)
        .send()
        .await
        .map_err(|e| format!("No se pudo consultar la API de Azul Zulu: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Respuesta de Azul Zulu no válida: {e}"))?;

    let pkg = packages
        .get(0)
        .ok_or_else(|| format!("Azul Zulu no tiene paquetes disponibles para Java {major} en esta plataforma"))?;

    let link = pkg
        .get("download_url")
        .and_then(|v| v.as_str())
        .ok_or("Azul Zulu: paquete sin URL de descarga")?;
    let name = pkg
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("zulu-package.tar.gz");

    let root = LauncherManager::get_root_dir()?.join("runtimes");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let archive = root.join(format!(".download-{name}"));
    download_file(&client, link, &archive).await?;

    let dest = root.join(stem(name));
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    extract(&archive, &dest, name)?;
    let _ = fs::remove_file(&archive);

    let binary = find_java_binary(&dest, 6).ok_or("El paquete de Azul Zulu no contiene bin/java")?;
    make_executable(&binary)?;

    JavaDetector::probe(&binary).ok_or_else(|| {
        format!(
            "Java se instaló en {} pero no respondió a -version",
            binary.display()
        )
    })
}

async fn download_file(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Fallo de red descargando Azul Zulu: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("HTTP {} descargando Java de Azul Zulu", response.status()));
    }

    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Descarga de Azul Zulu interrumpida: {e}"))?
    {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

