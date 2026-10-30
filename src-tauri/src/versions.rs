use crate::config::get_cache_dir;
use crate::models::{MojangLatest, MojangManifest, MojangVersion};
use serde::{Deserialize, Serialize};
use std::fs;

const MOJANG_MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLoaderInfo {
    pub separator: Option<String>,
    pub build: u32,
    pub maven: String,
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLoaderResponseItem {
    pub loader: FabricLoaderInfo,
}

pub async fn get_mojang_manifest() -> Result<MojangManifest, String> {
    let cache_file = get_cache_dir().join("mojang_manifest.json");

    // Check if cached manifest exists and is less than 6 hours old
    if cache_file.exists() {
        if let Ok(metadata) = fs::metadata(&cache_file) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(elapsed) = modified.elapsed() {
                    if elapsed.as_secs() < 6 * 3600 {
                        if let Ok(content) = fs::read_to_string(&cache_file) {
                            if let Ok(manifest) = serde_json::from_str::<MojangManifest>(&content) {
                                return Ok(manifest);
                            }
                        }
                    }
                }
            }
        }
    }

    // Fetch from Mojang
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Failed to build reqwest client: {}", e))?;

    let resp = client
        .get(MOJANG_MANIFEST_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Mojang manifest: {}", e))?;

    let manifest: MojangManifest = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Mojang manifest JSON: {}", e))?;

    // Save to cache asynchronously
    if let Ok(json) = serde_json::to_string(&manifest) {
        let _ = fs::write(cache_file, json);
    }

    Ok(manifest)
}

pub async fn get_fabric_loaders_for_mc(mc_version: &str) -> Result<Vec<String>, String> {
    let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", mc_version);
    let client = reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0")
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to query Fabric meta: {}", e))?;

    if !resp.status().is_success() {
        return Ok(vec!["0.16.10".to_string(), "0.16.9".to_string()]);
    }

    let items: Vec<FabricLoaderResponseItem> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Fabric loaders: {}", e))?;

    let versions = items.into_iter().map(|item| item.loader.version).collect();
    Ok(versions)
}

pub fn get_fallback_manifest() -> MojangManifest {
    MojangManifest {
        latest: MojangLatest {
            release: "1.21.4".to_string(),
            snapshot: "25w07a".to_string(),
        },
        versions: vec![
            MojangVersion {
                id: "1.21.4".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2024-12-03".to_string(),
            },
            MojangVersion {
                id: "1.21.1".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2024-08-08".to_string(),
            },
            MojangVersion {
                id: "1.20.1".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2023-06-12".to_string(),
            },
            MojangVersion {
                id: "1.19.4".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2023-03-14".to_string(),
            },
            MojangVersion {
                id: "1.16.5".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2021-01-15".to_string(),
            },
            MojangVersion {
                id: "1.12.2".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2017-09-18".to_string(),
            },
            MojangVersion {
                id: "1.7.10".to_string(),
                version_type: "release".to_string(),
                url: "".to_string(),
                time: "".to_string(),
                release_time: "2014-06-26".to_string(),
            },
        ],
    }
}
