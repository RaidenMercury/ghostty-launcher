//! Capas de la cuenta de Minecraft (Microsoft).
//!
//! Usa la API oficial que también usa Prism Launcher:
//! `GET/PUT/DELETE https://api.minecraftservices.com/minecraft/profile/capes/active`.
//! No se inventa nada ni se toca el perfil por otra vía.

use serde::Serialize;
use serde_json::{json, Value};

use crate::accounts::AccountManager;

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
    let (_, profile) = fetch_profile(account_id).await?;
    Ok(parse_capes(&profile))
}

pub async fn set(account_id: &str, cape_id: Option<String>) -> Result<Vec<Cape>, String> {
    let token = access_token(account_id)?;
    let client = http_client()?;

    let request = match cape_id.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
        Some(id) => client.put(CAPES_URL).bearer_auth(&token).json(&json!({ "capeId": id })),
        None => client.delete(CAPES_URL).bearer_auth(&token),
    };

    let response = request.send().await.map_err(|e| format!("Error contactando Minecraft Services: {e}"))?;
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

async fn fetch_profile(account_id: &str) -> Result<(String, Value), String> {
    let token = access_token(account_id)?;
    let client = http_client()?;

    let response = client
        .get(PROFILE_URL)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("Error contactando Minecraft Services: {e}"))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(session_expired());
    }
    if !response.status().is_success() {
        return Err(format!("Minecraft Services devolvió {}", response.status()));
    }

    let profile: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok((token, profile))
}

fn access_token(account_id: &str) -> Result<String, String> {
    let accounts = AccountManager::load_accounts()?;
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or("La cuenta no existe")?;

    if !account.account_type.eq_ignore_ascii_case("Microsoft") {
        return Err("Las capas solo se pueden gestionar en cuentas de Microsoft.".to_string());
    }

    account
        .access_token
        .filter(|t| !t.is_empty())
        .ok_or_else(session_expired)
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
