//! Evaluación de `rules` del formato de versión de Mojang.
//!
//! Semántica: sin reglas, permitido. Con reglas, se parte de denegado y cada regla
//! que coincide fija el resultado según su `action`.
//!
//! Limitación conocida: `os.version` (regex del sistema) se ignora.

use std::collections::BTreeMap;

use serde_json::Value;

pub type Features = BTreeMap<String, bool>;

pub fn allows(rules: Option<&Value>, features: &Features) -> bool {
    let Some(rules) = rules.and_then(Value::as_array) else {
        return true;
    };
    if rules.is_empty() {
        return true;
    }

    let mut allowed = false;
    for rule in rules {
        if !rule_matches(rule, features) {
            continue;
        }
        let action = rule
            .get("action")
            .and_then(Value::as_str)
            .unwrap_or("allow");
        allowed = action == "allow";
    }
    allowed
}

fn rule_matches(rule: &Value, features: &Features) -> bool {
    if let Some(os) = rule.get("os") {
        if let Some(name) = os.get("name").and_then(Value::as_str) {
            if name != current_os() {
                return false;
            }
        }
        if let Some(arch) = os.get("arch").and_then(Value::as_str) {
            let is_match = match arch {
                "arm64" | "aarch64" => cfg!(target_arch = "aarch64"),
                "x86_64" | "x64" | "amd64" => cfg!(target_arch = "x86_64"),
                "x86" | "i386" => cfg!(target_arch = "x86"),
                _ => false,
            };
            if !is_match {
                return false;
            }
        }
    }

    if let Some(required) = rule.get("features").and_then(Value::as_object) {
        for (feature, expected) in required {
            let expected = expected.as_bool().unwrap_or(false);
            if features.get(feature).copied().unwrap_or(false) != expected {
                return false;
            }
        }
    }

    true
}

pub fn current_os() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

#[cfg(test)]
mod tests {
    use super::{allows, current_os, Features};
    use serde_json::json;

    #[test]
    fn no_rules_means_allowed() {
        assert!(allows(None, &Features::new()));
        assert!(allows(Some(&json!([])), &Features::new()));
    }

    #[test]
    fn rule_for_other_os_is_ignored() {
        let other = if current_os() == "linux" { "windows" } else { "linux" };
        let rules = json!([{ "action": "allow", "os": { "name": other } }]);
        assert!(!allows(Some(&rules), &Features::new()));
    }

    #[test]
    fn rule_for_current_os_allows() {
        let rules = json!([{ "action": "allow", "os": { "name": current_os() } }]);
        assert!(allows(Some(&rules), &Features::new()));
    }

    #[test]
    fn later_rule_wins() {
        let rules = json!([
            { "action": "allow" },
            { "action": "disallow", "os": { "name": current_os() } }
        ]);
        assert!(!allows(Some(&rules), &Features::new()));
    }

    #[test]
    fn feature_must_match() {
        let rules = json!([{ "action": "allow", "features": { "has_custom_resolution": true } }]);
        assert!(!allows(Some(&rules), &Features::new()));

        let mut features = Features::new();
        features.insert("has_custom_resolution".into(), true);
        assert!(allows(Some(&rules), &features));
    }

    #[test]
    fn wrong_arch_does_not_match() {
        let rules = json!([{ "action": "allow", "os": { "name": current_os(), "arch": "definitely-not-this" } }]);
        assert!(!allows(Some(&rules), &Features::new()));
    }
}
