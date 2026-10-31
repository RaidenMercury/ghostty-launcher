use serde_json::json;
use std::env;
use std::io::{Read, Write};
use std::process;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

static START_TIMESTAMP: LazyLock<u64> = LazyLock::new(|| {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
});

static LAST_RPC_STATE: LazyLock<Mutex<(bool, String, String)>> = LazyLock::new(|| {
    Mutex::new((
        true,
        "Jugando en GhosttyLauncher".to_string(),
        "En el menú principal".to_string(),
    ))
});

const DISCORD_CLIENT_ID: &str = "1214986249080127518";

pub struct DiscordRpcManager;

impl DiscordRpcManager {
    pub fn init_from_config() {
        if let Ok(cfg) = crate::launcher::LauncherManager::load_config() {
            Self::update_presence(
                cfg.enable_discord_rpc,
                &cfg.discord_Rpc_details,
                &cfg.discord_Rpc_state,
            );
        } else {
            Self::update_presence(
                true,
                "Jugando en GhosttyLauncher",
                "En el menú principal",
            );
        }
    }

    pub fn update_presence(enabled: bool, details: &str, state: &str) {
        let details_owned = details.trim().to_string();
        let state_owned = state.trim().to_string();

        if let Ok(mut guard) = LAST_RPC_STATE.lock() {
            *guard = (enabled, details_owned.clone(), state_owned.clone());
        }

        std::thread::spawn(move || {
            let _ = Self::send_ipc_activity(enabled, &details_owned, &state_owned);
        });
    }

    pub fn set_playing_instance(instance_name: &str, mc_version: &str, loader: &str) {
        let enabled = LAST_RPC_STATE
            .lock()
            .map(|g| g.0)
            .unwrap_or(true);
        if !enabled {
            return;
        }
        let details = format!("Jugando Minecraft {} ({})", mc_version, loader.to_uppercase());
        let state = format!("Estancia: {}", instance_name);
        Self::update_presence(true, &details, &state);
    }

    pub fn restore_idle() {
        Self::init_from_config();
    }

    fn write_frame<W: Write>(stream: &mut W, opcode: u32, payload: &str) -> Result<(), String> {
        let bytes = payload.as_bytes();
        let len = bytes.len() as u32;
        stream
            .write_all(&opcode.to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream
            .write_all(&len.to_le_bytes())
            .map_err(|e| e.to_string())?;
        stream.write_all(bytes).map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn read_frame<R: Read>(stream: &mut R) -> Result<(u32, String), String> {
        let mut header = [0u8; 8];
        stream
            .read_exact(&mut header)
            .map_err(|e| e.to_string())?;
        let opcode = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
        let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        if len > 65536 {
            return Err("Frame Discord IPC demasiado grande".to_string());
        }
        let mut buf = vec![0u8; len];
        stream.read_exact(&mut buf).map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&buf).to_string();
        Ok((opcode, text))
    }

    fn build_activity_packet(enabled: bool, details: &str, state: &str) -> String {
        let pid = process::id();
        let nonce = format!("ghostty-{}", *START_TIMESTAMP);
        if !enabled {
            return json!({
                "cmd": "SET_ACTIVITY",
                "args": {
                    "pid": pid,
                    "activity": null
                },
                "nonce": nonce
            })
            .to_string();
        }

        json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": pid,
                "activity": {
                    "details": if details.is_empty() { "Jugando en GhosttyLauncher" } else { details },
                    "state": if state.is_empty() { "En el menú principal" } else { state },
                    "timestamps": {
                        "start": *START_TIMESTAMP
                    },
                    "assets": {
                        "large_image": "minecraft_logo",
                        "large_text": "GhosttyLauncher"
                    }
                }
            },
            "nonce": nonce
        })
        .to_string()
    }

    #[cfg(unix)]
    fn send_ipc_activity(enabled: bool, details: &str, state: &str) -> Result<(), String> {
        use std::os::unix::net::UnixStream;
        use std::path::PathBuf;
        use std::time::Duration;

        let mut candidate_dirs: Vec<PathBuf> = Vec::new();
        if let Ok(xdg) = env::var("XDG_RUNTIME_DIR") {
            let base = PathBuf::from(&xdg);
            candidate_dirs.push(base.clone());
            candidate_dirs.push(base.join("app/com.discordapp.Discord"));
            candidate_dirs.push(base.join("snap.discord"));
        }
        candidate_dirs.push(PathBuf::from("/tmp"));

        let mut connected_stream: Option<UnixStream> = None;
        'outer: for dir in candidate_dirs {
            for i in 0..10 {
                let sock_path = dir.join(format!("discord-ipc-{}", i));
                if sock_path.exists() {
                    if let Ok(s) = UnixStream::connect(&sock_path) {
                        let _ = s.set_read_timeout(Some(Duration::from_secs(2)));
                        let _ = s.set_write_timeout(Some(Duration::from_secs(2)));
                        connected_stream = Some(s);
                        break 'outer;
                    }
                }
            }
        }

        let mut stream = connected_stream.ok_or("Discord IPC socket no encontrado")?;
        let handshake = json!({
            "v": 1,
            "client_id": DISCORD_CLIENT_ID
        })
        .to_string();

        Self::write_frame(&mut stream, 0, &handshake)?;
        let _ = Self::read_frame(&mut stream)?;

        let activity = Self::build_activity_packet(enabled, details, state);
        Self::write_frame(&mut stream, 1, &activity)?;
        let _ = Self::read_frame(&mut stream);
        Ok(())
    }

    #[cfg(windows)]
    fn send_ipc_activity(enabled: bool, details: &str, state: &str) -> Result<(), String> {
        use std::fs::OpenOptions;

        let mut connected_pipe = None;
        for i in 0..10 {
            let pipe_name = format!(r"\\?\pipe\discord-ipc-{}", i);
            if let Ok(f) = OpenOptions::new().read(true).write(true).open(&pipe_name) {
                connected_pipe = Some(f);
                break;
            }
        }

        let mut pipe = connected_pipe.ok_or("Discord IPC pipe no encontrado")?;
        let handshake = json!({
            "v": 1,
            "client_id": DISCORD_CLIENT_ID
        })
        .to_string();

        Self::write_frame(&mut pipe, 0, &handshake)?;
        let _ = Self::read_frame(&mut pipe)?;

        let activity = Self::build_activity_packet(enabled, details, state);
        Self::write_frame(&mut pipe, 1, &activity)?;
        let _ = Self::read_frame(&mut pipe);
        Ok(())
    }
}

