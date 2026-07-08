//! NoteForge Desktop — Tauri 入口

use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<Wry>::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
            let core = commands::init_core(app.handle()).map_err(|e| e.to_string())?;
            app.manage(commands::AppState { core: std::sync::Mutex::new(core) });

            // Init usage metrics & record launch
            commands::init_metrics(&app_data);
            commands::record_launch();

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
            commands::list_note_metas,
            commands::search_notes,
            commands::search_notes_fuzzy,
            commands::search_in_note,
            commands::search_notes_advanced,
            commands::init_encryption,
            commands::has_stored_encryption,
            commands::try_unlock_encryption,
            commands::is_encryption_enabled,
            commands::disable_encryption,
            commands::create_notebook,
            commands::rename_notebook,
            commands::delete_notebook,
            commands::list_notebooks,
            commands::list_tags,
            // Snapshot-based Version Management
            commands::list_snapshots,
            commands::create_manual_snapshot,
            commands::get_snapshot_content,
            commands::restore_snapshot,
            commands::delete_snapshot,
            commands::tag_snapshot,
            commands::compare_snapshots,
            commands::count_snapshots,
            // Crash Recovery
            commands::write_crash_log,
            // Wiki Link Backlinks
            commands::get_backlinks_with_titles,
            // Sync Queue
            commands::enqueue_sync_change,
            commands::get_pending_sync_changes,
            commands::count_pending_sync_changes,
            commands::remove_sync_changes,
            commands::clear_sync_queue,
            // Usage Metrics
            commands::record_metric,
            commands::get_metrics,
            // Storage Management
            commands::get_primary_root,
            commands::set_primary_root,
            commands::list_storage_roots,
            commands::add_extra_root,
            commands::remove_extra_root,
            commands::scan_dir_for_notes,
            // .md File Operations
            commands::write_note_file,
            commands::read_note_file,
            commands::delete_note_file,
            commands::list_md_files,
            commands::ensure_dir,
            commands::get_note_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("启动 NoteForge 失败");
}
