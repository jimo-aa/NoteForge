use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

use noteforge_core::{md_engine::MarkdownEngine, search::SearchEngine, storage::LocalStorage, types::*};

use crate::git_history::{GitBranchEntry, GitHistory, GitVersionEntry};

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
}

impl NoteForgeDesktopCore {
    pub fn open(data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(&data_dir)?;
        Ok(Self { storage: LocalStorage::open(data_dir.join("noteforge.db"))?, search: SearchEngine::open(data_dir.join("index"))? })
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
    let _ = core.search.add_note(&note.meta.id, &note.meta.title, &note.content, &note.meta.tags, note.meta.updated_at);
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
    let current = match core.storage.get_note(&id) { Ok(note) => note, Err(_) => return Ok(None) };
    let next = UpdateNoteRequest { title, content, notebook_id: None, tags, is_pinned, is_favorite };
    let note = core.storage.update_note(&id, &next).map_err(|e| e.to_string())?;
    if note.content != current.content || note.meta.title != current.meta.title { let _ = core.search.add_note(&note.meta.id, &note.meta.title, &note.content, &note.meta.tags, note.meta.updated_at); }
    drop(core);
    Ok(Some(note))
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.delete_note(&id).map_err(|e| e.to_string())?;
    let _ = core.search.remove_note(&id);
    Ok(true)
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let metas = core.storage.list_notes(None, 500, 0).map_err(|e| e.to_string())?;
    let mut notes = Vec::new();
    for meta in metas { if let Ok(note) = core.storage.get_note(&meta.id) { notes.push(note); } }
    Ok(notes)
}

#[tauri::command] pub fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> { state.core.lock().map_err(|e| e.to_string())?.search.search(&query, 50).map_err(|e| e.to_string()) }
#[tauri::command] pub fn list_notebooks(state: State<'_, AppState>) -> Result<Vec<Notebook>, String> { state.core.lock().map_err(|e| e.to_string())?.storage.list_notebooks().map_err(|e| e.to_string()) }
#[tauri::command] pub fn create_notebook(state: State<'_, AppState>, name: String) -> Result<Notebook, String> { state.core.lock().map_err(|e| e.to_string())?.storage.create_notebook(&name).map_err(|e| e.to_string()) }
#[tauri::command] pub fn rename_notebook(_state: State<'_, AppState>, _id: String, _name: String) -> Result<Notebook, String> { Err("storage missing rename_notebook".to_string()) }
#[tauri::command] pub fn delete_notebook(_state: State<'_, AppState>, _id: String) -> Result<bool, String> { Err("storage missing delete_notebook".to_string()) }
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