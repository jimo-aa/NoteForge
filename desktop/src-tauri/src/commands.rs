use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

use noteforge_core::{md_engine::MarkdownEngine, search::{SearchEngine, SearchPage}, storage::LocalStorage, types::*, types::SyncQueueItem};
use noteforge_core::metrics::MetricsData;

const MAX_NOTES_RETURNED: usize = 10_000;
const SLOW_COMMAND_THRESHOLD_MS: u128 = 100;



/// 计时宏：记录 Tauri 命令执行时间，超过阈值时输出性能日志
macro_rules! timed_command {
    ($name:expr, $body:expr) => {{
        let _start = std::time::Instant::now();
        let _result = $body;
        let _elapsed = _start.elapsed().as_millis();
        if _elapsed > SLOW_COMMAND_THRESHOLD_MS {
            println!("[Perf] command '{}' took {}ms (slow)", $name, _elapsed);
        }
        _result
    }};
}


// ============================================================
// 使用统计 (Usage Metrics)
// ============================================================

use std::sync::Mutex as StdMutex;

lazy_static::lazy_static! {
    static ref METRICS: StdMutex<Option<noteforge_core::metrics::MetricsManager>> = StdMutex::new(None);
}

/// Initialize the metrics manager (called once from setup).
pub fn init_metrics(app_data_dir: &std::path::Path) {
    let metrics_path = app_data_dir.join("metrics.db");
    match noteforge_core::metrics::MetricsManager::open(&metrics_path) {
        Ok(mgr) => {
            if let Ok(mut guard) = METRICS.lock() {
                *guard = Some(mgr);
            }
        }
        Err(e) => eprintln!("[metrics] Failed to open metrics db: {e}"),
    }
}

/// Record a launch event — called from setup.
pub fn record_launch() {
    if let Ok(guard) = METRICS.lock() {
        if let Some(ref m) = *guard {
            let _ = m.record_launch();
        }
    }
}

#[tauri::command]
pub fn record_metric(name: String, value: i64) -> Result<(), String> {
    let guard = METRICS.lock().map_err(|e| e.to_string())?;
    let m = guard.as_ref().ok_or("Metrics not initialized")?;
    match name.as_str() {
        "note_created" => m.record_note_created().map_err(|e| e.to_string()),
        "edit_session" => m.record_edit_session(value as u64).map_err(|e| e.to_string()),
        "search" => m.record_search().map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn get_metrics() -> Result<MetricsData, String> {
    let guard = METRICS.lock().map_err(|e| e.to_string())?;
    let m = guard.as_ref().ok_or("Metrics not initialized")?;
    m.get_metrics().map_err(|e| e.to_string())
}

// Re-export versioning types from core
pub use noteforge_core::types::{NoteSnapshot, DiffResult, DiffOperation, ChangeSummary};

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("核心初始化失败: {0}")]
    Init(String),
    #[error("路径错误")]
    Path,
}

pub struct AppState {
    pub core: Mutex<NoteForgeDesktopCore>,
}

pub struct NoteForgeDesktopCore {
    pub storage: LocalStorage,
    pub search: SearchEngine,
    pub encryption: Option<noteforge_core::encryption::EncryptionManager>,
}

impl NoteForgeDesktopCore {
    pub fn open(data_dir: PathBuf) -> Result<Self, noteforge_core::error::CoreError> {
        std::fs::create_dir_all(&data_dir)?;
        let storage = LocalStorage::open(data_dir.join("noteforge.db"))?;
        let mut search = SearchEngine::open(data_dir.join("index"))?;

        // Auto-rebuild search index if schema version mismatch
        if search.needs_rebuild() {
            println!("🔄 检测到搜索索引 schema 版本不匹配，正在重建...");
            let all_notes = storage.list_notes(None, 100_000, 0)?;
            let ids: Vec<&str> = all_notes.iter().map(|n| n.id.as_str()).collect();
            let notes_with_content = storage.get_notes_batch(&ids)?;

            let indexable: Vec<noteforge_core::search::IndexableNote> = notes_with_content.iter().map(|n| {
                let index_content = if n.content_plain.is_empty() { &n.content } else { &n.content_plain };
                noteforge_core::search::IndexableNote {
                    id: n.meta.id.clone(),
                    title: n.meta.title.clone(),
                    content: index_content.clone(),
                    tags: n.meta.tags.clone(),
                    updated_at: n.meta.updated_at,
                }
            }).collect();

            search.rebuild_index(&indexable)?;
            println!("🔄 搜索索引重建完成: {} 条笔记", indexable.len());
        }

        Ok(Self { storage, search, encryption: None })
    }
}

pub fn init_core(app: &AppHandle) -> Result<NoteForgeDesktopCore, CoreError> {
    let path = app.path().app_data_dir().map_err(|_| CoreError::Path)?;
    NoteForgeDesktopCore::open(path).map_err(|e| CoreError::Init(e.to_string()))
}



#[tauri::command] pub fn get_version() -> String { env!("CARGO_PKG_VERSION").to_string() }
#[tauri::command] pub fn get_app_info() -> serde_json::Value { serde_json::json!({"name":"NoteForge","version":env!("CARGO_PKG_VERSION"),"description":"全平台智能笔记系统","offline":true}) }
#[tauri::command] pub fn render_markdown(markdown: String) -> String { MarkdownEngine::render_html(&markdown) }

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, request: CreateNoteRequest) -> Result<Note, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    let note = core.storage.create_note(&request).map_err(|e| e.to_string())?;
    let index_content = if note.content_plain.is_empty() { &note.content } else { &note.content_plain };
    let _ = core.search.add_note(&note.meta.id, &note.meta.title, index_content, &note.meta.tags, note.meta.updated_at);
    let _ = core.search.commit();
    drop(core);
    Ok(note)
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Option<Note>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    match core.storage.get_note(&id) {
        Ok(note) => Ok(Some(note)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn update_note(state: State<'_, AppState>, id: String, title: Option<String>, content: Option<String>, tags: Option<Vec<String>>, is_pinned: Option<bool>, is_favorite: Option<bool>) -> Result<Option<Note>, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    let original = match core.storage.get_note(&id) {
        Ok(n) => n,
        Err(_) => return Ok(None),
    };
    
    // Auto-snapshot: when content changes, create an auto snapshot
    if let Some(ref new_content) = content {
        if new_content != &original.content {
            let plain = noteforge_core::md_engine::MarkdownEngine::extract_plain_text(new_content);
            let wc = noteforge_core::md_engine::MarkdownEngine::count_words(new_content);
            if let Err(e) = core.storage.create_auto_snapshot(&id, new_content, &plain, wc) {
                eprintln!("[versioning] auto-snapshot failed: {e}");
            }
        }
    }
    
    let next = UpdateNoteRequest { title, content, notebook_id: None, tags, is_pinned, is_favorite };
    let note = core.storage.update_note(&id, &next).map_err(|e| e.to_string())?;
    let index_content = if note.content_plain.is_empty() { &note.content } else { &note.content_plain };
    let _ = core.search.add_note(&note.meta.id, &note.meta.title, index_content, &note.meta.tags, note.meta.updated_at);
    let _ = core.search.commit();
    drop(core);
    Ok(Some(note))
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.delete_note(&id).map_err(|e| e.to_string())?;
    let _ = core.search.remove_note(&id);
    let _ = core.search.commit();
    Ok(true)
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let metas = core.storage.list_notes(None, MAX_NOTES_RETURNED, 0).map_err(|e| e.to_string())?;
    let ids: Vec<&str> = metas.iter().map(|m| m.id.as_str()).collect();
    core.storage.get_notes_batch(&ids).map_err(|e| e.to_string())
}

/// 返回笔记元数据列表（不含 content，适用于侧边栏列表）
#[tauri::command]
pub fn list_note_metas(state: State<'_, AppState>) -> Result<Vec<NoteMeta>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.list_notes(None, MAX_NOTES_RETURNED, 0).map_err(|e| e.to_string())
}

/// 获取笔记的反向链接（哪些笔记引用了当前笔记的标题）
#[tauri::command]
pub fn get_backlinks_with_titles(state: State<'_, AppState>, note_id: String) -> Result<Vec<noteforge_core::types::BacklinkEntry>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.get_backlinks_with_titles(&note_id).map_err(|e| e.to_string())
}

// ============================================================
// 同步队列命令
// ============================================================

#[tauri::command]
pub fn enqueue_sync_change(state: State<'_, AppState>, note_id: String, operation: String, payload: String) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.enqueue_sync_change(&note_id, &operation, &payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pending_sync_changes(state: State<'_, AppState>) -> Result<Vec<SyncQueueItem>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.get_pending_sync_changes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn count_pending_sync_changes(state: State<'_, AppState>) -> Result<i64, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.count_pending_sync_changes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_sync_changes(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let id_refs: Vec<&str> = ids.iter().map(|s| s.as_str()).collect();
    core.storage.remove_sync_changes(&id_refs).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_sync_queue(state: State<'_, AppState>) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.clear_sync_queue().map_err(|e| e.to_string())
}

#[tauri::command] 
pub fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> { 
    timed_command!("search_notes", {
        state.core.lock().map_err(|e| e.to_string())?.search.search(&query, 1000).map_err(|e| e.to_string())
    })
}

/// 模糊搜索 - 支持部分匹配和容错
#[tauri::command] 
pub fn search_notes_fuzzy(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> { 
    timed_command!("search_notes_fuzzy", {
        state.core.lock()
            .map_err(|e| e.to_string())?
            .search
            .search_fuzzy(&query, 1000)
            .map_err(|e| e.to_string())
    })
}

/// 在特定笔记中搜索
#[tauri::command]
pub fn search_in_note(state: State<'_, AppState>, note_id: String, query: String) -> Result<Vec<SearchResult>, String> {
    timed_command!("search_in_note", {
        state.core.lock()
            .map_err(|e| e.to_string())?
            .search
            .search_in_note(&note_id, &query, 1000)
            .map_err(|e| e.to_string())
    })
}

/// Rebuild the search index from scratch using all notes from storage.
/// Called automatically on startup if schema version mismatch is detected,
/// Commit the search index writer to flush pending changes to disk.
/// Called after save operations to ensure search results are up-to-date.
#[tauri::command]
pub fn commit_search_index(state: State<'_, AppState>) -> Result<(), String> {
    timed_command!("commit_search_index", {
        let mut core = state.core.lock().map_err(|e| e.to_string())?;
        core.search.commit().map_err(|e| e.to_string())
    })
}

/// and can also be triggered manually from the frontend.
#[tauri::command]
pub fn reindex_search_index(state: State<'_, AppState>) -> Result<(), String> {
    timed_command!("reindex_search_index", {
        let mut core = state.core.lock().map_err(|e| e.to_string())?;
        let all_notes = core.storage.list_notes(None, 100_000, 0).map_err(|e| e.to_string())?;
        let ids: Vec<&str> = all_notes.iter().map(|n| n.id.as_str()).collect();
        let notes_with_content = core.storage.get_notes_batch(&ids).map_err(|e| e.to_string())?;
        
        let indexable: Vec<noteforge_core::search::IndexableNote> = notes_with_content.iter().map(|n| {
            let index_content = if n.content_plain.is_empty() { &n.content } else { &n.content_plain };
            noteforge_core::search::IndexableNote {
                id: n.meta.id.clone(),
                title: n.meta.title.clone(),
                content: index_content.clone(),
                tags: n.meta.tags.clone(),
                updated_at: n.meta.updated_at,
            }
        }).collect();
        
        core.search.rebuild_index(&indexable).map_err(|e| e.to_string())?;
        println!("🔄 搜索索引重建完成: {} 条笔记已索引", indexable.len());
        Ok(())
    })
}

/// 高级搜索 - 支持自定义 limit/offset，返回分页结果（含总命中数）
#[tauri::command]
pub fn search_notes_advanced(state: State<'_, AppState>, query: String, limit: usize, offset: usize) -> Result<SearchPage, String> {
    timed_command!("search_notes_advanced", {
        let core = state.core.lock().map_err(|e| e.to_string())?;
        let options = noteforge_core::search::SearchOptions { limit, offset };
        core.search.search_paginated(&query, options).map_err(|e| e.to_string())
    })
}

// ============================================================
// 加密与安全 (Encryption)
// ============================================================

/// 初始化加密 - 从密码派生密钥并持久化盐值
#[tauri::command]
pub fn init_encryption(state: State<'_, AppState>, password: String) -> Result<String, String> {
    use noteforge_core::encryption::EncryptionManager;
    
    let salt = EncryptionManager::generate_salt();
    let key = EncryptionManager::derive_key_from_password(&password, &salt)
        .map_err(|e| format!("密钥派生失败: {}", e))?;
    
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    
    // 持久化盐值到 SQLite
    core.storage.store_encryption_salt(&salt)
        .map_err(|e| format!("存储加密盐值失败: {}", e))?;
    
    let mut em = EncryptionManager::new();
    em.initialize(key);
    core.storage.set_encryption(em.clone());
    core.encryption = Some(em);
    
    Ok(salt)
}

/// 检查数据库中是否有持久化的加密盐值（表示已设置过加密）
#[tauri::command]
pub fn has_stored_encryption(state: State<'_, AppState>) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.has_encryption_salt().map_err(|e| e.to_string())
}

/// 尝试用密码解锁加密（恢复会话）
/// 需要用户输入之前设置过的密码
#[tauri::command]
pub fn try_unlock_encryption(state: State<'_, AppState>, password: String) -> Result<bool, String> {
    use noteforge_core::encryption::EncryptionManager;
    
    let core = state.core.lock().map_err(|e| e.to_string())?;
    
    // 获取存储的盐值
    let salt = match core.storage.get_encryption_salt().map_err(|e| e.to_string())? {
        Some(s) => s,
        None => return Err("未找到加密盐值，请先设置加密".to_string()),
    };
    
    // 用密码 + 盐值重新派生密钥
    let key = EncryptionManager::derive_key_from_password(&password, &salt)
        .map_err(|e| format!("密码验证失败: {}", e))?;
    
    drop(core);
    
    // 初始化加密管理器并设置到存储层
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    let mut em = EncryptionManager::new();
    em.initialize(key);
    core.storage.set_encryption(em.clone());
    core.encryption = Some(em);
    
    println!("🔐 加密已通过密码解锁");
    Ok(true)
}

/// 验证加密状态
#[tauri::command]
pub fn is_encryption_enabled(state: State<'_, AppState>) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    Ok(core.encryption.is_some() && core.storage.has_encryption())
}

/// 禁用加密
#[tauri::command]
pub fn disable_encryption(state: State<'_, AppState>) -> Result<(), String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    core.encryption = None;
    core.storage.clear_encryption();
    core.storage.clear_encryption_metadata().map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command] pub fn list_notebooks(state: State<'_, AppState>) -> Result<Vec<Notebook>, String> { state.core.lock().map_err(|e| e.to_string())?.storage.list_notebooks().map_err(|e| e.to_string()) }
#[tauri::command] pub fn create_notebook(state: State<'_, AppState>, name: String, icon: Option<String>, color: Option<String>) -> Result<Notebook, String> { state.core.lock().map_err(|e| e.to_string())?.storage.create_notebook(&name, icon.as_deref(), color.as_deref()).map_err(|e| e.to_string()) }
#[tauri::command]
pub fn rename_notebook(state: State<'_, AppState>, id: String, name: String) -> Result<Notebook, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.rename_notebook(&id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_notebook(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.delete_notebook(&id).map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command] pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> { Ok(state.core.lock().map_err(|e| e.to_string())?.storage.list_tags().map_err(|e| e.to_string())?.into_iter().map(|t| t.name).collect()) }

// ============================================================
// 版本快照管理 (NoteSnapshot) — 替代旧的 git.history + milestone
// ============================================================

#[tauri::command]
pub fn list_snapshots(state: State<'_, AppState>, note_id: String) -> Result<Vec<NoteSnapshot>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.list_snapshots(&note_id).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn create_manual_snapshot(state: State<'_, AppState>, note_id: String, title: String, description: String) -> Result<NoteSnapshot, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.create_manual_snapshot(&note_id, &title, &description).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_snapshot_content(state: State<'_, AppState>, snapshot_id: String) -> Result<NoteSnapshot, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.get_snapshot(&snapshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_snapshot(state: State<'_, AppState>, note_id: String, snapshot_id: String) -> Result<Note, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let snapshot = core.storage.get_snapshot(&snapshot_id).map_err(|e| e.to_string())?;
    let req = UpdateNoteRequest {
        title: Some(snapshot.title),
        content: Some(snapshot.content),
        notebook_id: None,
        tags: None,
        is_pinned: None,
        is_favorite: None,
    };
    core.storage.update_note(&note_id, &req).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_snapshot(state: State<'_, AppState>, snapshot_id: String) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.delete_snapshot(&snapshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tag_snapshot(state: State<'_, AppState>, snapshot_id: String, title: String, description: String) -> Result<NoteSnapshot, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.tag_snapshot(&snapshot_id, &title, &description).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn compare_snapshots(state: State<'_, AppState>, _note_id: String, from_snapshot_id: String, to_snapshot_id: String) -> Result<DiffResult, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let from = core.storage.get_snapshot(&from_snapshot_id).map_err(|e| e.to_string())?;
    let to = core.storage.get_snapshot(&to_snapshot_id).map_err(|e| e.to_string())?;
    drop(core);
    let (fl, tl) = (from.content.lines().collect::<Vec<_>>(), to.content.lines().collect::<Vec<_>>());
    let ops = lcs_diff(&fl, &tl);
    let total = fl.len().max(tl.len());
    let sim = if total > 0 { lcs_table(&fl, &tl)[fl.len()][tl.len()] as f32 / total as f32 } else { 1.0 };
    Ok(DiffResult { from_version: from_snapshot_id, to_version: to_snapshot_id, operations: ops, similarity: sim, change_summary: compute_change_summary(&from.content, &to.content) })
}

#[tauri::command]
pub fn count_snapshots(state: State<'_, AppState>, note_id: String) -> Result<u32, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.count_snapshots(&note_id).map_err(|e| e.to_string())
}

// ============================================================
// LCS Diff 函数
// ============================================================

fn lcs_table(a: &[&str], b: &[&str]) -> Vec<Vec<usize>> {
    let (m, n) = (a.len(), b.len());
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 1..=m { for j in 1..=n { dp[i][j] = if a[i-1] == b[j-1] { dp[i-1][j-1] + 1 } else { dp[i-1][j].max(dp[i][j-1]) }; } }
    dp
}

fn lcs_diff(from: &[&str], to: &[&str]) -> Vec<DiffOperation> {
    let dp = lcs_table(from, to);
    let (mut i, mut j) = (from.len(), to.len());
    let mut rev = Vec::new();
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && from[i-1] == to[j-1] { i -= 1; j -= 1; }
        else if j > 0 && (i == 0 || dp[i][j-1] >= dp[i-1][j]) {
            rev.push(DiffOperation { op_type: "add".into(), line_num: j as u32, old_text: None, new_text: Some(to[j-1].to_string()), context: format!("Added at line {}", j) });
            j -= 1;
        } else if i > 0 {
            rev.push(DiffOperation { op_type: "remove".into(), line_num: i as u32, old_text: Some(from[i-1].to_string()), new_text: None, context: format!("Removed at line {}", i) });
            i -= 1;
        }
    }
    rev.reverse();
    rev
}

fn compute_change_summary(from: &str, to: &str) -> ChangeSummary {
    let (fl, tl) = (from.lines().collect::<Vec<_>>(), to.lines().collect::<Vec<_>>());
    let (mut add, mut rem, mut modif) = (0u32, 0u32, 0u32);
    for (i, fli) in fl.iter().enumerate() { if i >= tl.len() { rem += 1; } else if fli != &tl[i] { modif += 1; } }
    for _ in fl.len()..tl.len() { add += 1; }
    ChangeSummary { lines_added: add, lines_removed: rem, lines_modified: modif, word_count_delta: to.split_whitespace().count() as i32 - from.split_whitespace().count() as i32 }
}

// ============================================================
// 崩溃日志持久化
// ============================================================

use std::time::{SystemTime, UNIX_EPOCH};

fn unix_ts() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

#[tauri::command]
pub fn write_crash_log(app: tauri::AppHandle, crash_data: String) -> Result<String, String> {
    let log_path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("crash");
    std::fs::create_dir_all(&log_path).map_err(|e| e.to_string())?;
    let fp = log_path.join(format!("crash-{}.json", unix_ts()));
    std::fs::write(&fp, &crash_data).map_err(|e| e.to_string())?;
    let mut v: Vec<_> = std::fs::read_dir(&log_path).map_err(|e| e.to_string())?.filter_map(|e| e.ok()).filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false)).collect();
    v.sort_by_key(|e| e.path());
    while v.len() > 10 { if let Some(o) = v.first() { let _ = std::fs::remove_file(o.path()); v.remove(0); } }
    Ok(fp.to_string_lossy().to_string())
}

// ============================================================
// 存储位置管理
// ============================================================

#[tauri::command]
pub fn get_primary_root(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.get_primary_root().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_primary_root(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.set_primary_root(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_storage_roots(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.get_storage_roots().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_extra_root(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    // Validate directory exists
    if !std::path::Path::new(&path).is_dir() {
        return Err("目录不存在或不是一个有效的目录".to_string());
    }
    core.storage.add_extra_root(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_extra_root(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.remove_extra_root(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_dir_for_notes(state: State<'_, AppState>, dir_path: String) -> Result<Vec<noteforge_core::types::ScannedNote>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.scan_directory_for_notes(&dir_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_dir_recursive(state: State<'_, AppState>, dir_path: String) -> Result<Vec<noteforge_core::types::ScannedFileTree>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.scan_directory_recursive(&dir_path).map_err(|e| e.to_string())
}

// ============================================================
// .md 文件读写操作
// ============================================================

/// 将笔记内容写入 .md 文件
#[tauri::command]
pub fn write_note_file(path: String, content: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    std::fs::write(&path, &content).map_err(|e| format!("写入文件失败: {}", e))
}

/// 从 .md 文件读取笔记内容
#[tauri::command]
pub fn read_note_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 删除 .md 文件
#[tauri::command]
pub fn delete_note_file(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path).map_err(|e| format!("删除文件失败: {}", e))
    } else {
        Ok(())
    }
}

/// 列出目录中所有 .md 文件（不递归）
#[tauri::command]
pub fn list_md_files(dir: String) -> Result<Vec<String>, String> {
    let dir_path = std::path::Path::new(&dir);
    if !dir_path.is_dir() {
        return Err("目录不存在".to_string());
    }
    let mut files = Vec::new();
    let entries = std::fs::read_dir(dir_path).map_err(|e| format!("读取目录失败: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path.to_string_lossy().to_string());
        }
    }
    files.sort();
    Ok(files)
}

/// 确保目录存在（不存在则创建）
#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))
}

/// 获取笔记文件的目标路径（基于主存储目录、笔记本 ID 和笔记标题）
#[tauri::command]
pub fn get_note_file_path(state: State<'_, AppState>, notebook_id: String, note_title: String) -> Result<String, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let root = core.storage.get_primary_root()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "请先设置主存储目录".to_string())?;
    
    // Sanitize the title for use as filename
    let safe_title: String = note_title.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect();
    let file_name = format!("{}.md", safe_title.trim());
    
    let note_dir = std::path::Path::new(&root).join(&notebook_id);
    Ok(note_dir.join(&file_name).to_string_lossy().to_string())
}