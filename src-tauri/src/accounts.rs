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
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

/// Entrada de tokens por cuenta. Admite el formato viejo (string) al leer.
#[derive(Serialize, Deserialize, Clone, Default)]
struct TokenEntry {
    #[serde(default)]
    access: Option<String>,
    #[serde(default)]
    refresh: Option<String>,
    #[serde(default)]
    expires_at: Option<i64>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StoredToken {
    Legacy(String),
    Full(TokenEntry),
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

        // Solo si el JSON de cuentas traía tokens dentro hay algo que migrar; tras
        // hidratar desde tokens.json todas las cuentas tienen token y el flag mentiría.
        let had_inline_tokens = accounts
            .iter()
            .any(|acc| acc.access_token.as_deref().is_some_and(|t| !t.is_empty()));

        // Las cuentas viejas traían el token dentro de accounts.json; se migra al leer.
        if let Ok(entries) = Self::load_token_entries() {
            for acc in &mut accounts {
                if acc.access_token.as_deref().unwrap_or("").is_empty() {
                    acc.access_token = entries.get(&acc.id).and_then(|e| e.access.clone());
                }
            }
        }

        if had_inline_tokens {
            let _ = Self::save_accounts(&accounts);
        }

        Ok(accounts)
    }

    pub fn save_accounts(accounts: &[Account]) -> Result<(), String> {
        let existing = Self::load_token_entries().unwrap_or_default();
        let mut entries: HashMap<String, TokenEntry> = HashMap::new();
        let mut public = Vec::with_capacity(accounts.len());

        for acc in accounts {
            let mut entry = existing.get(&acc.id).cloned().unwrap_or_default();
            entry.access = acc.access_token.clone().filter(|t| !t.is_empty());
            entries.insert(acc.id.clone(), entry);

            let mut clean = acc.clone();
            clean.access_token = None;
            public.push(clean);
        }

        // Tokens primero: si el proceso muere entre las dos escrituras, accounts.json
        // todavía conserva el token y la carga siguiente reintenta la migración.
        Self::save_token_entries(&entries)?;
        write_private_json(&Self::get_accounts_file_path()?, &public)?;
        Ok(())
    }

    fn load_token_entries() -> Result<HashMap<String, TokenEntry>, String> {
        let path = Self::get_tokens_file_path()?;
        let Ok(raw) = fs::read_to_string(&path) else {
            return Ok(HashMap::new());
        };
        let Ok(map) = serde_json::from_str::<HashMap<String, StoredToken>>(&raw) else {
            return Ok(HashMap::new());
        };

        Ok(map
            .into_iter()
            .map(|(id, token)| {
                let entry = match token {
                    StoredToken::Legacy(access) => TokenEntry {
                        access: Some(access),
                        ..Default::default()
                    },
                    StoredToken::Full(entry) => entry,
                };
                (id, entry)
            })
            .collect())
    }

    fn save_token_entries(entries: &HashMap<String, TokenEntry>) -> Result<(), String> {
        write_private_json(&Self::get_tokens_file_path()?, entries)
    }

    fn store_tokens(
        account_id: &str,
        access: Option<String>,
        refresh: Option<String>,
        expires_at: Option<i64>,
    ) -> Result<(), String> {
        let mut entries = Self::load_token_entries()?;
        entries.insert(
            account_id.to_string(),
            TokenEntry { access, refresh, expires_at },
        );
        Self::save_token_entries(&entries)
    }

    /// Token de Minecraft vigente. Si expiró y hay refresh token, lo renueva.
    pub async fn ensure_access_token(account_id: &str) -> Result<String, String> {
        Self::token_for(account_id, false).await
    }

    /// Fuerza la renovación (p. ej. tras un 401 del servicio).
    pub async fn refresh_access_token(account_id: &str) -> Result<String, String> {
        Self::token_for(account_id, true).await
    }

    async fn token_for(account_id: &str, force: bool) -> Result<String, String> {
        let accounts = Self::load_accounts()?;
        let account = accounts
            .iter()
            .find(|a| a.id == account_id)
            .ok_or("La cuenta no existe")?;

        if !account.account_type.eq_ignore_ascii_case("Microsoft") {
            return account
                .access_token
                .clone()
                .filter(|t| !t.is_empty())
                .ok_or_else(|| "La cuenta no tiene sesión activa".to_string());
        }

        let entry = Self::load_token_entries()?
            .get(account_id)
            .cloned()
            .unwrap_or_default();
        let now = chrono::Utc::now().timestamp();
        let still_valid = entry.expires_at.is_some_and(|exp| exp - 120 > now);

        if !force && still_valid {
            if let Some(access) = entry.access.clone().filter(|a| !a.is_empty()) {
                return Ok(access);
            }
        }

        let refresh = entry.refresh.clone().ok_or(
            "La sesión de Microsoft expiró y no hay refresh token guardado; vuelve a iniciar sesión.",
        )?;

        let (ms_access, new_refresh, expires_in) = Self::refresh_ms_token(&refresh).await?;
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;
        let renewed = Self::exchange_ms_token_to_account(&client, &ms_access).await?;
        let access = renewed
            .access_token
            .clone()
            .filter(|t| !t.is_empty())
            .ok_or("Microsoft no devolvió un token de Minecraft")?;

        Self::store_tokens(
            account_id,
            Some(access.clone()),
            Some(new_refresh),
            Some(now + expires_in),
        )?;
        Ok(access)
    }

    async fn refresh_ms_token(refresh_token: &str) -> Result<(String, String, i64), String> {
        let client = reqwest::Client::builder()
            .user_agent("GhosttyLauncher/0.1.0")
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;

        let params = vec![
            ("client_id", Self::msa_client_id()),
            ("grant_type", "refresh_token".to_string()),
            ("refresh_token", refresh_token.to_string()),
            ("scope", "XboxLive.signin offline_access".to_string()),
        ];

        let response = client
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("Fallo renovando la sesión de Microsoft: {e}"))?;

        if !response.status().is_success() {
            return Err(
                "Microsoft rechazó la renovación de sesión; vuelve a iniciar sesión.".to_string(),
            );
        }

        let data: MicrosoftTokenResponse = response
            .json()
            .await
            .map_err(|e| format!("Respuesta de renovación ilegible: {e}"))?;

        Ok((
            data.access_token,
            data.refresh_token.unwrap_or_else(|| refresh_token.to_string()),
            data.expires_in.unwrap_or(3600),
        ))
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
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/devicecode")
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
        let mut ms_refresh_token: Option<String> = None;
        let mut ms_expires_in: Option<i64> = None;

        for _ in 0..max_attempts {
            tokio::time::sleep(check_interval).await;

            let params = [
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id.as_str()),
                ("device_code", device_code),
            ];

            let response = client
                .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
                .form(&params)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = response.status();
            let body_text = response.text().await.map_err(|e| e.to_string())?;

            eprintln!("[msa] device poll: {status}");
            if status.is_success() {
                let token_data: MicrosoftTokenResponse =
                    serde_json::from_str(&body_text).map_err(|e| e.to_string())?;
                ms_access_token = token_data.access_token;
                ms_refresh_token = token_data.refresh_token;
                ms_expires_in = token_data.expires_in;
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

        let account = Self::exchange_ms_token_to_account(&client, &ms_access_token).await?;

        if let (Some(refresh), Some(expires_in)) = (ms_refresh_token, ms_expires_in) {
            let now = chrono::Utc::now().timestamp();
            Self::store_tokens(
                &account.id,
                account.access_token.clone(),
                Some(refresh),
                Some(now + expires_in),
            )
            .ok();
        }

        Ok(account)
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
    #[test]
    fn parses_legacy_and_structured_token_entries() {
        use super::{StoredToken, TokenEntry};
        use std::collections::HashMap;

        let legacy: HashMap<String, StoredToken> =
            serde_json::from_str(r#"{"a":"access-only"}"#).unwrap();
        match legacy.get("a").unwrap() {
            StoredToken::Legacy(access) => assert_eq!(access, "access-only"),
            StoredToken::Full(_) => panic!("formato viejo mal detectado"),
        }

        let full: HashMap<String, StoredToken> = serde_json::from_str(
            r#"{"b":{"access":"at","refresh":"rt","expires_at":123}}"#,
        )
        .unwrap();
        match full.get("b").unwrap() {
            StoredToken::Full(TokenEntry { access, refresh, expires_at }) => {
                assert_eq!(access.as_deref(), Some("at"));
                assert_eq!(refresh.as_deref(), Some("rt"));
                assert_eq!(*expires_at, Some(123));
            }
            StoredToken::Legacy(_) => panic!("formato nuevo mal detectado"),
        }
    }
}
