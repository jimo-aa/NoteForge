//! NoteForge Desktop — Tauri 入口

use tauri::Manager;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let conn = commands::init_db(app.handle()).map_err(|e| e.to_string())?;
            app.manage(commands::AppState { db: std::sync::Mutex::new(conn) });
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") { window.open_devtools(); }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_version,
            commands::get_app_info,
            commands::create_note,
            commands::get_note,
            commands::update_note,
            commands::delete_note,
            commands::list_notes,
            commands::search_notes,
            commands::create_notebook,
            commands::list_notebooks,
            commands::list_tags,
        ])
        .run(tauri::generate_context!())
        .expect("启动 NoteForge 失败");
}
