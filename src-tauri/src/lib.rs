use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
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

      // Build System Tray
      let open_i = MenuItem::with_id(app, "open", "Open JobHQ", true, None::<&str>)?;
      let quit_i = MenuItem::with_id(app, "quit", "Quit JobHQ", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&open_i, &quit_i])?;

      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "open" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.unminimize();
              let _ = window.set_focus();
            }
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.unminimize();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

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
