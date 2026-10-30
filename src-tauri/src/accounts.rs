use crate::config::get_accounts_file_path;
use crate::models::{Account, AccountType, AccountsFile};
use std::fs;
use uuid::Uuid;

pub fn load_accounts() -> Result<Vec<Account>, String> {
    let path = get_accounts_file_path();
    if !path.exists() {
        // Return default guest account if none exists
        let default_account = Account {
            id: "offline_GhosttyPlayer".to_string(),
            username: "GhosttyPlayer".to_string(),
            uuid: generate_offline_uuid("GhosttyPlayer"),
            account_type: AccountType::Offline,
            skin_url: None,
            is_active: true,
            access_token: None,
        };
        let file = AccountsFile {
            accounts: vec![default_account.clone()],
        };
        save_accounts(&file.accounts)?;
        return Ok(vec![default_account]);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read accounts file: {}", e))?;

    let file: AccountsFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse accounts file: {}", e))?;

    Ok(file.accounts)
}

pub fn save_accounts(accounts: &[Account]) -> Result<(), String> {
    let path = get_accounts_file_path();
    let file = AccountsFile {
        accounts: accounts.to_vec(),
    };
    let json = serde_json::to_string_pretty(&file)
        .map_err(|e| format!("Failed to serialize accounts: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Failed to write accounts file: {}", e))?;

    Ok(())
}

pub fn generate_offline_uuid(username: &str) -> String {
    // Mojang standard offline UUID: UUID v3 using md5 hash of "OfflinePlayer:" + username
    // Using UUID v3 standard with DNS namespace as widely used in launchers
    let offline_name = format!("OfflinePlayer:{}", username);
    let u = Uuid::new_v3(&Uuid::NAMESPACE_DNS, offline_name.as_bytes());
    u.to_string()
}

pub fn add_offline_account(username: &str) -> Result<Account, String> {
    let trimmed = username.trim();
    if trimmed.is_empty() {
        return Err("Username cannot be empty".to_string());
    }

    let mut accounts = load_accounts().unwrap_or_default();
    let id = format!("offline_{}", trimmed);

    // If account with same id already exists, make it active
    if let Some(pos) = accounts.iter().position(|a| a.id == id) {
        for a in accounts.iter_mut() {
            a.is_active = a.id == id;
        }
        let res = accounts[pos].clone();
        save_accounts(&accounts)?;
        return Ok(res);
    }

    // Set all others to inactive
    for a in accounts.iter_mut() {
        a.is_active = false;
    }

    let new_account = Account {
        id: id.clone(),
        username: trimmed.to_string(),
        uuid: generate_offline_uuid(trimmed),
        account_type: AccountType::Offline,
        skin_url: None,
        is_active: true,
        access_token: None,
    };

    accounts.push(new_account.clone());
    save_accounts(&accounts)?;

    Ok(new_account)
}

pub fn set_active_account(account_id: &str) -> Result<(), String> {
    let mut accounts = load_accounts()?;
    let mut found = false;

    for a in accounts.iter_mut() {
        if a.id == account_id {
            a.is_active = true;
            found = true;
        } else {
            a.is_active = false;
        }
    }

    if !found {
        return Err("Account not found".to_string());
    }

    save_accounts(&accounts)?;
    Ok(())
}

pub fn delete_account(account_id: &str) -> Result<(), String> {
    let mut accounts = load_accounts()?;
    let prev_len = accounts.len();
    accounts.retain(|a| a.id != account_id);

    if accounts.len() == prev_len {
        return Err("Account not found".to_string());
    }

    // If active account was deleted, make first remaining account active
    if !accounts.iter().any(|a| a.is_active) && !accounts.is_empty() {
        accounts[0].is_active = true;
    }

    save_accounts(&accounts)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_uuid() {
        let u1 = generate_offline_uuid("GhosttyPlayer");
        let u2 = generate_offline_uuid("GhosttyPlayer");
        assert_eq!(u1, u2);
        assert!(Uuid::parse_str(&u1).is_ok());

        let u3 = generate_offline_uuid("DifferentPlayer");
        assert_ne!(u1, u3);
    }
}

