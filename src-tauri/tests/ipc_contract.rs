//! Contrato IPC: todo comando que el frontend invoca debe existir en el backend.
//!
//! Este test existe por un bug real: `detect_java` se invocaba desde la UI, no estaba
//! registrado en `generate_handler!`, y `api.ts` lo tapaba devolviendo datos simulados.
//! La app mostraba JVMs que no existían. Si vuelve a pasar, esto falla en CI.

use std::collections::BTreeSet;

const API_TS: &str = include_str!("../../src/services/api.ts");
const LIB_RS: &str = include_str!("../src/lib.rs");

/// Comandos invocados por la UI que aún no tienen backend. La lista solo puede encoger.
const PENDING: &[&str] = &[];

fn invoked_commands(src: &str) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    for line in src.lines() {
        let Some(pos) = line.find("invokeTauri") else {
            continue;
        };
        // La definición de la función no lleva literal en la misma línea.
        let Some(q1) = line[pos..].find('\'') else {
            continue;
        };
        let rest = &line[pos + q1 + 1..];
        let Some(q2) = rest.find('\'') else {
            continue;
        };
        out.insert(rest[..q2].to_string());
    }
    out
}

fn registered_commands(src: &str) -> BTreeSet<String> {
    let start = src
        .find("generate_handler![")
        .expect("lib.rs debe contener generate_handler!");
    let rest = &src[start..];
    let end = rest.find(']').expect("generate_handler! sin cierre");

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
