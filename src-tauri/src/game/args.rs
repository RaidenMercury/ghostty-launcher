//! Construcción de argumentos desde el JSON de versión resuelto.
//!
//! Soporta el formato moderno (`arguments.jvm/game`, strings u objetos con `rules`
//! y `value`) y el legacy (`minecraftArguments`). Si un argumento usa un placeholder
//! que no tenemos (p. ej. `${path}` del logging), se descarta entero en vez de pasar
//! una cadena rota al juego.

use std::collections::HashMap;

use serde_json::Value;

use super::rules::{allows, Features};

pub type ArgContext = HashMap<String, String>;

pub fn build(arguments: Option<&Value>, group: &str, ctx: &ArgContext, features: &Features) -> Vec<String> {
    let Some(items) = arguments.and_then(|a| a.get(group)).and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for item in items {
        match item {
            Value::String(raw) => {
                if let Some(value) = substitute(raw, ctx) {
                    out.push(value);
                }
            }
            Value::Object(obj) => {
                if !allows(obj.get("rules"), features) {
                    continue;
                }
                match obj.get("value") {
                    Some(Value::String(raw)) => {
                        if let Some(value) = substitute(raw, ctx) {
                            out.push(value);
                        }
                    }
                    Some(Value::Array(values)) => {
                        for raw in values {
                            if let Some(raw) = raw.as_str() {
                                if let Some(value) = substitute(raw, ctx) {
                                    out.push(value);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    out
}

/// `minecraftArguments` (versiones antiguas): string separado por espacios.
pub fn build_legacy(legacy: &str, ctx: &ArgContext) -> Vec<String> {
    legacy
        .split_whitespace()
        .filter_map(|raw| substitute(raw, ctx))
        .collect()
}

fn substitute(raw: &str, ctx: &ArgContext) -> Option<String> {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;

    while let Some(start) = rest.find("${") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find('}') else {
            out.push_str(&rest[start..]);
            return Some(out);
        };
        let key = &after[..end];
        let value = ctx.get(key)?;
        out.push_str(value);
        rest = &after[end + 1..];
    }

    out.push_str(rest);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::{build, build_legacy, substitute, ArgContext};
    use crate::game::rules::Features;
    use serde_json::json;

    fn ctx() -> ArgContext {
        let mut ctx = ArgContext::new();
        ctx.insert("auth_player_name".into(), "steve".into());
        ctx.insert("version_name".into(), "1.20.1-forge-47.2.0".into());
        ctx
    }

    #[test]
    fn substitutes_known_placeholders() {
        assert_eq!(
            substitute("--username ${auth_player_name}", &ctx()).as_deref(),
            Some("--username steve")
        );
    }

    #[test]
    fn drops_argument_with_unknown_placeholder() {
        assert_eq!(substitute("--xuid ${auth_xuid}", &ctx()), None);
    }

    #[test]
    fn builds_strings_and_rule_objects() {
        let arguments = json!({
            "game": [
                "--username", "${auth_player_name}",
                { "rules": [{ "action": "allow", "features": { "has_custom_resolution": true } }],
                  "value": ["--width", "1920"] }
            ]
        });
        let args = build(Some(&arguments), "game", &ctx(), &Features::new());
        assert_eq!(args, vec!["--username", "steve"]);
    }

    #[test]
    fn legacy_arguments_are_split() {
        let args = build_legacy("--username ${auth_player_name} --version ${version_name}", &ctx());
        assert_eq!(args, vec!["--username", "steve", "--version", "1.20.1-forge-47.2.0"]);
    }
}
