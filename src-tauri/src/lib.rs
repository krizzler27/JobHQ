use std::fs::OpenOptions;
use std::io::Write;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn log_sidecar_event(line: &str) {
  eprintln!("{}", line);
  let home_opt = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"));
  if let Ok(home) = home_opt {
    let log_path = std::path::Path::new(&home)
      .join(".jobhq")
      .join("logs")
      .join("rust-sidecar.log");

    // Simple rotation / size limit: If log exceeds 5MB, truncate it
    if let Ok(meta) = std::fs::metadata(&log_path) {
      if meta.len() > 5 * 1024 * 1024 {
        let _ = std::fs::remove_file(&log_path);
      }
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
      let now = chrono_lite_now();
      let _ = writeln!(file, "[{}] {}", now, line);
    }
  }
}

fn chrono_lite_now() -> String {
  let datetime = ChronoDatetimeApprox::now();
  datetime.format()
}

struct ChronoDatetimeApprox {
  formatted: String,
}

impl ChronoDatetimeApprox {
  fn now() -> Self {
    let d = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap_or_default();
    let secs = d.as_secs();
    // Format timestamp string without heavy chrono dependency
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    Self {
      formatted: format!("{:02}:{:02}:{:02} UTC", h, m, s),
    }
  }

  fn format(&self) -> String {
    self.formatted.clone()
  }
}

#[derive(Clone, Default)]
struct SidecarState(Arc<Mutex<Option<std::process::Child>>>);

impl SidecarState {
  fn terminate(&self, reason: &str) {
    if let Ok(mut guard) = self.0.lock() {
      if let Some(mut child) = guard.take() {
        let pid = child.id();
        log_sidecar_event(&format!(
          "Terminating sidecar process PID {} (reason: {})...",
          pid, reason
        ));

        // In onedir mode, child is directly the Python process.
        // Attempt clean termination via child.kill() followed by wait().
        let _ = child.kill();
        let _ = child.wait();

        #[cfg(target_os = "windows")]
        {
          // Defensive cleanup fallback in case native child.kill() leaves conhost or threads
          let mut check_cmd = std::process::Command::new("taskkill");
          check_cmd.args(["/F", "/PID", &pid.to_string()]);
          check_cmd.creation_flags(0x08000000);
          let _ = check_cmd.status();
        }
      }
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let sidecar_state = SidecarState::default();

  tauri::Builder::default()
    .runtime(tauri_runtime_wry::Wry::default())
    .manage(sidecar_state.clone())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .setup(|app| {
      app.handle().plugin(tauri_plugin_shell::init())?;
      app.handle().plugin(tauri_plugin_notification::init())?;

      // Launch backend process from bundled resources
      let resource_dir = app.path().resolve("jobhq-backend", BaseDirectory::Resource);
      match resource_dir {
        Ok(dir) => {
          #[cfg(target_os = "windows")]
          let exe_name = "jobhq-backend.exe";
          #[cfg(not(target_os = "windows"))]
          let exe_name = "jobhq-backend";

          let exe_path = dir.join(exe_name);
          log_sidecar_event(&format!("Resolving backend at {:?}", exe_path));
          
          let mut cmd = std::process::Command::new(&exe_path);
          cmd.current_dir(&dir);
          cmd.stdin(Stdio::null());
          cmd.stdout(Stdio::null());
          cmd.stderr(Stdio::null());

          #[cfg(target_os = "windows")]
          {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
          }

          match cmd.spawn() {
            Ok(child) => {
              let pid = child.id();
              log_sidecar_event(&format!("Successfully spawned onedir backend (PID {})", pid));

              if let Some(state) = app.try_state::<SidecarState>() {
                if let Ok(mut guard) = state.0.lock() {
                  *guard = Some(child);
                }
              }
            }
            Err(e) => {
              log_sidecar_event(&format!("Failed to spawn backend at {:?}: {}", exe_path, e));
            }
          }
        }
        Err(e) => {
          log_sidecar_event(&format!("Failed to resolve resource directory: {}", e));
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
            if let Some(state) = app.try_state::<SidecarState>() {
              state.terminate("tray_quit_clicked");
            }
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

      // Fallback safety: If frontend doesn't invoke window.show() within 3s,
      // reveal the window so the app is never left hidden if a script fails.
      if let Some(main_win) = app.get_webview_window("main") {
        let win = main_win.clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(3000));
          if let Ok(is_visible) = win.is_visible() {
            if !is_visible {
              let _ = win.maximize();
              let _ = win.show();
              let _ = win.set_focus();
            }
          }
        });
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |_app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        sidecar_state.terminate("tauri_runevent_exit");
      }
    });
}
