use std::{net::{TcpListener, TcpStream}, thread, time::Duration};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

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
      let listener=TcpListener::bind("127.0.0.1:0")?;
      let port=listener.local_addr()?.port();
      drop(listener);
      let token=Uuid::new_v4().to_string();
      let resource_dir=app.path().resource_dir()?;
      let data_dir=app.path().app_local_data_dir()?;
      std::fs::create_dir_all(&data_dir)?;
      let server_script=resource_dir.join("resources").join("app").join("src").join("server.mjs");
      let command=app.shell().sidecar("node")?
        .arg(server_script.as_os_str())
        .env("PORT", port.to_string())
        .env("SBC_DESKTOP_DATA_DIR", data_dir.as_os_str())
        .env("SBC_DESKTOP_TOKEN", &token);
      let (_rx, _child)=command.spawn()?;
      let addr=format!("127.0.0.1:{port}");
      for _ in 0..80 {
        if TcpStream::connect(&addr).is_ok() { break; }
        thread::sleep(Duration::from_millis(50));
      }
      let url=format!("http://127.0.0.1:{port}/__desktop_auth?token={token}").parse()?;
      WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Study Bible Creator")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 700.0)
        .resizable(true)
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Study Bible Creator");
}
