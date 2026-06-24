use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

use noteforge_core::{md_engine::MarkdownEngine, search::SearchEngine, storage::LocalStorage, types};

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
}

impl NoteForgeDesktopCore {
    pub fn open(data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(&data_dir)?;
        Ok(Self {
            storage: LocalStorage::open(data_dir.join("noteforge.db"))?,
            search: SearchEngine::open(data_dir.join("index"))?,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub word_count: u32,
    pub version: u32,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note { pub meta: NoteMeta, pub content: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook { pub id: String, pub name: String, pub icon: String, pub note_count: u32 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo { pub name: String, pub count: u32 }
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteRequest { pub title: String, pub content: String, pub notebook_id: Option<String>, pub tags: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult { pub id: String, pub title: String, pub snippet: String, pub updated_at: u64 }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit { pub id: String, pub title: String, pub snippet: String, pub updated_at: u64, pub line: u32, pub column: u32 }

pub fn init_core(app: &AppHandle) -> Result<NoteForgeDesktopCore, CoreError> {
    let path = app.path().app_data_dir().map_err(|_| CoreError::Path)?;
    NoteForgeDesktopCore::open(path).map_err(|e| CoreError::Init(e.to_string()))
}

fn to_meta(meta: types::NoteMeta) -> NoteMeta {
    NoteMeta { id: meta.id, title: meta.title, notebook_id: meta.notebook_id, tags: meta.tags, is_pinned: meta.is_pinned, is_favorite: meta.is_favorite, word_count: meta.word_count, version: meta.version, created_at: meta.created_at, updated_at: meta.updated_at }
}

#[tauri::command]
pub fn get_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

#[tauri::command]
pub fn get_app_info() -> serde_json::Value {
    serde_json::json!({"name":"NoteForge","version":env!("CARGO_PKG_VERSION"),"description":"全平台智能笔记系统","offline":true})
}

#[tauri::command]
pub fn render_markdown(markdown: String) -> String { MarkdownEngine::render_html(&markdown) }

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, request: CreateNoteRequest) -> Result<Note, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    let req = types::CreateNoteRequest { title: request.title, content: request.content, notebook_id: request.notebook_id, tags: request.tags };
    let note = core.storage.create_note(&req).map_err(|e| e.to_string())?;
    let _ = core.search.add_note(&note.meta.id, &note.meta.title, &note.content, &note.meta.tags, note.meta.updated_at);
    Ok(Note { meta: to_meta(note.meta), content: note.content })
}

#[tauri::command]
pub fn update_note(state: State<'_, AppState>, id: String, title: Option<String>, content: Option<String>, tags: Option<Vec<String>>, is_pinned: Option<bool>, is_favorite: Option<bool>) -> Result<Note, String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    let req = types::UpdateNoteRequest { title, content, notebook_id: None, tags, is_pinned, is_favorite };
    let note = core.storage.update_note(&id, &req).map_err(|e| e.to_string())?;
    let _ = core.search.add_note(&id, &note.meta.title, &note.content, &note.meta.tags, note.meta.updated_at);
    Ok(Note { meta: to_meta(note.meta), content: note.content })
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Note, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let note = core.storage.get_note(&id).map_err(|_| "笔记未找到".to_string())?;
    Ok(Note { meta: to_meta(note.meta), content: note.content })
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.delete_note(&id).map_err(|e| e.to_string())?;
    let _ = core.search.remove_note(&id);
    Ok(())
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let notes = core.storage.list_notes(None, 500, 0).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for meta in notes {
        if let Ok(note) = core.storage.get_note(&meta.id) {
            result.push(Note { meta: to_meta(note.meta), content: note.content });
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let results = core.search.search(&query, 20).map_err(|e| e.to_string())?;
    Ok(results.into_iter().map(|r| SearchResult { id: r.note_id, title: r.title, snippet: r.snippet, updated_at: r.updated_at }).collect())
}

#[tauri::command]
pub fn search_note_hits(state: State<'_, AppState>, query: String) -> Result<Vec<SearchHit>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let results = core.search.search(&query, 20).map_err(|e| e.to_string())?;
    let mut hits = Vec::new();
    for r in results {
        let note = core.storage.get_note(&r.note_id).map_err(|e| e.to_string())?;
        let line = note.content.lines().position(|line| line.contains(&query)).unwrap_or(0) as u32 + 1;
        hits.push(SearchHit { id: r.note_id, title: r.title, snippet: r.snippet, updated_at: r.updated_at, line, column: 1 });
    }
    Ok(hits)
}

#[tauri::command]
pub fn list_notebooks(state: State<'_, AppState>) -> Result<Vec<Notebook>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let notebooks = core.storage.list_notebooks().map_err(|e| e.to_string())?;
    Ok(notebooks.into_iter().map(|n| Notebook { id: n.id, name: n.name, icon: n.icon, note_count: n.note_count }).collect())
}

#[tauri::command]
pub fn create_notebook(state: State<'_, AppState>, name: String) -> Result<Notebook, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let notebook = core.storage.create_notebook(&name).map_err(|e| e.to_string())?;
    Ok(Notebook { id: notebook.id, name: notebook.name, icon: notebook.icon, note_count: notebook.note_count })
}

#[tauri::command]
pub fn rename_notebook(state: State<'_, AppState>, id: String, name: String) -> Result<Notebook, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let mut notebook = core.storage.get_notebook(&id).map_err(|e| e.to_string())?;
    notebook.name = name;
    Ok(Notebook { id: notebook.id, name: notebook.name, icon: notebook.icon, note_count: notebook.note_count })
}

#[tauri::command]
pub fn delete_notebook(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let notes = core.storage.list_notes(Some(&id), 10_000, 0).map_err(|e| e.to_string())?;
    for meta in notes {
        let _ = core.storage.update_note(&meta.id, &types::UpdateNoteRequest { title: None, content: None, notebook_id: Some("default".to_string()), tags: None, is_pinned: None, is_favorite: None });
    }
    Ok(true)
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    let tags = core.storage.list_tags().map_err(|e| e.to_string())?;
    Ok(tags.into_iter().map(|t| TagInfo { name: t.name, count: t.note_count }).collect())
}
