#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("MALLOC_TRIM_THRESHOLD_").is_none() {
            std::env::set_var("MALLOC_TRIM_THRESHOLD_", "65536");
        }
        if std::env::var_os("MALLOC_MMAP_THRESHOLD_").is_none() {
            std::env::set_var("MALLOC_MMAP_THRESHOLD_", "65536");
        }
        if std::env::var_os("WEBKIT_SKIA_ENABLE_CPU_RENDERING").is_none()
            && std::env::var_os("GHOSTTY_GPU_RENDERING").map_or(true, |v| v != "1")
        {
            std::env::set_var("WEBKIT_SKIA_ENABLE_CPU_RENDERING", "1");
        }
    }

    ghostty_launcher_lib::run();
}
