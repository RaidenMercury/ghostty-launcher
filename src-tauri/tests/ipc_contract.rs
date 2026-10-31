//! Contrato IPC: todo comando que el frontend invoca debe existir en el backend.
//!
//! Este test existe por un bug real: `detect_java` se invocaba desde la UI, no estaba
//! registrado en `generate_handler!`, y `api.ts` lo tapaba devolviendo datos simulados.
//! La app mostraba JVMs que no existían. Si vuelve a pasar, esto falla en CI.
//!
//! Limitación conocida: si una invocación no es un literal en la misma línea (variable
//! intermedia o plantilla), el test falla a propósito en vez de ignorarla en silencio.

use std::collections::BTreeSet;

const API_TS: &str = include_str!("../../src/services/api.ts");
const LIB_RS: &str = include_str!("../src/lib.rs");

/// Comandos invocados por la UI que aún no tienen backend. La lista solo puede encoger.
const PENDING: &[&str] = &[];

/// Quita un comentario de línea sin romper las URLs (`https://`).
fn strip_line_comment(line: &str) -> &str {
    let mut search_from = 0;
    while let Some(offset) = line[search_from..].find("//") {
        let idx = search_from + offset;
        if !line[..idx].ends_with(':') {
            return &line[..idx];
        }
        search_from = idx + 2;
    }
    line
}

/// Salta `<...>` (genéricos de TypeScript) y devuelve lo que sigue.
fn skip_generics(tail: &str) -> Option<&str> {
    let tail = tail.trim_start();
    if !tail.starts_with('<') {
        return Some(tail);
    }
    let mut depth = 0usize;
    for (i, ch) in tail.char_indices() {
        match ch {
            '<' => depth += 1,
            '>' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&tail[i + 1..]);
                }
            }
            _ => {}
        }
    }
    None
}

fn invoked_commands(src: &str) -> BTreeSet<String> {
    let mut out = BTreeSet::new();

    for (number, raw) in src.lines().enumerate() {
        let line = strip_line_comment(raw);
        let Some(pos) = line.find("invokeTauri") else {
            continue;
        };
        // Definición de la función: no es una invocación.
        if line.contains("function invokeTauri") {
            continue;
        }

        let after_generics = skip_generics(&line[pos + "invokeTauri".len()..])
            .unwrap_or_else(|| panic!("línea {}: genéricos sin cerrar", number + 1));
        let call = after_generics.trim_start();

        let Some(args) = call.strip_prefix('(').map(str::trim_start) else {
            panic!(
                "línea {}: se esperaba '(' tras invokeTauri, ¿invocación rara?",
                number + 1
            );
        };
        let Some(quote) = args.chars().next().filter(|c| *c == '\'' || *c == '"') else {
            panic!(
                "línea {}: comando no literal (¿variable o plantilla?). El test no puede \
                 verificar invocaciones dinámicas: {}",
                number + 1,
                raw.trim()
            );
        };
        let rest = &args[1..];
        let Some(end) = rest.find(quote) else {
            panic!("línea {}: literal sin cerrar", number + 1);
        };

        out.insert(rest[..end].to_string());
    }

    out
}

fn registered_commands(src: &str) -> BTreeSet<String> {
    let start = src
        .find("generate_handler![")
        .expect("lib.rs debe contener generate_handler!");
    let rest = &src[start..];
    let end = rest.find("])").expect("generate_handler! sin cierre `])`");

    rest[..end]
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

#[test]
fn every_invoked_command_is_registered() {
    let invoked = invoked_commands(API_TS);
    let registered = registered_commands(LIB_RS);

    assert!(
        registered.len() > 20,
        "parser roto: solo {} comandos registrados",
        registered.len()
    );
    assert!(
        invoked.len() > 20,
        "parser roto: solo {} comandos invocados",
        invoked.len()
    );

    let missing: Vec<&String> = invoked
        .difference(&registered)
        .filter(|cmd| !PENDING.contains(&cmd.as_str()))
        .collect();

    assert!(
        missing.is_empty(),
        "comandos invocados sin registrar en lib.rs: {missing:?}"
    );
}

#[test]
fn pending_list_does_not_rot() {
    let invoked = invoked_commands(API_TS);
    let registered = registered_commands(LIB_RS);

    for cmd in PENDING {
        assert!(
            !registered.contains(*cmd),
            "{cmd} ya está registrado: quítalo de PENDING"
        );
        assert!(
            invoked.contains(*cmd),
            "{cmd} ya no se invoca: quítalo de PENDING"
        );
    }
}

#[test]
fn parses_both_quote_styles_and_skips_generics() {
    let src = r#"
        const a = invokeTauri<T>('get_instances');
        const b = invokeTauri("search_modrinth", { query: "https://api.modrinth.com" });
        // invokeTauri('comando_comentado') no cuenta
        async function invokeTauri<T>(cmd: string) {}
    "#;
    let got = invoked_commands(src);
    assert!(got.contains("get_instances"));
    assert!(got.contains("search_modrinth"));
    assert!(!got.contains("comando_comentado"));
    assert_eq!(got.len(), 2);
}

#[test]
#[should_panic(expected = "comando no literal")]
fn rejects_dynamic_invocations() {
    invoked_commands("invokeTauri(cmdName, args);");
}

#[test]
#[should_panic(expected = "comando no literal")]
fn rejects_multiline_invocations() {
    invoked_commands("invokeTauri(\n  'get_instances'\n);");
}
