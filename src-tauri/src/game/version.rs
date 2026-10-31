//! Resolución de JSON de versión con herencia (`inheritsFrom`).
//!
//! Los loaders (Fabric, Forge, NeoForge) publican un perfil que hereda de la versión
//! vanilla. El merge sigue la convención de Prism: el hijo pisa los escalares, las
//! librerías se concatenan (el hijo gana ante el mismo `name`) y los argumentos se
//! concatenan por grupo (`jvm`/`game`).

use std::path::Path;

use serde_json::{Map, Value};

const MAX_DEPTH: usize = 8;

pub fn resolve(versions_dir: &Path, id: &str) -> Result<Value, String> {
    resolve_inner(versions_dir, id, 0)
}

fn resolve_inner(versions_dir: &Path, id: &str, depth: usize) -> Result<Value, String> {
    if depth > MAX_DEPTH {
        return Err(format!(
            "Herencia de versiones demasiado profunda o cíclica en '{id}'"
        ));
    }

    let path = versions_dir.join(id).join(format!("{id}.json"));
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("No se pudo leer {}: {e}", path.display()))?;
    let child: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("JSON de versión inválido en {}: {e}", path.display()))?;

    let Some(parent_id) = child.get("inheritsFrom").and_then(Value::as_str) else {
        return Ok(child);
    };
    if parent_id == id {
        return Err(format!("La versión '{id}' se hereda de sí misma"));
    }

    let parent = resolve_inner(versions_dir, parent_id, depth + 1)?;
    Ok(merge(parent, child))
}

/// Merge de un perfil hijo sobre su padre.
pub fn merge(parent: Value, child: Value) -> Value {
    let mut base: Map<String, Value> = parent.as_object().cloned().unwrap_or_default();
    let child = child.as_object().cloned().unwrap_or_default();

    for (key, value) in child {
        match key.as_str() {
            "libraries" => merge_libraries(&mut base, &value),
            "arguments" => merge_arguments(&mut base, &value),
            _ => {
                base.insert(key, value);
            }
        }
    }

    Value::Object(base)
}

fn merge_libraries(base: &mut Map<String, Value>, incoming: &Value) {
    let mut libraries = base
        .get("libraries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for library in incoming.as_array().cloned().unwrap_or_default() {
        let name = library
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        match libraries
            .iter()
            .position(|l| l.get("name").and_then(Value::as_str) == Some(name.as_str()))
        {
            Some(pos) => libraries[pos] = library,
            None => libraries.push(library),
        }
    }

    base.insert("libraries".into(), Value::Array(libraries));
}

fn merge_arguments(base: &mut Map<String, Value>, incoming: &Value) {
    let mut merged = base
        .get("arguments")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    let Some(groups) = incoming.as_object() else {
        return;
    };

    for (group, values) in groups {
        let mut list = merged
            .get(group)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        list.extend(values.as_array().cloned().unwrap_or_default());
        merged.insert(group.clone(), Value::Array(list));
    }

    base.insert("arguments".into(), Value::Object(merged));
}

#[cfg(test)]
mod tests {
    use super::{merge, resolve};
    use serde_json::json;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("ghostty-ver-{tag}-{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_version(dir: &PathBuf, id: &str, body: serde_json::Value) {
        std::fs::create_dir_all(dir.join(id)).unwrap();
        std::fs::write(
            dir.join(id).join(format!("{id}.json")),
            serde_json::to_string(&body).unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn child_overrides_scalars_and_keeps_parent_libraries() {
        let dir = temp_dir("merge");
        write_version(
            &dir,
            "1.20.1",
            json!({
                "id": "1.20.1",
                "mainClass": "net.minecraft.client.main.Main",
                "assetIndex": { "id": "5" },
                "libraries": [{ "name": "org.lwjgl:lwjgl:3.3.1" }],
                "arguments": { "game": ["--version", "${version_name}"], "jvm": ["-Dfoo=1"] }
            }),
        );
        write_version(
            &dir,
            "1.20.1-forge",
            json!({
                "id": "1.20.1-forge",
                "inheritsFrom": "1.20.1",
                "mainClass": "cpw.mods.bootstraplauncher.BootstrapLauncher",
                "libraries": [
                    { "name": "org.lwjgl:lwjgl:3.3.1", "url": "https://overridden" },
                    { "name": "net.minecraftforge:forge:1.20.1" }
                ],
                "arguments": { "game": ["--launchTarget", "forgeclient"] }
            }),
        );

        let resolved = resolve(&dir, "1.20.1-forge").unwrap();

        assert_eq!(
            resolved["mainClass"],
            "cpw.mods.bootstraplauncher.BootstrapLauncher"
        );
        // El assetIndex se hereda del padre.
        assert_eq!(resolved["assetIndex"]["id"], "5");
        // Librería repetida: gana la del hijo.
        assert_eq!(resolved["libraries"][0]["url"], "https://overridden");
        assert_eq!(resolved["libraries"].as_array().unwrap().len(), 2);
        // Argumentos: padre + hijo.
        let game = resolved["arguments"]["game"].as_array().unwrap();
        assert_eq!(game.len(), 4);
        assert_eq!(game[3], "forgeclient");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detects_cycles() {
        let dir = temp_dir("cycle");
        write_version(&dir, "a", json!({ "id": "a", "inheritsFrom": "b" }));
        write_version(&dir, "b", json!({ "id": "b", "inheritsFrom": "a" }));

        assert!(resolve(&dir, "a").is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn missing_parent_is_an_error() {
        let dir = temp_dir("missing");
        write_version(&dir, "child", json!({ "id": "child", "inheritsFrom": "nope" }));

        assert!(resolve(&dir, "child").is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn merge_without_libraries_or_arguments_is_safe() {
        let merged = merge(json!({ "id": "p" }), json!({ "id": "c", "mainClass": "X" }));
        assert_eq!(merged["id"], "c");
        assert_eq!(merged["mainClass"], "X");
    }
}
