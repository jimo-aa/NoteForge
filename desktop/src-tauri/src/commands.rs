use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

use noteforge_core::{md_engine::MarkdownEngine, search::{SearchEngine, SearchPage}, storage::LocalStorage, types::*, types::SyncQueueItem};
use noteforge_core::metrics::MetricsData;

use crate::git_history::{GitBranchEntry, GitHistory, GitVersionEntry};

const MAX_NOTES_RETURNED: usize = 10_000;
const SLOW_COMMAND_THRESHOLD_MS: u128 = 100;

// 导入必要的生成ID和时间函数
use noteforge_core::types::{generate_id, now_ms};

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

// ============================================================
// 性能缓存系统 (Feature 5 - Performance Optimization)
// ============================================================

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

lazy_static::lazy_static! {
    static ref VERSION_CACHE: Mutex<HashMap<String, (Vec<GitVersionEntry>, u64)>> = Mutex::new(HashMap::new());
    static ref DIFF_CACHE: Mutex<HashMap<String, (DiffResult, u64)>> = Mutex::new(HashMap::new());
    static ref SEARCH_CACHE: Mutex<HashMap<String, (Vec<GitVersionEntry>, u64)>> = Mutex::new(HashMap::new());
}

const CACHE_TTL_SECONDS: u64 = 300;  // 5分钟缓存
const CACHE_MAX_ENTRIES: usize = 200;  // 最大缓存条数

fn evict_cache<K: Clone + std::hash::Hash + Eq, V>(cache: &mut HashMap<K, (V, u64)>) {
    while cache.len() > CACHE_MAX_ENTRIES {
        let oldest_key = cache.iter().min_by_key(|(_, &(_, ts))| ts).map(|(k, _)| k.clone());
        if let Some(k) = oldest_key { cache.remove(&k); } else { break; }
    }
}

fn get_current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn is_cache_valid(timestamp: u64) -> bool {
    get_current_timestamp().saturating_sub(timestamp) < CACHE_TTL_SECONDS
}

fn cache_key_for_versions(note_id: &str) -> String {
    format!("versions:{}", note_id)
}

fn cache_key_for_diff(note_id: &str, from: &str, to: &str) -> String {
    format!("diff:{}:{}:{}", note_id, from, to)
}

fn cache_key_for_search(note_id: &str, query: &str) -> String {
    format!("search:{}:{}", note_id, query)
}

// ============================================================
// 新增类型定义
// ============================================================

/// 版本Diff结果
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub from_version: String,
    pub to_version: String,
    pub operations: Vec<DiffOperation>,
    pub similarity: f32,
    pub change_summary: ChangeSummary,
}

/// 单个Diff操作
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffOperation {
    pub op_type: String,  // "add", "remove", "modify"
    pub line_num: u32,
    pub old_text: Option<String>,
    pub new_text: Option<String>,
    pub context: String,
}

/// 变更摘要
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSummary {
    pub lines_added: u32,
    pub lines_removed: u32,
    pub lines_modified: u32,
    pub word_count_delta: i32,
}

/// 里程碑信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Milestone {
    pub id: String,
    pub note_id: String,
    pub name: String,
    pub description: Option<String>,
    pub commit_id: String,
    pub version_number: u32,
    pub created_at: u64,
    pub tags: Vec<String>,
}

/// 导出格式
#[derive(Debug, Clone, serde::Deserialize)]
pub enum ExportFormat {
    #[serde(rename = "markdown")]
    Markdown,
    #[serde(rename = "html")]
    Html,
    #[serde(rename = "pdf")]
    Pdf,
    #[serde(rename = "json")]
    Json,
}

/// 备份配置
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupConfig {
    pub auto_backup: bool,
    pub backup_interval_hours: u32,
    pub max_backups: u32,
    pub last_backup_at: Option<u64>,
}

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("核心初始化失败: {0}")]
    Init(String),
    #[error("路径错误")]
    Path,
}

pub struct AppState {
    pub core: Mutex<NoteForgeDesktopCore>,
    pub git: Mutex<Option<GitHistory>>,
}

pub struct NoteForgeDesktopCore {
    pub storage: LocalStorage,
    pub search: SearchEngine,
    pub encryption: Option<noteforge_core::encryption::EncryptionManager>,
}

impl NoteForgeDesktopCore {
    pub fn open(data_dir: PathBuf) -> Result<Self, noteforge_core::error::CoreError> {
        std::fs::create_dir_all(&data_dir)?;
        Ok(Self { 
            storage: LocalStorage::open(data_dir.join("noteforge.db"))?, 
            search: SearchEngine::open(data_dir.join("index"))?,
            encryption: None,
        })
    }
}

pub fn init_core(app: &AppHandle) -> Result<NoteForgeDesktopCore, CoreError> {
    let path = app.path().app_data_dir().map_err(|_| CoreError::Path)?;
    NoteForgeDesktopCore::open(path).map_err(|e| CoreError::Init(e.to_string()))
}

fn with_git<T>(state: State<'_, AppState>, f: impl FnOnce(&GitHistory) -> Result<T, String>) -> Result<T, String> {
    let git = state.git.lock().map_err(|e| e.to_string())?;
    let history = git.as_ref().ok_or_else(|| "git history unavailable".to_string())?;
    f(history)
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
    if core.storage.get_note(&id).is_err() { return Ok(None); }
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

#[tauri::command] pub fn list_note_versions(state: State<'_, AppState>, note_id: String) -> Result<Vec<GitVersionEntry>, String> {
    with_git(state, |git| {
        let mut versions = git.list_versions(&note_id).map_err(|e| e.to_string())?;
        let deleted = git.list_deleted_versions(&note_id).map_err(|e| e.to_string())?;
        versions.retain(|v| !deleted.contains(&v.id));
        Ok(versions)
    })
}
#[tauri::command] pub fn list_note_branches(state: State<'_, AppState>, note_id: String) -> Result<Vec<GitBranchEntry>, String> { with_git(state, |git| git.list_branches(&note_id).map_err(|e| e.to_string())) }
#[tauri::command] pub fn create_note_version(state: State<'_, AppState>, note_id: String, title: String, description: Option<String>) -> Result<String, String> {
    let core_state = state.core.lock().map_err(|e| e.to_string())?;
    let note = match core_state.storage.get_note(&note_id) { Ok(n) => n, Err(_) => return Err("note not found".to_string()) };
    drop(core_state);
    let msg = match description { Some(d) => format!("{}\n\n{}", title, d), None => title };
    with_git(state, |git| git.commit_note(&note_id, &msg, &note.content).map_err(|e| e.to_string()))
}
#[tauri::command] pub fn checkout_note_version(state: State<'_, AppState>, note_id: String, commit_id: String) -> Result<String, String> { with_git(state, |git| git.checkout_version(&commit_id, &note_id).map_err(|e| e.to_string())) }
#[tauri::command] pub fn checkout_note_branch(state: State<'_, AppState>, note_id: String, branch: String) -> Result<String, String> { with_git(state, |git| git.checkout_branch(&note_id, &branch).map_err(|e| e.to_string())) }
#[tauri::command] pub fn create_note_branch(state: State<'_, AppState>, note_id: String, branch: String, from_commit: Option<String>) -> Result<(), String> { with_git(state, |git| git.create_branch(&note_id, &branch, from_commit.as_deref()).map_err(|e| e.to_string())) }
#[tauri::command] pub fn delete_note_branch(state: State<'_, AppState>, note_id: String, branch: String) -> Result<bool, String> { with_git(state, |git| git.delete_branch(&note_id, &branch).map_err(|e| e.to_string()).map(|_| true)) }
#[tauri::command] pub fn get_note_version_content(state: State<'_, AppState>, note_id: String, commit_id: String) -> Result<String, String> { with_git(state, |git| git.checkout_version(&commit_id, &note_id).map_err(|e| e.to_string())) }
#[tauri::command] pub fn compare_note_versions(state: State<'_, AppState>, note_id: String, from_commit: String, to_commit: String) -> Result<serde_json::Value, String> {
    with_git(state, |git| {
        let from = git.checkout_version(&from_commit, &note_id).map_err(|e| e.to_string())?;
        let to = git.checkout_version(&to_commit, &note_id).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({
            "from": from,
            "to": to,
            "changed": from != to
        }))
    })
}
#[tauri::command] pub fn delete_note_version(state: State<'_, AppState>, note_id: String, commit_id: String) -> Result<bool, String> {
    with_git(state, |git| {
        git.delete_version(&note_id, &commit_id).map_err(|e| e.to_string())
    })
}

// ============================================================
// 功能1: 版本对比与Diff功能 (Feature 1)
// ============================================================

#[tauri::command]
pub fn get_version_diff(state: State<'_, AppState>, note_id: String, from_commit: String, to_commit: String) -> Result<DiffResult, String> {
    with_git(state, |git| {
        let from_content = git.checkout_version(&from_commit, &note_id).map_err(|e| e.to_string())?;
        let to_content = git.checkout_version(&to_commit, &note_id).map_err(|e| e.to_string())?;
        
        compute_diff(&from_content, &to_content, &from_commit, &to_commit)
    })
}

#[tauri::command]
pub fn compare_versions_with_context(state: State<'_, AppState>, note_id: String, from_commit: String, to_commit: String, context_lines: u32) -> Result<DiffResult, String> {
    with_git(state, |git| {
        let from_content = git.checkout_version(&from_commit, &note_id).map_err(|e| e.to_string())?;
        let to_content = git.checkout_version(&to_commit, &note_id).map_err(|e| e.to_string())?;
        
        compute_diff_with_context(&from_content, &to_content, &from_commit, &to_commit, context_lines as usize)
    })
}

#[tauri::command]
pub fn get_version_diff_stat(state: State<'_, AppState>, note_id: String, from_commit: String, to_commit: String) -> Result<ChangeSummary, String> {
    with_git(state, |git| {
        let from_content = git.checkout_version(&from_commit, &note_id).map_err(|e| e.to_string())?;
        let to_content = git.checkout_version(&to_commit, &note_id).map_err(|e| e.to_string())?;
        
        Ok(compute_change_summary(&from_content, &to_content))
    })
}

fn lcs_table(a: &[&str], b: &[&str]) -> Vec<Vec<usize>> {
    let m = a.len();
    let n = b.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 1..=m {
        for j in 1..=n {
            if a[i - 1] == b[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }
    dp
}

fn lcs_diff(from: &[&str], to: &[&str]) -> Vec<DiffOperation> {
    let dp = lcs_table(from, to);
    let mut i = from.len();
    let mut j = to.len();
    let mut rev_ops = Vec::new();
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && from[i - 1] == to[j - 1] {
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            rev_ops.push(DiffOperation {
                op_type: "add".to_string(),
                line_num: j as u32,
                old_text: None,
                new_text: Some(to[j - 1].to_string()),
                context: format!("Added at line {}", j),
            });
            j -= 1;
        } else if i > 0 {
            rev_ops.push(DiffOperation {
                op_type: "remove".to_string(),
                line_num: i as u32,
                old_text: Some(from[i - 1].to_string()),
                new_text: None,
                context: format!("Removed at line {}", i),
            });
            i -= 1;
        }
    }
    rev_ops.reverse();
    rev_ops
}

fn compute_diff(from: &str, to: &str, from_id: &str, to_id: &str) -> Result<DiffResult, String> {
    let from_lines: Vec<&str> = from.lines().collect();
    let to_lines: Vec<&str> = to.lines().collect();
    
    let operations = lcs_diff(&from_lines, &to_lines);
    
    let total = from_lines.len().max(to_lines.len());
    let similarity = if total > 0 {
        let lcs_len = lcs_table(&from_lines, &to_lines)[from_lines.len()][to_lines.len()];
        lcs_len as f32 / total as f32
    } else {
        1.0
    };
    
    let change_summary = compute_change_summary(from, to);
    
    Ok(DiffResult {
        from_version: from_id.to_string(),
        to_version: to_id.to_string(),
        operations,
        similarity,
        change_summary,
    })
}

fn compute_diff_with_context(from: &str, to: &str, from_id: &str, to_id: &str, context: usize) -> Result<DiffResult, String> {
    let result = compute_diff(from, to, from_id, to_id)?;
    
    let from_lines: Vec<&str> = from.lines().collect();
    let _to_lines: Vec<&str> = to.lines().collect();
    
    let mut operations_with_context = Vec::new();
    for op in result.operations {
        let mut context_lines = vec![op.context.clone()];
        
        let line_num = op.line_num as usize;
        let start = line_num.saturating_sub(context + 1);
        let end = (line_num + context).min(from_lines.len());
        
        for i in start..end {
            if i < from_lines.len() && i != line_num - 1 {
                context_lines.push(format!("  {}", from_lines[i]));
            }
        }
        
        operations_with_context.push(DiffOperation {
            context: context_lines.join("\n"),
            ..op
        });
    }
    
    Ok(DiffResult {
        operations: operations_with_context,
        ..result
    })
}

fn compute_change_summary(from: &str, to: &str) -> ChangeSummary {
    let from_lines: Vec<&str> = from.lines().collect();
    let to_lines: Vec<&str> = to.lines().collect();
    
    let mut lines_added = 0u32;
    let mut lines_removed = 0u32;
    let mut lines_modified = 0u32;
    
    for (i, from_line) in from_lines.iter().enumerate() {
        if i >= to_lines.len() {
            lines_removed += 1;
        } else if from_line != &to_lines[i] {
            lines_modified += 1;
        }
    }
    
    for _i in from_lines.len()..to_lines.len() {
        lines_added += 1;
    }
    
    let from_word_count = from.split_whitespace().count() as i32;
    let to_word_count = to.split_whitespace().count() as i32;
    let word_count_delta = to_word_count - from_word_count;
    
    ChangeSummary {
        lines_added,
        lines_removed,
        lines_modified,
        word_count_delta,
    }
}

// ============================================================
// 功能2: 离线搜索与版本信息检索 (Feature 2)
// ============================================================

#[tauri::command]
pub fn search_versions(state: State<'_, AppState>, note_id: String, query: String) -> Result<Vec<GitVersionEntry>, String> {
    with_git(state, |git| {
        let versions = git.list_versions(&note_id).map_err(|e| e.to_string())?;
        
        let query_lower = query.to_lowercase();
        let filtered: Vec<GitVersionEntry> = versions
            .into_iter()
            .filter(|v| {
                v.title.to_lowercase().contains(&query_lower) ||
                v.summary.to_lowercase().contains(&query_lower)
            })
            .collect();
        
        Ok(filtered)
    })
}

#[tauri::command]
pub fn search_notes_with_versions(state: State<'_, AppState>, query: String) -> Result<serde_json::Value, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    
    let search_results = core.search.search(&query, 100).map_err(|e| e.to_string())?;
    
    drop(core);
    
    with_git(state, |git| {
        use std::collections::HashMap;
        let mut version_cache: HashMap<String, Vec<GitVersionEntry>> = HashMap::new();
        
        let result_with_versions: serde_json::Value = search_results.into_iter().map(|search_result| {
            let versions = version_cache.entry(search_result.note_id.clone())
                .or_insert_with(|| git.list_versions(&search_result.note_id).unwrap_or_default());
            
            serde_json::json!({
                "note_id": search_result.note_id,
                "title": search_result.title,
                "snippet": search_result.snippet,
                "score": search_result.score,
                "updated_at": search_result.updated_at,
                "version_count": versions.len(),
                "latest_version": versions.first().map(|v| {
                    serde_json::json!({
                        "id": v.id,
                        "title": v.title,
                        "updated_at": v.updated_at,
                    })
                })
            })
        }).collect::<Vec<_>>().into();
        
        Ok(result_with_versions)
    })
}

#[tauri::command]
pub fn get_version_metadata(state: State<'_, AppState>, note_id: String, commit_id: String) -> Result<serde_json::Value, String> {
    with_git(state, |git| {
        let versions = git.list_versions(&note_id).map_err(|e| e.to_string())?;
        
        for version in versions {
            if version.id == commit_id {
                return Ok(serde_json::json!({
                    "id": version.id,
                    "title": version.title,
                    "summary": version.summary,
                    "updated_at": version.updated_at,
                    "branch": version.branch,
                    "parent_count": version.parent_count,
                }));
            }
        }
        
        Err("Version not found".to_string())
    })
}

// ============================================================
// 功能3: 里程碑管理 (Feature 3) - 替代时间线版本管理
// ============================================================

#[tauri::command]
pub fn create_milestone(state: State<'_, AppState>, note_id: String, name: String, description: Option<String>, version_number: u32) -> Result<Milestone, String> {
    with_git(state, |git| {
        let current_branch = git.get_current_branch(&note_id).map_err(|e| e.to_string())?;
        let head_commit = git.get_branch_head(&note_id, &current_branch).map_err(|e| e.to_string())?;
        
        let milestone = Milestone {
            id: generate_id(),
            note_id: note_id.clone(),
            name,
            description,
            commit_id: head_commit,
            version_number,
            created_at: now_ms(),
            tags: vec![],
        };
        
        git.create_milestone(&note_id, &milestone).map_err(|e| e.to_string())?;
        
        Ok(milestone)
    })
}

#[tauri::command]
pub fn list_milestones(state: State<'_, AppState>, note_id: String) -> Result<Vec<Milestone>, String> {
    with_git(state, |git| {
        git.list_milestones(&note_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn get_milestone(state: State<'_, AppState>, note_id: String, milestone_id: String) -> Result<Option<Milestone>, String> {
    with_git(state, |git| {
        git.get_milestone(&note_id, &milestone_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn update_milestone(state: State<'_, AppState>, note_id: String, milestone_id: String, name: Option<String>, description: Option<String>, tags: Option<Vec<String>>) -> Result<Option<Milestone>, String> {
    with_git(state, |git| {
        git.update_milestone(&note_id, &milestone_id, name, description, tags).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn delete_milestone(state: State<'_, AppState>, note_id: String, milestone_id: String) -> Result<bool, String> {
    with_git(state, |git| {
        git.delete_milestone(&note_id, &milestone_id).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn checkout_milestone(state: State<'_, AppState>, note_id: String, milestone_id: String) -> Result<String, String> {
    with_git(state, |git| {
        let milestone = git.get_milestone(&note_id, &milestone_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Milestone not found".to_string())?;
        
        git.checkout_version(&milestone.commit_id, &note_id).map_err(|e| e.to_string())
    })
}

// ============================================================
// 功能4: 导出与备份功能 (Feature 4)
// ============================================================

#[tauri::command]
pub fn export_note(state: State<'_, AppState>, note_id: String, format: String) -> Result<Vec<u8>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let note = match core.storage.get_note(&note_id) {
        Ok(note) => note,
        Err(_) => return Err("Note not found".to_string()),
    };
    
    drop(core);
    
    match format.as_str() {
        "markdown" => Ok(note.content.into_bytes()),
        "html" => {
            let html = MarkdownEngine::render_html(&note.content);
            Ok(html.into_bytes())
        },
        "json" => {
            let json = serde_json::to_string_pretty(&note)
                .map_err(|e| e.to_string())?;
            Ok(json.into_bytes())
        },
        _ => Err("Unsupported export format".to_string()),
    }
}

#[tauri::command]
pub fn export_notebook(state: State<'_, AppState>, notebook_id: String, format: String) -> Result<Vec<u8>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let notes = core.storage.list_notes(Some(&notebook_id), 1000, 0)
        .map_err(|e| e.to_string())?;
    
    drop(core);
    
    match format.as_str() {
        "json" => {
            let json = serde_json::to_string_pretty(&notes)
                .map_err(|e| e.to_string())?;
            Ok(json.into_bytes())
        },
        "markdown" => {
            let mut md = String::new();
            for note_meta in notes {
                md.push_str(&format!("# {}\n\n", note_meta.title));
                md.push_str(&format!("Tags: {}\n\n", note_meta.tags.join(", ")));
                md.push_str(&format!("Created: {}\n\n", note_meta.created_at));
                md.push_str("---\n\n");
            }
            Ok(md.into_bytes())
        },
        _ => Err("Unsupported export format".to_string()),
    }
}

#[tauri::command]
pub fn backup_note(state: State<'_, AppState>, note_id: String, backup_path: String) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let note = match core.storage.get_note(&note_id) {
        Ok(note) => note,
        Err(_) => return Err("Note not found".to_string()),
    };
    
    drop(core);
    
    let backup_data = serde_json::to_string_pretty(&note)
        .map_err(|e| e.to_string())?;
    
    std::fs::write(&backup_path, backup_data)
        .map_err(|e| format!("Backup failed: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
pub fn restore_note(state: State<'_, AppState>, backup_path: String) -> Result<Note, String> {
    let backup_data = std::fs::read_to_string(&backup_path)
        .map_err(|e| format!("Failed to read backup: {}", e))?;
    
    let note: Note = serde_json::from_str(&backup_data)
        .map_err(|e| format!("Failed to parse backup: {}", e))?;
    
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let existing_result = core.storage.get_note(&note.meta.id);
    
    if existing_result.is_ok() {
        let request = UpdateNoteRequest {
            title: Some(note.meta.title),
            content: Some(note.content),
            notebook_id: note.meta.notebook_id,
            tags: Some(note.meta.tags),
            is_pinned: Some(note.meta.is_pinned),
            is_favorite: Some(note.meta.is_favorite),
        };
        core.storage.update_note(&note.meta.id, &request).map_err(|e| e.to_string())
    } else {
        let request = CreateNoteRequest {
            title: note.meta.title,
            content: note.content,
            notebook_id: note.meta.notebook_id,
            tags: note.meta.tags,
        };
        core.storage.create_note(&request).map_err(|e| e.to_string())
    }
}

// ============================================================
// 功能5: 性能优化 (Feature 5 - Performance Optimization)
// ============================================================

#[tauri::command]
pub fn list_note_versions_cached(state: State<'_, AppState>, note_id: String) -> Result<Vec<GitVersionEntry>, String> {
    let cache_key = cache_key_for_versions(&note_id);
    
    {
        if let Ok(cache) = VERSION_CACHE.lock() {
            if let Some((cached_versions, timestamp)) = cache.get(&cache_key) {
                if is_cache_valid(*timestamp) {
                    return Ok(cached_versions.clone());
                }
            }
        }
    }
    
    with_git(state, |git| {
        let mut versions = git.list_versions(&note_id).map_err(|e| e.to_string())?;
        let deleted = git.list_deleted_versions(&note_id).map_err(|e| e.to_string())?;
        versions.retain(|v| !deleted.contains(&v.id));
        
        if let Ok(mut cache) = VERSION_CACHE.lock() {
            evict_cache(&mut cache);
            cache.insert(cache_key, (versions.clone(), get_current_timestamp()));
        }
        
        Ok(versions)
    })
}

#[tauri::command]
pub fn get_version_diff_cached(state: State<'_, AppState>, note_id: String, from_commit: String, to_commit: String) -> Result<DiffResult, String> {
    let cache_key = cache_key_for_diff(&note_id, &from_commit, &to_commit);
    
    {
        if let Ok(cache) = DIFF_CACHE.lock() {
            if let Some((cached_diff, timestamp)) = cache.get(&cache_key) {
                if is_cache_valid(*timestamp) {
                    return Ok(cached_diff.clone());
                }
            }
        }
    }
    
    let result = get_version_diff(state, note_id, from_commit, to_commit)?;
    
    if let Ok(mut cache) = DIFF_CACHE.lock() {
        evict_cache(&mut cache);
        cache.insert(cache_key, (result.clone(), get_current_timestamp()));
    }
    
    Ok(result)
}

#[tauri::command]
pub fn search_versions_cached(state: State<'_, AppState>, note_id: String, query: String) -> Result<Vec<GitVersionEntry>, String> {
    let cache_key = cache_key_for_search(&note_id, &query);
    
    {
        if let Ok(cache) = SEARCH_CACHE.lock() {
            if let Some((cached_results, timestamp)) = cache.get(&cache_key) {
                if is_cache_valid(*timestamp) {
                    return Ok(cached_results.clone());
                }
            }
        }
    }
    
    let results = search_versions(state, note_id.clone(), query.clone())?;
    
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        evict_cache(&mut cache);
        cache.insert(cache_key, (results.clone(), get_current_timestamp()));
    }
    
    Ok(results)
}

#[tauri::command]
pub fn clear_cache() -> Result<bool, String> {
    if let Ok(mut cache) = VERSION_CACHE.lock() {
        cache.clear();
    }
    if let Ok(mut cache) = DIFF_CACHE.lock() {
        cache.clear();
    }
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        cache.clear();
    }
    Ok(true)
}

// ============================================================
// 崩溃日志持久化
// ============================================================

#[tauri::command]
pub fn write_crash_log(app: tauri::AppHandle, crash_data: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let log_path = data_dir.join("crash");
    std::fs::create_dir_all(&log_path).map_err(|e| e.to_string())?;
    let ts = get_current_timestamp();
    let file_path = log_path.join(format!("crash-{}.json", ts));
    std::fs::write(&file_path, &crash_data).map_err(|e| e.to_string())?;
    // Keep only last 10 crash logs
    let mut entries: Vec<_> = std::fs::read_dir(&log_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.path());
    while entries.len() > 10 {
        if let Some(oldest) = entries.first() {
            let _ = std::fs::remove_file(oldest.path());
            entries.remove(0);
        }
    }
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_cache_stats() -> Result<serde_json::Value, String> {
    let version_count = VERSION_CACHE.lock().map(|c| c.len()).unwrap_or(0);
    let diff_count = DIFF_CACHE.lock().map(|c| c.len()).unwrap_or(0);
    let search_count = SEARCH_CACHE.lock().map(|c| c.len()).unwrap_or(0);
    
    Ok(serde_json::json!({
        "version_cache_entries": version_count,
        "diff_cache_entries": diff_count,
        "search_cache_entries": search_count,
        "total_entries": version_count + diff_count + search_count,
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
    }))
}