//! NoteForge Desktop — Tauri 入口

use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

mod commands;
mod git_history;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let core = commands::init_core(app.handle()).map_err(|e| e.to_string())?;
            let git = app.path().app_data_dir().ok().and_then(|dir| git_history::GitHistory::open(dir).ok());
            app.manage(commands::AppState { core: std::sync::Mutex::new(core), git: std::sync::Mutex::new(git) });

            let app_handle = app.handle().clone();
            let window = app.get_webview_window("main").ok_or("main window missing")?;
            let search_window = window.clone();
            app.global_shortcut().on_shortcut("CmdOrCtrl+K", move |_, _, _| { let _ = search_window.show(); let _ = search_window.set_focus(); }).map_err(|e| e.to_string())?;
            let show_item = MenuItem::with_id(&app_handle, "show", "显示/隐藏", true, None::<&str>).map_err(|e| e.to_string())?;
            let quit_item = MenuItem::with_id(&app_handle, "quit", "退出", true, None::<&str>).map_err(|e| e.to_string())?;
            let menu = Menu::with_items(&app_handle, &[&show_item, &quit_item]).map_err(|e| e.to_string())?;
            TrayIconBuilder::new().icon(app.default_window_icon().unwrap().clone()).menu(&menu).build(&app_handle).map_err(|e| e.to_string())?;
            app_handle.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); },
                "quit" => app.exit(0),
                _ => {}
            });
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
            commands::search_notes_fuzzy,
            commands::search_in_note,
            commands::search_notes_advanced,
            commands::init_encryption,
            commands::is_encryption_enabled,
            commands::disable_encryption,
            commands::create_notebook,
            commands::rename_notebook,
            commands::delete_notebook,
            commands::list_notebooks,
            commands::list_tags,
            commands::list_note_versions,
            commands::list_note_branches,
            commands::create_note_version,
            commands::checkout_note_version,
            commands::checkout_note_branch,
            commands::create_note_branch,
            commands::delete_note_branch,
            commands::get_note_version_content,
            commands::compare_note_versions,
            commands::delete_note_version,
            // Feature 1: Version Diff
            commands::get_version_diff,
            commands::compare_versions_with_context,
            commands::get_version_diff_stat,
            // Feature 2: Offline Search
            commands::search_versions,
            commands::search_notes_with_versions,
            commands::get_version_metadata,
            // Feature 3: Milestone Management
            commands::create_milestone,
            commands::list_milestones,
            commands::get_milestone,
            commands::update_milestone,
            commands::delete_milestone,
            commands::checkout_milestone,
            // Feature 4: Export & Backup
            commands::export_note,
            commands::export_notebook,
            commands::backup_note,
            commands::restore_note,
            // Feature 5: Performance Optimization
            commands::list_note_versions_cached,
            commands::get_version_diff_cached,
            commands::search_versions_cached,
            commands::clear_cache,
            commands::get_cache_stats,
        ])
        .run(tauri::generate_context!())
        .expect("启动 NoteForge 失败");
}
