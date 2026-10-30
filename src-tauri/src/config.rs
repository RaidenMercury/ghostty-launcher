use std::path::PathBuf;

pub fn get_launcher_dir() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("ghostty-launcher")
    } else if let Some(home) = dirs::home_dir() {
        home.join(".ghostty-launcher")
    } else {
        PathBuf::from("ghostty-launcher-data")
    }
}

pub fn get_instances_dir() -> PathBuf {
    get_launcher_dir().join("instances")
}

pub fn get_accounts_file_path() -> PathBuf {
    get_launcher_dir().join("accounts.json")
}

pub fn get_cache_dir() -> PathBuf {
    get_launcher_dir().join("cache")
}

pub fn init_directories() -> Result<(), String> {
    let base = get_launcher_dir();
    let instances = get_instances_dir();
    let cache = get_cache_dir();

    std::fs::create_dir_all(&base).map_err(|e| format!("Failed to create base dir: {}", e))?;
    std::fs::create_dir_all(&instances).map_err(|e| format!("Failed to create instances dir: {}", e))?;
    std::fs::create_dir_all(&cache).map_err(|e| format!("Failed to create cache dir: {}", e))?;

    Ok(())
}

