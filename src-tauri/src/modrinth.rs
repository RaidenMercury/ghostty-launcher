use crate::instances::InstanceManager;
use crate::models::ModFileInfo;
use serde::{Deserialize, Serialize};
use std::fs;

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
pub struct ModrinthVersion {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModrinthFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: u64,
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

impl ModrinthClient {
    fn get_http_client() -> Result<reqwest::Client, String> {
        reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0 (github.com/ghostty-launcher)")
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
        let mut url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);

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

        let versions: Vec<ModrinthVersion> = res
            .json()
            .await
            .map_err(|e| format!("Error leyendo versiones: {}", e))?;

        Ok(versions)
    }

    pub async fn install_mod_file(
        instance_id: &str,
        download_url: &str,
        filename: &str,
    ) -> Result<ModFileInfo, String> {
        let client = Self::get_http_client()?;
        let mods_dir = InstanceManager::get_mods_dir(instance_id)?;
        let dest_path = mods_dir.join(filename);

        let res = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Fallo al descargar mod: {}", e))?;

        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("Error leyendo bytes del mod: {}", e))?;

        fs::write(&dest_path, &bytes).map_err(|e| format!("Error guardando archivo .jar: {}", e))?;

        Ok(ModFileInfo {
            filename: filename.to_string(),
            enabled: filename.ends_with(".jar"),
            size: bytes.len() as u64,
        })
    }
}
