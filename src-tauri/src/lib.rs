use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .runtime(tauri_runtime_wry::Wry::default())
    .setup(|app| {
      app.handle().plugin(tauri_plugin_shell::init())?;
      app.handle().plugin(tauri_plugin_notification::init())?;

      // Auto-launch Python sidecar backend on desktop startup
      let sidecar_command = app.shell().sidecar("jobhq-backend");
      match sidecar_command {
        Ok(cmd) => {
          match cmd.spawn() {
            Ok((_rx, _child)) => {
              log::info!("Successfully spawned Python backend sidecar");
            }
            Err(e) => {
              log::warn!("Could not spawn Python sidecar (development mode or already running): {}", e);
            }
          }
        }
        Err(e) => {
          log::warn!("Sidecar not configured: {}", e);
        }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
