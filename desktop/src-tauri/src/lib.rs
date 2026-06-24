//! NoteForge Desktop — Tauri 入口
//!
//! 离线优先架构：所有核心功能在本地完成，
//! 不依赖后端 API。

use tauri::Manager;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
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
