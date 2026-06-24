//! NoteForge Desktop — Tauri 入口

use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let core = commands::init_core(app.handle()).map_err(|e| e.to_string())?;
            app.manage(commands::AppState { core: std::sync::Mutex::new(core) });

            let app_handle = app.handle().clone();
            let window = app.get_webview_window("main").ok_or("main window missing")?;
            let search_window = window.clone();
            app.global_shortcut().on_shortcut("CmdOrCtrl+K", move |_, _, _| {
                let _ = search_window.show();
                let _ = search_window.set_focus();
            }).map_err(|e| e.to_string())?;

            let show_item = MenuItem::with_id(&app_handle, "show", "显示/隐藏", true, None::<&str>).map_err(|e| e.to_string())?;
            let quit_item = MenuItem::with_id(&app_handle, "quit", "退出", true, None::<&str>).map_err(|e| e.to_string())?;
            let menu = Menu::with_items(&app_handle, &[&show_item, &quit_item]).map_err(|e| e.to_string())?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .build(&app_handle)
                .map_err(|e| e.to_string())?;

            let app_handle_for_menu = app_handle.clone();
            app.manage(app_handle_for_menu.clone());
            app_handle.on_menu_event(|app, event| {
                match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            });

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") { window.open_devtools(); }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_version,
            commands::get_app_info,
            commands::render_markdown,
            commands::create_note,
            commands::get_note,
            commands::update_note,
            commands::delete_note,
            commands::list_notes,
            commands::search_notes,
            commands::search_note_hits,
            commands::create_notebook,
            commands::rename_notebook,
            commands::delete_notebook,
            commands::list_notebooks,
            commands::list_tags,
        ])
        .run(tauri::generate_context!())
        .expect("启动 NoteForge 失败");
}
