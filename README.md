# GhosttyLauncher

Launcher de Minecraft escrito en Rust + Tauri 2, con frontend React/TypeScript y foco en
Linux (WebKitGTK), con interfaz en español.

> **Estado: 0.1.0 — en desarrollo.** Soporta lanzamiento vanilla, Fabric y Quilt.
> Forge y NeoForge están deshabilitados a propósito hasta que el instalador esté
> implementado (ver *Limitaciones*). La descarga automática de Java llega en la
> siguiente fase: por ahora se detectan los runtimes instalados en el sistema.

## Stack

- **Backend:** Rust 2021 · Tauri 2.12 · reqwest (rustls) · tokio
- **Frontend:** React 18 · TypeScript 5 · Vite 6 · Tailwind 3 · framer-motion
- **Datos:** `~/.local/share/GhosttyLauncher/` (Linux), con `instances/`, `libraries/`,
  `assets/`, `versions/`, `runtimes/` y `caches/`

## Requisitos

- Node 20+ y pnpm/npm
- Rust stable y las dependencias de Tauri 2 para tu distro
- `webkit2gtk-4.1`, GTK 3
- Java 17/21 en el sistema (o configurar la ruta en Ajustes → Java)

## Desarrollo

```bash
npm install
npm run tauri dev
```

Build de producción:

```bash
npm run tauri build
```

## Variables de entorno

| Variable | Efecto |
|---|---|
| `GHOSTTY_COMPOSITOR=shm` | Fuerza `WEBKIT_DMABUF_RENDERER_FORCE_SHM=1` (workaround de WebKitGTK) |
| `GHOSTTY_COMPOSITOR=texturemapper` | Fuerza `WEBKIT_USE_SKIA_FOR_COMPOSITION=0` (solo diagnóstico: pierde `filter`) |

Cualquier `WEBKIT_*` exportado por el usuario tiene prioridad sobre el launcher.

## Limitaciones conocidas (0.1.0)

- **Forge/NeoForge no soportados.** La UI ya no los ofrece; los packs que los requieren
  fallan con un mensaje explícito en lugar de crear una instancia rota.
- **Java:** detección de runtimes instalados y descarga de Eclipse Temurin (Adoptium)
  verificada por SHA-256.
- **Catálogo:** solo Modrinth. CurseForge y FTB no tienen backend todavía.
- **Sin** gestión de mundos, servidores, backups ni crash reports.
- Probado en Linux (Wayland/Hyprland). Windows y macOS sin verificar.

## Licencia

GPL-3.0. Ver [LICENSE](LICENSE).
