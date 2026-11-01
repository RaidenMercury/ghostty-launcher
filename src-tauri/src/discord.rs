//! Discord Rich Presence por IPC local.
//!
//! Discord borra la actividad cuando se cierra el socket, así que hay un worker que
//! mantiene la conexión abierta y reenvía cada cambio. Antes se abría, se enviaba y se
//! cerraba: la presencia desaparecía al instante (y los errores se silenciaban).

use std::env;
use std::io::{Read, Write};
use std::process;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;

static START_TIMESTAMP: LazyLock<u64> = LazyLock::new(|| {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
});

static LAST_STATE: LazyLock<Mutex<(bool, String, String)>> = LazyLock::new(|| {
    Mutex::new((
        true,
        "Jugando en GhosttyLauncher".to_string(),
        "En el menú principal".to_string(),
    ))
});

static ACTIVITY_TX: LazyLock<Mutex<Option<Sender<Presence>>>> = LazyLock::new(|| Mutex::new(None));
static PLAYING: AtomicBool = AtomicBool::new(false);

const DEFAULT_CLIENT_ID: &str = "1566205071929385052";

#[derive(Clone, Debug)]
struct Presence {
    enabled: bool,
    details: String,
    state: String,
}

#[cfg(unix)]
type Stream = std::os::unix::net::UnixStream;
#[cfg(windows)]
type Stream = std::fs::File;

pub struct DiscordRpcManager;

impl DiscordRpcManager {
    pub fn init_from_config() {
        match crate::launcher::LauncherManager::load_config() {
            Ok(cfg) => Self::update_presence(
                cfg.enable_discord_rpc,
                &cfg.discord_Rpc_details,
                &cfg.discord_Rpc_state,
            ),
            Err(_) => Self::update_presence(true, "Jugando en GhosttyLauncher", "En el menú principal"),
        }
    }

    pub fn update_presence(enabled: bool, details: &str, state: &str) {
        let presence = Presence {
            enabled,
            details: details.trim().to_string(),
            state: state.trim().to_string(),
        };

        if let Ok(mut guard) = LAST_STATE.lock() {
            *guard = (presence.enabled, presence.details.clone(), presence.state.clone());
        }

        Self::ensure_worker();
        if let Ok(guard) = ACTIVITY_TX.lock() {
            if let Some(tx) = guard.as_ref() {
                let _ = tx.send(presence);
            }
        }
    }

    pub fn set_playing_instance(instance_name: &str, mc_version: &str, loader: &str) {
        PLAYING.store(true, Ordering::Relaxed);
        let enabled = LAST_STATE.lock().map(|g| g.0).unwrap_or(true);
        if !enabled {
            return;
        }
        Self::update_presence(
            true,
            &format!("Jugando Minecraft {} ({})", mc_version, loader.to_uppercase()),
            &format!("Estancia: {}", instance_name),
        );
    }

    /// Actualiza la presencia con la instancia seleccionada en la UI, sin pisar
    /// el estado de "jugando" mientras haya una partida activa.
    pub fn set_selected_instance(instance_name: &str, mc_version: &str, loader: &str) {
        if PLAYING.load(Ordering::Relaxed) {
            return;
        }
        let enabled = LAST_STATE.lock().map(|g| g.0).unwrap_or(true);
        if !enabled {
            return;
        }
        Self::update_presence(
            true,
            &format!("{} ({})", instance_name, mc_version),
            &format!("Explorando · {}", loader.to_uppercase()),
        );
    }

    pub fn restore_idle() {
        PLAYING.store(false, Ordering::Relaxed);
        Self::init_from_config();
    }

    fn client_id() -> String {
        env::var("GHOSTTY_DISCORD_CLIENT_ID")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string())
    }

    fn ensure_worker() {
        let mut guard = match ACTIVITY_TX.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if guard.is_some() {
            return;
        }

        let (tx, rx) = mpsc::channel::<Presence>();
        *guard = Some(tx);
        std::thread::spawn(move || Self::run_worker(rx));
    }

    fn run_worker(rx: Receiver<Presence>) {
        let mut connection: Option<(Stream, bool)> = None;

        while let Ok(mut presence) = rx.recv() {
            // Coalesce: si llegaron varios cambios, solo importa el último.
            while let Ok(next) = rx.try_recv() {
                presence = next;
            }

            let mut attempts = 0;
            loop {
                if connection.is_none() {
                    connection = Self::connect().map(|stream| (stream, false));
                }
                let Some((stream, handshaked)) = connection.as_mut() else {
                    attempts += 1;
                    if attempts >= 3 {
                        eprintln!("[discord] sin IPC disponible; se reintentará en el próximo cambio");
                        break;
                    }
                    std::thread::sleep(Duration::from_secs(2));
                    continue;
                };

                match Self::send_activity(stream, &presence, !*handshaked) {
                    Ok(()) => {
                        *handshaked = true;
                        break;
                    }
                    Err(err) => {
                        eprintln!("[discord] fallo al enviar actividad: {err}");
                        connection = None;
                        attempts += 1;
                        if attempts >= 3 {
                            break;
                        }
                        std::thread::sleep(Duration::from_secs(1));
                    }
                }
            }
        }
    }

    fn connect() -> Option<Stream> {
        #[cfg(unix)]
        {
            use std::os::unix::net::UnixStream;

            let mut dirs = Vec::new();
            if let Ok(xdg) = env::var("XDG_RUNTIME_DIR") {
                let base = std::path::PathBuf::from(&xdg);
                dirs.push(base.clone());
                dirs.push(base.join("app/com.discordapp.Discord"));
                dirs.push(base.join("snap.discord"));
                dirs.push(base.join("app/com.discordapp.DiscordCanary"));
            }
            dirs.push(std::path::PathBuf::from("/tmp"));

            for dir in dirs {
                for i in 0..10 {
                    let path = dir.join(format!("discord-ipc-{i}"));
                    if !path.exists() {
                        continue;
                    }
                    if let Ok(stream) = UnixStream::connect(&path) {
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                        let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
                        return Some(stream);
                    }
                }
            }
            None
        }
        #[cfg(windows)]
        {
            use std::fs::OpenOptions;
            for i in 0..10 {
                let name = format!(r"\\?\pipe\discord-ipc-{i}");
                if let Ok(file) = OpenOptions::new().read(true).write(true).open(&name) {
                    return Some(file);
                }
            }
            None
        }
    }

    fn send_activity(
        stream: &mut Stream,
        presence: &Presence,
        handshake: bool,
    ) -> Result<(), String> {
        if handshake {
            let packet = json!({ "v": 1, "client_id": Self::client_id() }).to_string();
            Self::write_frame(stream, 0, &packet)?;
            // Discord responde al handshake; si trae error (client_id inválido), se ve.
            if let Ok((_, body)) = Self::read_frame(stream) {
                if body.contains("error") || body.contains("Invalid") {
                    eprintln!("[discord] handshake rechazado: {body}");
                }
            }
        }

        let nonce = format!(
            "ghostty-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        );
        let activity = Self::build_activity_packet(presence, &nonce);
        Self::write_frame(stream, 1, &activity)?;
        if let Ok((_, body)) = Self::read_frame(stream) {
            if body.contains("error") || body.contains("Invalid") {
                eprintln!("[discord] SET_ACTIVITY rechazado: {body}");
            }
        }
        Ok(())
    }

    fn write_frame<W: Write>(stream: &mut W, opcode: u32, payload: &str) -> Result<(), String> {
        let bytes = payload.as_bytes();
        stream
            .write_all(&opcode.to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream
            .write_all(&(bytes.len() as u32).to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream.write_all(bytes).map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())
    }

    fn read_frame<R: Read>(stream: &mut R) -> Result<(u32, String), String> {
        let mut header = [0u8; 8];
        stream.read_exact(&mut header).map_err(|e| e.to_string())?;
        let opcode = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
        let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        if len > 65536 {
            return Err("Frame Discord IPC demasiado grande".to_string());
        }
        let mut buf = vec![0u8; len];
        stream.read_exact(&mut buf).map_err(|e| e.to_string())?;
        Ok((opcode, String::from_utf8_lossy(&buf).to_string()))
    }

    fn build_activity_packet(presence: &Presence, nonce: &str) -> String {
        if !presence.enabled {
            return json!({
                "cmd": "SET_ACTIVITY",
                "args": { "pid": process::id(), "activity": null },
                "nonce": nonce
            })
            .to_string();
        }

        let details = if presence.details.is_empty() {
            "Jugando en GhosttyLauncher"
        } else {
            &presence.details
        };
        let state = if presence.state.is_empty() {
            "En el menú principal"
        } else {
            &presence.state
        };

        json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": process::id(),
                "activity": {
                    "details": details,
                    "state": state,
                    "timestamps": { "start": *START_TIMESTAMP }
                }
            },
            "nonce": nonce
        })
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{DiscordRpcManager, Presence};

    #[test]
    fn frame_roundtrip() {
        let mut buf: Vec<u8> = Vec::new();
        DiscordRpcManager::write_frame(&mut buf, 1, "{\"a\":1}").unwrap();

        let mut cursor = std::io::Cursor::new(buf);
        let (opcode, payload) = DiscordRpcManager::read_frame(&mut cursor).unwrap();
        assert_eq!(opcode, 1);
        assert_eq!(payload, "{\"a\":1}");
    }

    #[test]
    fn disabled_presence_sends_null_activity() {
        let packet = DiscordRpcManager::build_activity_packet(
            &Presence { enabled: false, details: String::new(), state: String::new() },
            "n1",
        );
        let value: serde_json::Value = serde_json::from_str(&packet).unwrap();
        assert!(value["args"]["activity"].is_null());
    }

    #[test]
    fn enabled_presence_carries_text_and_timestamp() {
        let packet = DiscordRpcManager::build_activity_packet(
            &Presence {
                enabled: true,
                details: "Jugando".into(),
                state: "Estancia: X".into(),
            },
            "n2",
        );
        let value: serde_json::Value = serde_json::from_str(&packet).unwrap();
        assert_eq!(value["args"]["activity"]["details"], "Jugando");
        assert!(value["args"]["activity"]["timestamps"]["start"].is_number());
    }
}
