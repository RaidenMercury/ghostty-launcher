//! Capas de la cuenta de Minecraft (Microsoft).
//!
//! Usa la API oficial que también usa Prism Launcher:
//! `GET/PUT/DELETE https://api.minecraftservices.com/minecraft/profile/capes/active`.
//! No se inventa nada ni se toca el perfil por otra vía.

use serde::Serialize;
use serde_json::{json, Value};


const PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const CAPES_URL: &str = "https://api.minecraftservices.com/minecraft/profile/capes/active";

#[derive(Debug, Serialize)]
pub struct Cape {
    pub id: String,
    pub alias: Option<String>,
    pub url: String,
    pub active: bool,
}

pub async fn list(account_id: &str) -> Result<Vec<Cape>, String> {
    let profile = fetch_profile(account_id).await?;
    Ok(parse_capes(&profile))
}

/// URL de la skin activa del perfil (Microsoft). Permite al visor 3D mostrar la
/// skin real de la cuenta en vez de un render por nick.
pub async fn skin_url(account_id: &str) -> Result<Option<String>, String> {
    let profile = fetch_profile(account_id).await?;
    Ok(profile
        .get("skins")
        .and_then(|v| v.as_array())
        .and_then(|skins| skins.first())
        .and_then(|skin| skin.get("url"))
        .and_then(|url| url.as_str())
        .map(str::to_string))
}

pub async fn set(account_id: &str, cape_id: Option<String>) -> Result<Vec<Cape>, String> {
    let client = http_client()?;
    let mut token = crate::accounts::AccountManager::ensure_access_token(account_id).await?;

    let mut response = send_set(&client, &token, cape_id.as_deref()).await?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        token = crate::accounts::AccountManager::refresh_access_token(account_id).await?;
        response = send_set(&client, &token, cape_id.as_deref()).await?;
    }

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(session_expired());
    }
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Minecraft Services rechazó el cambio de capa ({status}): {}",
            body.chars().take(200).collect::<String>()
        ));
    }

    // La respuesta ya trae el perfil actualizado.
    let profile: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(parse_capes(&profile))
}

async fn send_set(
    client: &reqwest::Client,
    token: &str,
    cape_id: Option<&str>,
) -> Result<reqwest::Response, String> {
    let request = match cape_id.map(str::trim).filter(|c| !c.is_empty()) {
        Some(id) => client
            .put(CAPES_URL)
            .bearer_auth(token)
            .json(&json!({ "capeId": id })),
        None => client.delete(CAPES_URL).bearer_auth(token),
    };
    request
        .send()
        .await
        .map_err(|e| format!("Error contactando Minecraft Services: {e}"))
}

async fn fetch_profile(account_id: &str) -> Result<Value, String> {
    let client = http_client()?;
    let mut token = crate::accounts::AccountManager::ensure_access_token(account_id).await?;

    let mut response = client
        .get(PROFILE_URL)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("Error contactando Minecraft Services: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        token = crate::accounts::AccountManager::refresh_access_token(account_id).await?;
        response = client
            .get(PROFILE_URL)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("Error contactando Minecraft Services: {e}"))?;
    }

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(session_expired());
    }
    if !response.status().is_success() {
        return Err(format!("Minecraft Services devolvió {}", response.status()));
    }

    response.json().await.map_err(|e| e.to_string())
}

fn session_expired() -> String {
    "La sesión de Microsoft expiró. Vuelve a iniciar sesión para gestionar capas.".to_string()
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("GhosttyLauncher/0.1.0 (capes)")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

fn parse_capes(profile: &Value) -> Vec<Cape> {
    profile
        .get("capes")
        .and_then(Value::as_array)
        .map(|capes| {
            capes
                .iter()
                .filter_map(|cape| {
                    Some(Cape {
                        id: cape.get("id")?.as_str()?.to_string(),
                        alias: cape
                            .get("alias")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        url: cape.get("url")?.as_str()?.to_string(),
                        active: cape
                            .get("state")
                            .and_then(Value::as_str)
                            .is_some_and(|s| s.eq_ignore_ascii_case("ACTIVE")),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::parse_capes;
    use serde_json::json;

    #[test]
    fn parses_active_and_inactive_capes() {
        let profile = json!({
            "id": "uuid",
            "capes": [
                { "id": "a", "state": "ACTIVE", "url": "https://x/a", "alias": "Minecon2012" },
                { "id": "b", "state": "INACTIVE", "url": "https://x/b" }
            ]
        });

        let capes = parse_capes(&profile);
        assert_eq!(capes.len(), 2);
        assert!(capes[0].active);
        assert_eq!(capes[0].alias.as_deref(), Some("Minecon2012"));
        assert!(!capes[1].active);
        assert_eq!(capes[1].alias, None);
    }

    #[test]
    fn missing_capes_is_empty() {
        assert!(parse_capes(&json!({ "id": "uuid" })).is_empty());
    }
}
