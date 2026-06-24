use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("数据库初始化失败: {0}")]
    Init(String),
    #[error("数据库访问失败: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("应用路径错误")]
    Path,
}

pub struct AppState {
    pub db: Mutex<Connection>,
}

static DB_PATH: OnceCell<PathBuf> = OnceCell::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub notebook_id: String,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub word_count: u32,
    pub version: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub backlinks: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub meta: NoteMeta,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub note_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub name: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    pub notebook_id: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub snippet: String,
}

pub fn init_db(app: &AppHandle) -> Result<Connection, DbError> {
    let path = app.path().app_data_dir().map_err(|_| DbError::Path)?;
    std::fs::create_dir_all(&path).map_err(|e| DbError::Init(e.to_string()))?;
    let db_path = path.join("noteforge.db");
    let _ = DB_PATH.set(db_path.clone());

    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            notebook_id TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            is_pinned INTEGER NOT NULL DEFAULT 0,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            backlinks INTEGER NOT NULL DEFAULT 0,
            content TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS notebooks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL
        );
        INSERT OR IGNORE INTO notebooks (id, name, icon) VALUES
            ('default', '默认笔记本', '📓'),
            ('tech', '技术笔记', '💻'),
            ('project', '项目文档', '🗂️');
        "#,
    )?;
    Ok(conn)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64
}

fn row_to_note(row: &rusqlite::Row<'_>) -> Result<Note, rusqlite::Error> {
    let tags_json: String = row.get("tags")?;
    Ok(Note {
        meta: NoteMeta {
            id: row.get("id")?,
            title: row.get("title")?,
            notebook_id: row.get("notebook_id")?,
            tags: serde_json::from_str(&tags_json).unwrap_or_default(),
            is_pinned: row.get::<_, i64>("is_pinned")? != 0,
            is_favorite: row.get::<_, i64>("is_favorite")? != 0,
            word_count: row.get::<_, i64>("word_count")? as u32,
            version: row.get::<_, i64>("version")? as u32,
            created_at: row.get::<_, i64>("created_at")? as u64,
            updated_at: row.get::<_, i64>("updated_at")? as u64,
            backlinks: row.get::<_, i64>("backlinks")? as u32,
        },
        content: row.get("content")?,
    })
}

#[tauri::command]
pub fn get_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

#[tauri::command]
pub fn get_app_info() -> serde_json::Value {
    serde_json::json!({"name":"NoteForge","version":env!("CARGO_PKG_VERSION"),"description":"全平台智能笔记系统","offline":true})
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM notes ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map([], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<Note, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT * FROM notes WHERE id = ?1", [id], row_to_note).map_err(|_| "笔记未找到".into())
}

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, request: CreateNoteRequest) -> Result<Note, String> {
    let now = now_ms();
    let id = format!("{}-{:06x}", now, now & 0xFFFFFF);
    let note = Note {
        meta: NoteMeta {
            id: id.clone(),
            title: request.title,
            notebook_id: request.notebook_id,
            tags: request.tags,
            is_pinned: false,
            is_favorite: false,
            word_count: request.content.chars().count() as u32,
            version: 1,
            created_at: now,
            updated_at: now,
            backlinks: 0,
        },
        content: request.content,
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO notes (id, title, notebook_id, tags, is_pinned, is_favorite, word_count, version, created_at, updated_at, backlinks, content) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![note.meta.id, note.meta.title, note.meta.notebook_id, serde_json::to_string(&note.meta.tags).unwrap_or("[]".into()), 0, 0, note.meta.word_count, 1, now, now, 0, note.content],
    ).map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command]
pub fn update_note(state: State<'_, AppState>, id: String, title: Option<String>, content: Option<String>, tags: Option<Vec<String>>, is_pinned: Option<bool>, is_favorite: Option<bool>) -> Result<Note, String> {
    let current = get_note(state.clone(), id.clone())?;
    let now = now_ms();
    let note = Note {
        meta: NoteMeta {
            id: id.clone(),
            title: title.clone().unwrap_or(current.meta.title),
            notebook_id: current.meta.notebook_id,
            tags: tags.clone().unwrap_or(current.meta.tags),
            is_pinned: is_pinned.unwrap_or(current.meta.is_pinned),
            is_favorite: is_favorite.unwrap_or(current.meta.is_favorite),
            word_count: content.as_ref().map(|c| c.chars().count() as u32).unwrap_or(current.meta.word_count),
            version: current.meta.version + 1,
            created_at: current.meta.created_at,
            updated_at: now,
            backlinks: current.meta.backlinks,
        },
        content: content.clone().unwrap_or(current.content),
    };
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET title=?2, content=?3, tags=?4, is_pinned=?5, is_favorite=?6, word_count=?7, version=?8, updated_at=?9 WHERE id=?1",
        params![note.meta.id, note.meta.title, note.content, serde_json::to_string(&note.meta.tags).unwrap_or("[]".into()), note.meta.is_pinned as i64, note.meta.is_favorite as i64, note.meta.word_count, note.meta.version, now],
    ).map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT id, title, content FROM notes WHERE title LIKE ?1 OR content LIKE ?1 OR tags LIKE ?1 ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let results = stmt
        .query_map([pattern], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get::<_, String>(2)?.chars().take(80).collect(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(results)
}

#[tauri::command]
pub fn list_notebooks(state: State<'_, AppState>) -> Result<Vec<Notebook>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, icon FROM notebooks ORDER BY id").map_err(|e| e.to_string())?;
    let mut notebooks = stmt
        .query_map([], |row| Ok(Notebook { id: row.get(0)?, name: row.get(1)?, icon: row.get(2)?, note_count: 0 }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let mut note_stmt = conn.prepare("SELECT notebook_id, COUNT(*) FROM notes GROUP BY notebook_id").map_err(|e| e.to_string())?;
    let counts = note_stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u32)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    for nb in &mut notebooks {
        if let Some((_, count)) = counts.iter().find(|(id, _)| id == &nb.id) {
            nb.note_count = *count;
        }
    }
    Ok(notebooks)
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let notes = list_notes(state)?;
    let mut map = std::collections::HashMap::<String, u32>::new();
    for note in notes { for tag in note.meta.tags { *map.entry(tag).or_default() += 1; } }
    Ok(map.into_iter().map(|(name, count)| TagInfo { name, count }).collect())
}

#[tauri::command]
pub fn create_notebook(state: State<'_, AppState>, name: String) -> Result<Notebook, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let id = name.to_lowercase().replace(' ', "-");
    conn.execute("INSERT OR IGNORE INTO notebooks (id, name, icon) VALUES (?1, ?2, '📓')", params![id, name]).map_err(|e| e.to_string())?;
    Ok(Notebook { id, name, icon: "📓".into(), note_count: 0 })
}
