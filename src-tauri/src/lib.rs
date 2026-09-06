use std::{
  fs::OpenOptions,
  io::{Read, Write},
  net::{SocketAddr, TcpListener, TcpStream},
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
  },
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use uuid::Uuid;

const STARTUP_TIMEOUT: Duration = Duration::from_secs(45);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(100);
const HEALTH_IO_TIMEOUT: Duration = Duration::from_millis(750);
const STARTUP_TARGET: Duration = Duration::from_secs(5);

fn timestamp_ms() -> u128 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or_default()
}

fn append_startup_log(path: &Path, message: &str) {
  if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
    let _ = writeln!(file, "{} {message}", timestamp_ms());
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
  let mut stream = match TcpStream::connect_timeout(&addr, HEALTH_IO_TIMEOUT) {
    Ok(stream) => stream,
    Err(_) => return false,
  };
  let _ = stream.set_read_timeout(Some(HEALTH_IO_TIMEOUT));
  let _ = stream.set_write_timeout(Some(HEALTH_IO_TIMEOUT));
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
  append_startup_log(log_path, &format!("ERROR {message}"));
  let _ = window.set_title("Study Bible Creator — Startup problem");
  let script = format!("window.showStartupError && window.showStartupError({message:?});");
  let _ = window.eval(script);
}

fn update_startup_status(window: &WebviewWindow, title: &str, detail: &str) {
  let script = format!(
    "window.updateStartupStatus && window.updateStartupStatus({title:?}, {detail:?});"
  );
  let _ = window.eval(script);
}

fn push_diagnostic(buffer: &Arc<Mutex<Vec<String>>>, line: String) {
  if let Ok(mut lines) = buffer.lock() {
    lines.push(line);
    if lines.len() > 30 {
      let excess = lines.len() - 30;
      lines.drain(0..excess);
    }
  }
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
      let startup_started = Instant::now();

      // Create the UI immediately. Engine startup and readiness checks happen in
      // background tasks so the window remains responsive even on a slow first run.
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
      append_startup_log(&log_path, &format!("app_version={}", env!("CARGO_PKG_VERSION")));
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
      append_startup_log(&log_path, &format!("reserved_port={port}"));

      let command = match app.shell().sidecar("sbc-engine") {
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

      let (mut rx, child) = match command
        .arg(server_script.as_os_str())
        .env("PORT", port.to_string())
        .env("SBC_DESKTOP_DATA_DIR", data_dir.as_os_str())
        .env("SBC_DESKTOP_TOKEN", &token)
        .env("SBC_APP_VERSION", env!("CARGO_PKG_VERSION"))
        .spawn()
      {
        Ok(pair) => pair,
        Err(error) => {
          mark_startup_failure(
            &window,
            &log_path,
            &format!("The bundled local engine failed to start: {error}"),
          );
          return Ok(());
        }
      };

      append_startup_log(&log_path, "sidecar_spawned=true");
      let diagnostics = Arc::new(Mutex::new(Vec::<String>::new()));
      let terminated = Arc::new(AtomicBool::new(false));

      // Keep the child handle alive and consume stdout/stderr for the lifetime of
      // the engine. This turns opaque 10-second timeouts into actionable errors.
      let event_log_path = log_path.clone();
      let event_diagnostics = Arc::clone(&diagnostics);
      let event_terminated = Arc::clone(&terminated);
      tauri::async_runtime::spawn(async move {
        let _child_guard = child;
        while let Some(event) = rx.recv().await {
          match event {
            CommandEvent::Stdout(bytes) => {
              let line = String::from_utf8_lossy(&bytes).trim().to_string();
              if !line.is_empty() {
                append_startup_log(&event_log_path, &format!("sidecar_stdout={line}"));
                push_diagnostic(&event_diagnostics, format!("stdout: {line}"));
              }
            }
            CommandEvent::Stderr(bytes) => {
              let line = String::from_utf8_lossy(&bytes).trim().to_string();
              if !line.is_empty() {
                append_startup_log(&event_log_path, &format!("sidecar_stderr={line}"));
                push_diagnostic(&event_diagnostics, format!("stderr: {line}"));
              }
            }
            CommandEvent::Error(error) => {
              append_startup_log(&event_log_path, &format!("sidecar_error={error}"));
              push_diagnostic(&event_diagnostics, format!("error: {error}"));
            }
            CommandEvent::Terminated(payload) => {
              event_terminated.store(true, Ordering::SeqCst);
              let line = format!(
                "sidecar_terminated code={:?} signal={:?}",
                payload.code, payload.signal
              );
              append_startup_log(&event_log_path, &line);
              push_diagnostic(&event_diagnostics, line);
            }
            _ => {}
          }
        }
      });

      let ready_window = window.clone();
      let ready_log_path = log_path.clone();
      let ready_diagnostics = Arc::clone(&diagnostics);
      let ready_terminated = Arc::clone(&terminated);
      thread::spawn(move || {
        let mut slow_notice_shown = false;
        loop {
          if server_is_healthy(port) {
            let elapsed = startup_started.elapsed();
            append_startup_log(
              &ready_log_path,
              &format!("server_ready_ms={}", elapsed.as_millis()),
            );
            if elapsed > STARTUP_TARGET {
              append_startup_log(
                &ready_log_path,
                &format!("PERF startup_target_exceeded target_ms={} actual_ms={}", STARTUP_TARGET.as_millis(), elapsed.as_millis()),
              );
            }
            let url = match format!("http://127.0.0.1:{port}/__desktop_auth?token={token}").parse() {
              Ok(url) => url,
              Err(error) => {
                mark_startup_failure(&ready_window, &ready_log_path, &format!("Could not create the local application URL: {error}"));
                return;
              }
            };
            if let Err(error) = ready_window.navigate(url) {
              mark_startup_failure(&ready_window, &ready_log_path, &format!("The workspace could not be opened: {error}"));
              return;
            }
            let _ = ready_window.set_focus();
            append_startup_log(&ready_log_path, "main_window_navigated=true");
            return;
          }

          if ready_terminated.load(Ordering::SeqCst) {
            let details = ready_diagnostics
              .lock()
              .ok()
              .map(|lines| lines.join(" | "))
              .unwrap_or_default();
            let message = if details.is_empty() {
              "The bundled local engine stopped before it became ready. See startup.log in the app data folder.".to_string()
            } else {
              format!("The bundled local engine stopped before it became ready. {details}")
            };
            mark_startup_failure(&ready_window, &ready_log_path, &message);
            return;
          }

          let elapsed = startup_started.elapsed();
          if !slow_notice_shown && elapsed >= Duration::from_secs(8) {
            slow_notice_shown = true;
            update_startup_status(
              &ready_window,
              "Still starting the local engine",
              "First launch can be slower while Windows verifies newly installed files. Study Bible Creator is still checking the engine.",
            );
            append_startup_log(&ready_log_path, "startup_slow_notice=true");
          }
          if elapsed >= STARTUP_TIMEOUT {
            let details = ready_diagnostics
              .lock()
              .ok()
              .map(|lines| lines.join(" | "))
              .unwrap_or_default();
            let message = if details.is_empty() {
              "The local database engine did not become ready within 45 seconds. See startup.log in the app data folder.".to_string()
            } else {
              format!("The local database engine did not become ready within 45 seconds. {details}")
            };
            mark_startup_failure(&ready_window, &ready_log_path, &message);
            return;
          }
          thread::sleep(HEALTH_POLL_INTERVAL);
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Study Bible Creator");
}
