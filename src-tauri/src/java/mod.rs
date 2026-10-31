//! Detección de runtimes Java instalados en el sistema.
//!
//! No descarga nada: solo localiza binarios y verifica que respondan. La descarga
//! automática (Adoptium) llega en F1. Sin esto, Ajustes mostraba JVMs simuladas.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::launcher::LauncherManager;
use crate::models::SystemJavaInfo;

pub mod adoptium;

pub struct JavaDetector;

impl JavaDetector {
    pub fn detect() -> Vec<SystemJavaInfo> {
        let mut found: BTreeMap<PathBuf, SystemJavaInfo> = BTreeMap::new();

        for candidate in Self::candidates() {
            if !candidate.is_file() {
                continue;
            }
            let key = std::fs::canonicalize(&candidate).unwrap_or_else(|_| candidate.clone());
            if found.contains_key(&key) {
                continue;
            }
            if let Some(info) = Self::probe(&candidate) {
                found.insert(key, info);
            }
        }

        let mut runtimes: Vec<SystemJavaInfo> = found.into_values().collect();
        runtimes.sort_by(|a, b| {
            b.major_version
                .cmp(&a.major_version)
                .then_with(|| a.path.cmp(&b.path))
        });
        runtimes
    }

    fn candidates() -> Vec<PathBuf> {
        let exe = if cfg!(windows) { "java.exe" } else { "java" };
        let bin = |home: &Path| home.join("bin").join(exe);

        let mut list = Vec::new();

        // Runtimes gestionados por el launcher (carpeta reservada desde 0.1.0).
        if let Ok(root) = LauncherManager::get_root_dir() {
            if let Ok(entries) = std::fs::read_dir(root.join("runtimes")) {
                for entry in entries.flatten() {
                    let base = entry.path();
                    list.push(bin(&base));
                    // Los paquetes extraídos traen una carpeta interna (jdk-21…-jre/bin/java).
                    if let Some(found) = find_java_binary(&base, 4) {
                        list.push(found);
                    }
                }
            }
        }

        // Ruta elegida por el usuario en Ajustes.
        if let Ok(config) = LauncherManager::load_config() {
            if !config.java_path.trim().is_empty() && config.java_path != "java" {
                list.push(PathBuf::from(config.java_path));
            }
        }

        if let Some(home) = std::env::var_os("JAVA_HOME") {
            list.push(bin(Path::new(&home)));
        }

        if let Some(path) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path) {
                list.push(dir.join(exe));
            }
        }

        let roots: &[&str] = if cfg!(windows) {
            &[
                r"C:\Program Files\Java",
                r"C:\Program Files\Eclipse Adoptium",
                r"C:\Program Files\Microsoft",
            ]
        } else if cfg!(target_os = "macos") {
            &["/Library/Java/JavaVirtualMachines"]
        } else {
            &["/usr/lib/jvm", "/usr/java", "/opt/java"]
        };

        for root in roots {
            let Ok(entries) = std::fs::read_dir(root) else {
                continue;
            };
            for entry in entries.flatten() {
                let home = entry.path();
                list.push(bin(&home));
                // macOS: .../Contents/Home/bin/java
                list.push(bin(&home.join("Contents").join("Home")));
            }
        }

        list
    }

    pub fn probe(path: &Path) -> Option<SystemJavaInfo> {
        let output = Command::new(path)
            .args(["-XshowSettings:properties", "-version"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }

        // `java -version` escribe en stderr por diseño.
        let text = String::from_utf8_lossy(&output.stderr);
        let version = property(&text, "java.version")?;
        let vendor = property(&text, "java.vendor").unwrap_or_default();

        Some(SystemJavaInfo {
            path: path.to_string_lossy().to_string(),
            version: if vendor.is_empty() {
                version.clone()
            } else {
                format!("{version} ({vendor})")
            },
            major_version: major_version(&version)?,
            is_valid: true,
        })
    }
}

/// Busca `bin/java` dentro de un runtime extraído (el tar trae una carpeta interna).
pub(crate) fn find_java_binary(root: &Path, max_depth: usize) -> Option<PathBuf> {
    let exe = if cfg!(windows) { "java.exe" } else { "java" };
    walkdir::WalkDir::new(root)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(Result::ok)
        .find(|entry| {
            entry.file_type().is_file()
                && entry.file_name() == exe
                && entry.path().parent().is_some_and(|p| p.ends_with("bin"))
        })
        .map(|entry| entry.into_path())
}

fn property(block: &str, key: &str) -> Option<String> {
    block
        .lines()
        .find_map(|line| line.trim().strip_prefix(key)?.trim().strip_prefix('='))
        .map(|value| value.trim().to_string())
}

/// `1.8.0_402` → 8, `21.0.6` → 21, `17` → 17.
fn major_version(version: &str) -> Option<u32> {
    let digits = version.strip_prefix("1.").unwrap_or(version);
    let end = digits
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(digits.len());
    digits[..end].parse().ok()
}

#[cfg(test)]
mod tests {
    use super::{major_version, property};

    #[test]
    fn parses_legacy_and_modern_versions() {
        assert_eq!(major_version("1.8.0_402"), Some(8));
        assert_eq!(major_version("21.0.6"), Some(21));
        assert_eq!(major_version("17"), Some(17));
        assert_eq!(major_version("banana"), None);
    }

    #[test]
    fn reads_properties_block() {
        let block = "    java.version = 21.0.6\n    java.vendor = Eclipse Adoptium\n";
        assert_eq!(property(block, "java.version").as_deref(), Some("21.0.6"));
        assert_eq!(property(block, "java.vendor").as_deref(), Some("Eclipse Adoptium"));
        assert_eq!(property(block, "java.home"), None);
    }
}
