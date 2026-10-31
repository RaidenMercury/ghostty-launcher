use crate::models::{LatestVersions, MojangManifest, VersionEntry};
use std::collections::HashSet;

pub struct VersionFetcher;

impl VersionFetcher {
    pub async fn fetch_mojang_manifest() -> Result<MojangManifest, String> {
        let url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<MojangManifest>().await {
                    Ok(mut manifest) => {
                        let mut seen = HashSet::new();
                        manifest.versions.retain(|v| seen.insert(v.id.clone()));
                        Ok(manifest)
                    }
                    Err(_) => Ok(Self::fallback_manifest()),
                }
            }
            _ => Ok(Self::fallback_manifest()),
        }
    }

    pub fn fallback_manifest() -> MojangManifest {
        MojangManifest {
            latest: LatestVersions {
                release: "1.21.4".to_string(),
                snapshot: "25w06a".to_string(),
            },
            versions: vec![
                VersionEntry {
                    id: "1.21.4".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2024-12-03T10:00:00Z".to_string(),
                    release_time: "2024-12-03T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.21.1".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2024-08-08T10:00:00Z".to_string(),
                    release_time: "2024-08-08T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.20.4".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2023-12-07T10:00:00Z".to_string(),
                    release_time: "2023-12-07T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.20.1".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2023-06-12T10:00:00Z".to_string(),
                    release_time: "2023-06-12T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.19.2".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2022-08-05T10:00:00Z".to_string(),
                    release_time: "2022-08-05T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.18.2".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2022-02-28T10:00:00Z".to_string(),
                    release_time: "2022-02-28T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.16.5".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2021-01-15T10:00:00Z".to_string(),
                    release_time: "2021-01-15T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.12.2".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2017-09-18T10:00:00Z".to_string(),
                    release_time: "2017-09-18T10:00:00Z".to_string(),
                },
                VersionEntry {
                    id: "1.8.9".to_string(),
                    version_type: "release".to_string(),
                    url: "".to_string(),
                    time: "2015-12-03T10:00:00Z".to_string(),
                    release_time: "2015-12-03T10:00:00Z".to_string(),
                },
            ],
        }
    }
}
