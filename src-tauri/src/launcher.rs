use crate::config::get_instances_dir;
use crate::models::{Instance, SystemJavaInfo};
use std::fs;
use std::process::Command;

pub fn detect_java_installations() -> Vec<SystemJavaInfo> {
    let mut results = Vec::new();

    // Check `java` in PATH
    if let Ok(output) = Command::new("java").arg("-version").output() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let version_str = if !stderr.is_empty() {
            stderr.lines().next().unwrap_or("Java (unknown)").to_string()
        } else {
            stdout.lines().next().unwrap_or("Java (unknown)").to_string()
        };

        let path = which_java().unwrap_or_else(|| "java".to_string());

        results.push(SystemJavaInfo {
            path,
            version: version_str,
            is_valid: true,
        });
    }

    // Check common Linux /usr/lib/jvm locations
    #[cfg(target_os = "linux")]
    {
        let jvm_dir = std::path::Path::new("/usr/lib/jvm");
        if jvm_dir.exists() {
            if let Ok(entries) = fs::read_dir(jvm_dir) {
                for entry in entries.flatten() {
                    let java_bin = entry.path().join("bin/java");
                    if java_bin.exists() {
                        let path_str = java_bin.to_string_lossy().to_string();
                        if !results.iter().any(|r| r.path == path_str) {
                            if let Ok(out) = Command::new(&java_bin).arg("-version").output() {
                                let stderr = String::from_utf8_lossy(&out.stderr);
                                let ver = stderr.lines().next().unwrap_or("Java").to_string();
                                results.push(SystemJavaInfo {
                                    path: path_str,
                                    version: ver,
                                    is_valid: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

fn which_java() -> Option<String> {
    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("which").arg("java").output() {
            if output.status.success() {
                let p = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !p.is_empty() {
                    return Some(p);
                }
            }
        }
    }
    None
}

pub fn list_instance_mods(instance_id: &str) -> Result<Vec<ModFileInfo>, String> {
    let mods_dir = get_instances_dir().join(instance_id).join("mods");
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut mods = Vec::new();
    let entries = fs::read_dir(&mods_dir).map_err(|e| format!("Failed to read mods dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            let is_disabled = name.ends_with(".disabled");
            let is_jar = name.ends_with(".jar") || is_disabled;
            if is_jar {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                mods.push(ModFileInfo {
                    filename: name,
                    size,
                    enabled: !is_disabled,
                });
            }
        }
    }

    Ok(mods)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ModFileInfo {
    pub filename: String,
    pub size: u64,
    pub enabled: bool,
}

pub fn toggle_mod(instance_id: &str, filename: &str) -> Result<bool, String> {
    let mods_dir = get_instances_dir().join(instance_id).join("mods");
    let current_path = mods_dir.join(filename);
    if !current_path.exists() {
        return Err("Mod file not found".to_string());
    }

    let new_filename = if filename.ends_with(".disabled") {
        filename.trim_end_matches(".disabled").to_string()
    } else {
        format!("{}.disabled", filename)
    };

    let new_path = mods_dir.join(&new_filename);
    fs::rename(current_path, new_path).map_err(|e| format!("Failed to rename mod: {}", e))?;

    Ok(!new_filename.ends_with(".disabled"))
}

pub fn launch_instance(instance: &mut Instance, username: &str, uuid: &str) -> Result<String, String> {
    // Record last played
    let now = chrono::Local::now().to_rfc3339();
    instance.last_played = Some(now);
    let _ = crate::instances::update_instance(instance.clone());

    let instance_dir = get_instances_dir().join(&instance.id);

    // Prepare simulated/actual Java launch command
    let java_bin = instance.java_path.clone().unwrap_or_else(|| "java".to_string());
    let min_mem = format!("-Xms{}M", instance.memory_min_mb);
    let max_mem = format!("-Xmx{}M", instance.memory_max_mb);

    let info = format!(
        "Instance '{}' ({}) initiated with player '{}' ({})\nJava: {}\nAllocated RAM: {} - {}\nGame directory: {}",
        instance.name,
        instance.mc_version,
        username,
        uuid,
        java_bin,
        min_mem,
        max_mem,
        instance_dir.display()
    );

    Ok(info)
}
