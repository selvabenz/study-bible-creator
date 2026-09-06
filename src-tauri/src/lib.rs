use std::{
  fs::OpenOptions,
  io::{Read, Write},
  net::{SocketAddr, TcpListener, TcpStream},
  path::{Path, PathBuf},
  thread,
  time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

fn append_startup_log(path: &Path, message: &str) {
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
    let _ = writeln!(file, "{message}");
  }
}

fn find_server_script(resource_dir: &Path) -> Option<PathBuf> {
  [
    resource_dir.join("resources").join("app").join("src").join("server.mjs"),
    resource_dir.join("app").join("src").join("server.mjs"),
    resource_dir.join("src").join("server.mjs"),
  ]
  .into_iter()
  .find(|candidate| candidate.is_file())
}

fn server_is_healthy(port: u16) -> bool {
  let addr: SocketAddr = match format!("127.0.0.1:{port}").parse() {
    Ok(addr) => addr,
    Err(_) => return false,
  };
  let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(250)) {
    Ok(stream) => stream,
    Err(_) => return false,
  };
  let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
  if stream
    .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
    .is_err()
  {
    return false;
  }
  let mut response = String::new();
  if stream.read_to_string(&mut response).is_err() {
    return false;
  }
  response.contains("200 OK") && response.contains("\"ok\":true")
}

fn mark_startup_failure(window: &WebviewWindow, log_path: &Path, message: &str) {
  append_startup_log(log_path, &format!("ERROR: {message}"));
  let _ = window.set_title("Study Bible Creator — Startup problem");
  let script = format!("window.showStartupError && window.showStartupError({message:?});");
  let _ = window.eval(script);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }));
  }

  builder
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      // Always create a native app window first. If the local engine fails,
      // the user sees a diagnostic screen instead of a console/blank launch.
      let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("startup.html".into()))
        .title("Study Bible Creator")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 700.0)
        .resizable(true)
        .build()?;

      let data_dir = app.path().app_local_data_dir()?;
      std::fs::create_dir_all(&data_dir)?;
      let log_path = data_dir.join("startup.log");
      let _ = std::fs::write(&log_path, "Study Bible Creator startup\n");

      let resource_dir = app.path().resource_dir()?;
      append_startup_log(&log_path, &format!("resource_dir={}", resource_dir.display()));
      append_startup_log(&log_path, &format!("data_dir={}", data_dir.display()));

      let server_script = match find_server_script(&resource_dir) {
        Some(path) => path,
        None => {
          mark_startup_failure(
            &window,
            &log_path,
            "The bundled local engine could not be found. Please reinstall this build.",
          );
          return Ok(());
        }
      };
      append_startup_log(&log_path, &format!("server_script={}", server_script.display()));

      let listener = TcpListener::bind("127.0.0.1:0")?;
      let port = listener.local_addr()?.port();
      drop(listener);
      let token = Uuid::new_v4().to_string();

      let command = match app.shell().sidecar("node") {
        Ok(command) => command,
        Err(error) => {
          mark_startup_failure(
            &window,
            &log_path,
            &format!("The bundled local engine could not be prepared: {error}"),
          );
          return Ok(());
        }
      };

      match command
        .arg(server_script.as_os_str())
        .env("PORT", port.to_string())
        .env("SBC_DESKTOP_DATA_DIR", data_dir.as_os_str())
        .env("SBC_DESKTOP_TOKEN", &token)
        .env("SBC_APP_VERSION", env!("CARGO_PKG_VERSION"))
        .spawn()
      {
        Ok((_rx, _child)) => append_startup_log(&log_path, "sidecar_spawned=true"),
        Err(error) => {
          mark_startup_failure(
            &window,
            &log_path,
            &format!("The bundled local engine failed to start: {error}"),
          );
          return Ok(());
        }
      }

      let mut ready = false;
      for _ in 0..100 {
        if server_is_healthy(port) {
          ready = true;
          break;
        }
        thread::sleep(Duration::from_millis(100));
      }

      if !ready {
        mark_startup_failure(
          &window,
          &log_path,
          "The local database engine did not become ready within 10 seconds. See startup.log in the app data folder.",
        );
        return Ok(());
      }

      append_startup_log(&log_path, &format!("server_ready=http://127.0.0.1:{port}"));
      let url = format!("http://127.0.0.1:{port}/__desktop_auth?token={token}").parse()?;
      window.navigate(url)?;
      let _ = window.set_focus();
      append_startup_log(&log_path, "main_window_navigated=true");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Study Bible Creator");
}
