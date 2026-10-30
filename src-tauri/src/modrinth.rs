use crate::config::get_instances_dir;
use crate::models::{ModrinthSearchHit, ModrinthSearchResult, ModrinthVersion};
use std::fs;

const MODRINTH_API: &str = "https://api.modrinth.com/v2";

pub async fn search_modrinth(
    query: &str,
    loader: Option<&str>,
    game_version: Option<&str>,
    project_type: &str, // "mod" or "modpack"
    limit: u32,
    offset: u32,
) -> Result<ModrinthSearchResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let mut facets = vec![format!("[\"project_type:{}\"]", project_type)];

    if let Some(l) = loader {
        if !l.is_empty() && l != "vanilla" {
            facets.push(format!("[\"categories:{}\"]", l.to_lowercase()));
        }
    }

    if let Some(v) = game_version {
        if !v.is_empty() {
            facets.push(format!("[\"versions:{}\"]", v));
        }
    }

    let facets_query = format!("[{}]", facets.join(","));

    let url = format!(
        "{}/search?query={}&facets={}&limit={}&offset={}",
        MODRINTH_API,
        urlencoding::encode(query),
        urlencoding::encode(&facets_query),
        limit,
        offset
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Modrinth search request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Modrinth API error status: {}", resp.status()));
    }

    #[derive(serde::Deserialize)]
    struct RawHit {
        project_id: String,
        slug: String,
        title: String,
        description: String,
        categories: Option<Vec<String>>,
        icon_url: Option<String>,
        author: String,
        downloads: u64,
        follows: u64,
        project_type: String,
    }

    #[derive(serde::Deserialize)]
    struct RawSearchResponse {
        hits: Vec<RawHit>,
        total_hits: u64,
    }

    let raw: RawSearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Modrinth JSON: {}", e))?;

    let hits = raw
        .hits
        .into_iter()
        .map(|h| ModrinthSearchHit {
            project_id: h.project_id,
            slug: h.slug,
            title: h.title,
            description: h.description,
            categories: h.categories.unwrap_or_default(),
            icon_url: h.icon_url,
            author: h.author,
            downloads: h.downloads,
            follows: h.follows,
            project_type: h.project_type,
        })
        .collect();

    Ok(ModrinthSearchResult {
        hits,
        total_hits: raw.total_hits,
    })
}

pub async fn get_project_versions(
    project_id: &str,
    loader: Option<&str>,
    game_version: Option<&str>,
) -> Result<Vec<ModrinthVersion>, String> {
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let mut query_params = Vec::new();
    if let Some(l) = loader {
        if !l.is_empty() && l != "vanilla" {
            query_params.push(format!("loaders=[\"{}\"]", l.to_lowercase()));
        }
    }
    if let Some(v) = game_version {
        if !v.is_empty() {
            query_params.push(format!("game_versions=[\"{}\"]", v));
        }
    }

    let qs = if query_params.is_empty() {
        "".to_string()
    } else {
        format!("?{}", query_params.join("&"))
    };

    let url = format!("{}/project/{}/version{}", MODRINTH_API, project_id, qs);

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to get project versions: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Failed with status: {}", resp.status()));
    }

    let versions: Vec<ModrinthVersion> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse versions: {}", e))?;

    Ok(versions)
}

pub async fn download_and_install_mod(
    instance_id: &str,
    download_url: &str,
    filename: &str,
) -> Result<String, String> {
    let instance_dir = get_instances_dir().join(instance_id);
    if !instance_dir.exists() {
        return Err("Instance directory does not exist".to_string());
    }

    let mods_dir = instance_dir.join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| format!("Failed to create mods dir: {}", e))?;

    let target_file = mods_dir.join(filename);

    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let bytes = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded bytes: {}", e))?;

    fs::write(&target_file, bytes)
        .map_err(|e| format!("Failed to save mod file: {}", e))?;

    Ok(target_file.to_string_lossy().to_string())
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.bytes() {
            match b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(b as char)
                }
                _ => encoded.push_str(&format!("%{:02X}", b)),
            }
        }
        encoded
    }
}

