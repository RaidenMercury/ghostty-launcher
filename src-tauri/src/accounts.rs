use crate::launcher::LauncherManager;
use crate::models::Account;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const DEFAULT_MSA_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";

#[derive(Deserialize, Serialize, Clone)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub verification_uri: String,
    pub device_code: String,
    #[serde(default = "default_poll_interval")]
    pub interval: u64,
}

fn default_poll_interval() -> u64 {
    5
}

#[derive(Deserialize)]
struct MicrosoftTokenResponse {
    access_token: String,
}

#[derive(Serialize)]
struct ElybyPayload {
    agent: ElybyAgent,
    username: String,
    password: String,
    #[serde(rename = "clientToken")]
    client_token: String,
    #[serde(rename = "requestUser")]
    request_user: bool,
}

#[derive(Serialize)]
struct ElybyAgent {
    name: String,
    version: i32,
}

#[derive(Deserialize)]
pub struct ElybyProfile {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct ElybyResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "selectedProfile")]
    pub selected_profile: Option<ElybyProfile>,
}

pub struct AccountManager;

impl AccountManager {
    fn msa_client_id() -> String {
        std::env::var("GHOSTTY_MSA_CLIENT_ID")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_MSA_CLIENT_ID.to_string())
    }

    pub fn get_accounts_file_path() -> Result<PathBuf, String> {
        let root = LauncherManager::get_root_dir()?;
        Ok(root.join("accounts.json"))
    }

    pub fn get_tokens_file_path() -> Result<PathBuf, String> {
        let root = LauncherManager::get_root_dir()?;
        Ok(root.join("tokens.json"))
    }

    pub fn load_accounts() -> Result<Vec<Account>, String> {
        let path = Self::get_accounts_file_path()?;
        if !path.exists() {
            let default_acc = Self::create_offline_account_obj("GhostPlayer", true);
            let list = vec![default_acc];
            Self::save_accounts(&list)?;
            return Ok(list);
        }

        // Cierra la ventana de permisos heredados de versiones anteriores (0664).
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
        }

        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut accounts: Vec<Account> = serde_json::from_str(&content).unwrap_or_else(|_| {
            vec![Self::create_offline_account_obj("GhostPlayer", true)]
        });

        // Las cuentas viejas traían el token dentro de accounts.json; se migra al leer.
        if let Ok(tokens_raw) = fs::read_to_string(Self::get_tokens_file_path()?) {
            if let Ok(tokens) = serde_json::from_str::<HashMap<String, String>>(&tokens_raw) {
                for acc in &mut accounts {
                    if acc.access_token.as_deref().unwrap_or("").is_empty() {
                        acc.access_token = tokens.get(&acc.id).cloned();
                    }
                }
            }
        }
        // Migración inmediata: si quedaban tokens dentro de accounts.json, se mueven
        // a tokens.json en la primera lectura en vez de esperar al siguiente guardado.
        if accounts
            .iter()
            .any(|acc| acc.access_token.as_deref().is_some_and(|t| !t.is_empty()))
        {
            let _ = Self::save_accounts(&accounts);
        }

        Ok(accounts)
    }

    pub fn save_accounts(accounts: &[Account]) -> Result<(), String> {
        let (public, tokens) = split_tokens(accounts);
        write_private_json(&Self::get_accounts_file_path()?, &public)?;
        write_private_json(&Self::get_tokens_file_path()?, &tokens)?;
        Ok(())
    }

    pub fn create_offline_account_obj(username: &str, is_active: bool) -> Account {
        let offline_input = format!("OfflinePlayer:{}", username);
        let uuid = Uuid::new_v3(&Uuid::NAMESPACE_DNS, offline_input.as_bytes()).to_string();

        Account {
            id: Uuid::new_v4().to_string(),
            username: username.to_string(),
            uuid,
            account_type: "Offline".to_string(),
            is_active,
            skin_url: None,
            skin_model: Some("classic".to_string()),
            access_token: None,
        }
    }

    pub fn add_account(username: &str) -> Result<Vec<Account>, String> {
        let mut accounts = Self::load_accounts()?;
        for acc in &mut accounts {
            acc.is_active = false;
        }
        let new_acc = Self::create_offline_account_obj(username, true);
        accounts.push(new_acc);
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }

    pub async fn iniciar_oauth_dispositivo() -> Result<DeviceCodeResponse, String> {
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let client_id = Self::msa_client_id();
        let scopes = "XboxLive.signin offline_access";
        let params = [("client_id", client_id.as_str()), ("scope", scopes)];

        let response = client
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Error de red Microsoft: {}", e))?;

        if response.status().is_success() {
            let data: DeviceCodeResponse = response.json().await.map_err(|e| e.to_string())?;
            Ok(data)
        } else {
            let err_txt = response.text().await.unwrap_or_default();
            Err(format!(
                "No se pudo obtener el código de dispositivo de Microsoft: {}",
                err_txt
            ))
        }
    }

    pub async fn esperar_autorizacion_microsoft(
        device_code: &str,
        interval: u64,
    ) -> Result<Account, String> {
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;

        let client_id = Self::msa_client_id();
        let mut check_interval = Duration::from_secs(if interval == 0 { 5 } else { interval });
        let max_attempts = 60;

        let mut ms_access_token = String::new();

        for _ in 0..max_attempts {
            tokio::time::sleep(check_interval).await;

            let params = [
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id.as_str()),
                ("device_code", device_code),
            ];

            let response = client
                .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
                .form(&params)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = response.status();
            let body_text = response.text().await.map_err(|e| e.to_string())?;

            if status.is_success() {
                let token_data: MicrosoftTokenResponse =
                    serde_json::from_str(&body_text).map_err(|e| e.to_string())?;
                ms_access_token = token_data.access_token;
                break;
            } else if body_text.contains("authorization_pending") {
                continue;
            } else if body_text.contains("slow_down") {
                check_interval += Duration::from_secs(2);
            } else {
                return Err("El proceso de login Premium expiró o fue cancelado".to_string());
            }
        }

        if ms_access_token.is_empty() {
            return Err("Tiempo de espera agotado para la autorización de Microsoft.".to_string());
        }

        Self::exchange_ms_token_to_account(&client, &ms_access_token).await
    }

    async fn exchange_ms_token_to_account(
        client: &reqwest::Client,
        ms_access_token: &str,
    ) -> Result<Account, String> {
        let xbl_payload = json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", ms_access_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        let xbl_res: Value = client
            .post("https://user.auth.xboxlive.com/user/authenticate")
            .json(&xbl_payload)
            .send()
            .await
            .map_err(|e| format!("Error Xbox Live Auth: {}", e))?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let xbl_token = xbl_res
            .get("Token")
            .and_then(|t| t.as_str())
            .ok_or("No se recibió Token de Xbox Live")?;
        let uhs = xbl_res
            .get("DisplayClaims")
            .and_then(|d| d.get("xui"))
            .and_then(|x| x.as_array())
            .and_then(|a| a.first())
            .and_then(|f| f.get("uhs"))
            .and_then(|u| u.as_str())
            .ok_or("No se recibió UserHash (uhs) de Xbox Live")?;

        let xsts_payload = json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        });

        let xsts_res: Value = client
            .post("https://xsts.auth.xboxlive.com/xsts/authorize")
            .json(&xsts_payload)
            .send()
            .await
            .map_err(|e| format!("Error XSTS Auth: {}", e))?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let xsts_token = xsts_res
            .get("Token")
            .and_then(|t| t.as_str())
            .ok_or("Esta cuenta Microsoft no tiene un perfil de Xbox activo")?;

        let mc_login_payload = json!({
            "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
        });

        let mc_auth_res: Value = client
            .post("https://api.minecraftservices.com/authentication/login_with_xbox")
            .json(&mc_login_payload)
            .send()
            .await
            .map_err(|e| format!("Error Minecraft Services Auth: {}", e))?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let mc_access_token = mc_auth_res
            .get("access_token")
            .and_then(|t| t.as_str())
            .unwrap_or(ms_access_token)
            .to_string();

        let profile_resp = client
            .get("https://api.minecraftservices.com/minecraft/profile")
            .bearer_auth(&mc_access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let (username, formatted_uuid) = if profile_resp.status().is_success() {
            let prof: Value = profile_resp.json().await.map_err(|e| e.to_string())?;
            let name = prof
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("JugadorMSA")
                .to_string();
            let raw_id = prof.get("id").and_then(|i| i.as_str()).unwrap_or("");
            let uuid_str = if raw_id.len() == 32 {
                format!(
                    "{}-{}-{}-{}-{}",
                    &raw_id[0..8],
                    &raw_id[8..12],
                    &raw_id[12..16],
                    &raw_id[16..20],
                    &raw_id[20..32]
                )
            } else {
                Uuid::new_v4().to_string()
            };
            (name, uuid_str)
        } else {
            return Err("Tu cuenta de Microsoft fue autenticada, pero no posee una licencia activa de Minecraft Java Edition.".to_string());
        };

        let mut accounts = Self::load_accounts()?;
        for acc in &mut accounts {
            acc.is_active = false;
        }

        let new_acc = Account {
            id: format!("msa_{}", formatted_uuid),
            username: username.clone(),
            uuid: formatted_uuid,
            account_type: "Microsoft".to_string(),
            is_active: true,
            skin_url: Some(format!("mc-user:{}", username)),
            skin_model: Some("classic".to_string()),
            access_token: Some(mc_access_token),
        };

        accounts.retain(|a| a.id != new_acc.id);
        accounts.push(new_acc.clone());
        Self::save_accounts(&accounts)?;
        Ok(new_acc)
    }

    pub async fn login_elyby(
        username_or_email: &str,
        password: &str,
        totp: Option<String>,
    ) -> Result<Vec<Account>, String> {
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let final_password = if let Some(code) = totp {
            if !code.trim().is_empty() {
                format!("{}:{}", password, code.trim())
            } else {
                password.to_string()
            }
        } else {
            password.to_string()
        };

        let payload = ElybyPayload {
            agent: ElybyAgent {
                name: "Minecraft".to_string(),
                version: 1,
            },
            username: username_or_email.trim().to_string(),
            password: final_password,
            client_token: "ghostty-launcher-elyby".to_string(),
            request_user: true,
        };

        let resp = client
            .post("https://authserver.ely.by/auth/authenticate")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Error de red Ely.by: {}", e))?;

        if !resp.status().is_success() {
            return Err("Credenciales incorrectas o error en el servidor de Ely.by".to_string());
        }

        let res_json: ElybyResponse = resp.json().await.map_err(|e| e.to_string())?;
        let access_token = res_json.access_token;

        let (player_name, raw_uuid) = if let Some(prof) = res_json.selected_profile {
            (prof.name, prof.id)
        } else {
            (
                username_or_email.trim().to_string(),
                Uuid::new_v4().to_string().replace('-', ""),
            )
        };

        let formatted_uuid = if raw_uuid.len() == 32 {
            format!(
                "{}-{}-{}-{}-{}",
                &raw_uuid[0..8],
                &raw_uuid[8..12],
                &raw_uuid[12..16],
                &raw_uuid[16..20],
                &raw_uuid[20..32]
            )
        } else {
            Uuid::new_v4().to_string()
        };

        let mut accounts = Self::load_accounts()?;
        for acc in &mut accounts {
            acc.is_active = false;
        }

        let new_acc = Account {
            id: format!("elyby_{}", formatted_uuid),
            username: player_name.clone(),
            uuid: formatted_uuid,
            account_type: "ElyBy".to_string(),
            is_active: true,
            skin_url: Some(format!("mc-user:{}", player_name)),
            skin_model: Some("classic".to_string()),
            access_token: Some(access_token),
        };

        accounts.retain(|a| a.id != new_acc.id);
        accounts.push(new_acc);
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }

    pub async fn login_microsoft(identifier_or_token: &str) -> Result<Vec<Account>, String> {
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let trimmed = identifier_or_token.trim();
        if trimmed.is_empty() {
            return Err("Ingresa tu token o Gamertag de Microsoft Minecraft.".to_string());
        }

        let (username, formatted_uuid, access_token) = if trimmed.len() > 40 {
            let resp = client
                .get("https://api.minecraftservices.com/minecraft/profile")
                .bearer_auth(trimmed)
                .send()
                .await
                .map_err(|e| format!("Error conectando con Minecraft Services: {}", e))?;

            if !resp.status().is_success() {
                return Err("El token de acceso de Microsoft/Minecraft ha expirado o no es válido.".to_string());
            }

            let data: Value = resp.json().await.map_err(|e| e.to_string())?;
            let name = data
                .get("name")
                .and_then(|n| n.as_str())
                .ok_or("No se encontró perfil de Minecraft en esta cuenta Microsoft")?
                .to_string();
            let raw_id = data.get("id").and_then(|i| i.as_str()).unwrap_or("");
            let uuid_str = if raw_id.len() == 32 {
                format!(
                    "{}-{}-{}-{}-{}",
                    &raw_id[0..8],
                    &raw_id[8..12],
                    &raw_id[12..16],
                    &raw_id[16..20],
                    &raw_id[20..32]
                )
            } else {
                Uuid::new_v4().to_string()
            };
            (name, uuid_str, Some(trimmed.to_string()))
        } else {
            let mojang_url = format!(
                "https://api.mojang.com/users/profiles/minecraft/{}",
                trimmed
            );
            let mut resolved_name = trimmed.to_string();
            let mut resolved_uuid = Uuid::new_v3(
                &Uuid::NAMESPACE_DNS,
                format!("OfflinePlayer:{}", trimmed).as_bytes(),
            )
            .to_string();

            if let Ok(resp) = client.get(&mojang_url).send().await {
                if resp.status().is_success() {
                    if let Ok(data) = resp.json::<Value>().await {
                        if let Some(n) = data.get("name").and_then(|v| v.as_str()) {
                            resolved_name = n.to_string();
                        }
                        if let Some(raw_id) = data.get("id").and_then(|v| v.as_str()) {
                            if raw_id.len() == 32 {
                                resolved_uuid = format!(
                                    "{}-{}-{}-{}-{}",
                                    &raw_id[0..8],
                                    &raw_id[8..12],
                                    &raw_id[12..16],
                                    &raw_id[16..20],
                                    &raw_id[20..32]
                                );
                            }
                        }
                    }
                }
            }
            (resolved_name, resolved_uuid, Some("msa_verified_session".to_string()))
        };

        let mut accounts = Self::load_accounts()?;
        for acc in &mut accounts {
            acc.is_active = false;
        }

        let new_acc = Account {
            id: format!("msa_{}", formatted_uuid),
            username: username.clone(),
            uuid: formatted_uuid,
            account_type: "Microsoft".to_string(),
            is_active: true,
            skin_url: Some(format!("mc-user:{}", username)),
            skin_model: Some("classic".to_string()),
            access_token,
        };

        accounts.retain(|a| a.id != new_acc.id);
        accounts.push(new_acc);
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }

    pub fn set_active_account(id: &str) -> Result<Vec<Account>, String> {
        let mut accounts = Self::load_accounts()?;
        let mut found = false;
        for acc in &mut accounts {
            if acc.id == id {
                acc.is_active = true;
                found = true;
            } else {
                acc.is_active = false;
            }
        }
        if !found && !accounts.is_empty() {
            accounts[0].is_active = true;
        }
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }

    pub fn update_skin(
        id: &str,
        skin_url: Option<String>,
        skin_model: Option<String>,
    ) -> Result<Vec<Account>, String> {
        let mut accounts = Self::load_accounts()?;
        for acc in &mut accounts {
            if acc.id == id {
                acc.skin_url = skin_url.clone();
                acc.skin_model = Some(skin_model.clone().unwrap_or_else(|| "classic".to_string()));
            }
        }
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }

    pub fn remove_account(id: &str) -> Result<Vec<Account>, String> {
        let mut accounts = Self::load_accounts()?;
        accounts.retain(|a| a.id != id);
        if accounts.is_empty() {
            accounts.push(Self::create_offline_account_obj("GhostPlayer", true));
        } else if !accounts.iter().any(|a| a.is_active) {
            accounts[0].is_active = true;
        }
        Self::save_accounts(&accounts)?;
        Ok(accounts)
    }
}

/// Separa los tokens de las cuentas para que `accounts.json` no los contenga.
fn split_tokens(accounts: &[Account]) -> (Vec<Account>, HashMap<String, String>) {
    let mut public = Vec::with_capacity(accounts.len());
    let mut tokens = HashMap::new();
    for acc in accounts {
        let mut acc = acc.clone();
        if let Some(token) = acc.access_token.take() {
            if !token.is_empty() {
                tokens.insert(acc.id.clone(), token);
            }
        }
        public.push(acc);
    }
    (public, tokens)
}

/// Escribe JSON con permisos 0600 (contiene tokens de sesión).
fn write_private_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut file, content.as_bytes()).map_err(|e| e.to_string())?;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::split_tokens;
    use crate::models::Account;

    fn account(id: &str, token: Option<&str>) -> Account {
        Account {
            id: id.to_string(),
            username: "steve".into(),
            uuid: "uuid".into(),
            account_type: "Microsoft".into(),
            is_active: true,
            skin_url: None,
            skin_model: None,
            access_token: token.map(str::to_string),
        }
    }

    #[test]
    fn tokens_never_reach_accounts_json() {
        let accounts = vec![account("a", Some("secret")), account("b", None)];
        let (public, tokens) = split_tokens(&accounts);

        assert!(public.iter().all(|acc| acc.access_token.is_none()));
        assert_eq!(tokens.get("a").map(String::as_str), Some("secret"));
        assert!(!tokens.contains_key("b"));
    }
}
