//! NoteForge Desktop — Tauri 命令
//!
//! 所有笔记操作使用本地内存数据。
//! 未来可切换到 Rust Core 引擎 + SQLite 后端。

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ============================================================
// 类型
// ============================================================

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
#[serde(rename_all = "camelCase")]
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

// ============================================================
// 应用状态
// ============================================================

pub struct AppState {
    pub notes: Mutex<Vec<Note>>,
}

impl AppState {
    pub fn new() -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            notes: Mutex::new(vec![
                Note {
                    meta: NoteMeta {
                        id: "1".into(),
                        title: "NoteForge 架构设计".into(),
                        notebook_id: "tech".into(),
                        tags: vec!["架构".into(), "Rust".into(), "Tauri".into()],
                        is_pinned: true,
                        is_favorite: false,
                        word_count: 128,
                        version: 3,
                        created_at: now - 86400000 * 3,
                        updated_at: now - 300000,
                        backlinks: 2,
                    },
                    content: "# NoteForge 架构设计\n\n## 系统概览\n\nNoteForge 采用 **离线优先** 架构。\n\n- **Markdown 解析** — 10万字 < 8ms\n- **本地存储** — SQLite + WAL\n- **全文搜索** — Tantivy\n\n> 数据属于用户。".into(),
                },
                Note {
                    meta: NoteMeta {
                        id: "2".into(),
                        title: "Rust 内存安全入门".into(),
                        notebook_id: "tech".into(),
                        tags: vec!["Rust".into()],
                        is_pinned: false,
                        is_favorite: true,
                        word_count: 340,
                        version: 2,
                        created_at: now - 86400000 * 2,
                        updated_at: now - 3600000,
                        backlinks: 0,
                    },
                    content: "# Rust 内存安全入门\n\n## 所有权系统\n\nRust 在**编译期**保证内存安全。\n\n```rust\nlet s = String::from(\"hello\");\n```".into(),
                },
                Note {
                    meta: NoteMeta {
                        id: "3".into(),
                        title: "2026 Q2 学习计划".into(),
                        notebook_id: "default".into(),
                        tags: vec!["计划".into()],
                        is_pinned: true,
                        is_favorite: false,
                        word_count: 89,
                        version: 1,
                        created_at: now - 86400000,
                        updated_at: now - 86400000 * 2,
                        backlinks: 0,
                    },
                    content: "# 2026 Q2 学习计划\n\n- [ ] 深入 Rust 异步编程\n- [ ] 学习 Tauri 插件开发\n- [ ] 完成 NoteForge MVP".into(),
                },
            ]),
        }
    }
}

// ============================================================
// 命令
// ============================================================

#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "NoteForge",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "全平台智能笔记系统",
        "offline": true,
    })
}

#[tauri::command]
pub fn list_notes(state: State<AppState>) -> Result<Vec<Note>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    Ok(notes.clone())
}

#[tauri::command]
pub fn get_note(state: State<AppState>, id: String) -> Result<Note, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    notes
        .iter()
        .find(|n| n.meta.id == id)
        .cloned()
        .ok_or_else(|| "笔记未找到".into())
}

#[tauri::command]
pub fn create_note(
    state: State<AppState>,
    request: CreateNoteRequest,
) -> Result<Note, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let id = format!("{}-{:06x}", now, rand_noise());

    let note = Note {
        meta: NoteMeta {
            id: id.clone(),
            title: request.title,
            notebook_id: request.notebook_id,
            tags: request.tags,
            is_pinned: false,
            is_favorite: false,
            word_count: request.content.len() as u32,
            version: 1,
            created_at: now,
            updated_at: now,
            backlinks: 0,
        },
        content: request.content,
    };

    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    notes.insert(0, note.clone());
    Ok(note)
}

#[tauri::command]
pub fn update_note(
    state: State<AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
    is_pinned: Option<bool>,
    is_favorite: Option<bool>,
) -> Result<Note, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    let note = notes
        .iter_mut()
        .find(|n| n.meta.id == id)
        .ok_or_else(|| -> String { "笔记未找到".to_string() })?;

    if let Some(t) = title { note.meta.title = t; }
    if let Some(c) = content {
        note.content = c;
        note.meta.word_count = note.content.len() as u32;
    }
    if let Some(t) = tags { note.meta.tags = t; }
    if let Some(p) = is_pinned { note.meta.is_pinned = p; }
    if let Some(f) = is_favorite { note.meta.is_favorite = f; }
    note.meta.version += 1;
    note.meta.updated_at = now;

    Ok(note.clone())
}

#[tauri::command]
pub fn delete_note(state: State<AppState>, id: String) -> Result<(), String> {
    let mut notes = state.notes.lock().map_err(|e| e.to_string())?;
    notes.retain(|n| n.meta.id != id);
    Ok(())
}

#[tauri::command]
pub fn search_notes(state: State<AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    let q = query.to_lowercase();
    Ok(notes
        .iter()
        .filter(|n| {
            n.meta.title.to_lowercase().contains(&q)
                || n.meta.tags.iter().any(|t| t.to_lowercase().contains(&q))
                || n.content.to_lowercase().contains(&q)
        })
        .map(|n| SearchResult {
            id: n.meta.id.clone(),
            title: n.meta.title.clone(),
            snippet: n.content.chars().take(60).collect(),
        })
        .collect())
}

#[tauri::command]
pub fn create_notebook(_state: State<AppState>, _name: String) -> Result<Notebook, String> {
    Ok(Notebook {
        id: "default".into(),
        name: "默认笔记本".into(),
        icon: "📓".into(),
        note_count: 0,
    })
}

#[tauri::command]
pub fn list_notebooks(state: State<AppState>) -> Result<Vec<Notebook>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    let mut nbs: Vec<Notebook> = vec![
        Notebook { id: "default".into(), name: "默认笔记本".into(), icon: "📓".into(), note_count: 0 },
        Notebook { id: "tech".into(), name: "技术笔记".into(), icon: "💻".into(), note_count: 0 },
        Notebook { id: "project".into(), name: "项目文档".into(), icon: "🗂️".into(), note_count: 0 },
    ];
    for nb in &mut nbs {
        nb.note_count = notes.iter().filter(|n| n.meta.notebook_id == nb.id).count() as u32;
    }
    Ok(nbs)
}

#[tauri::command]
pub fn list_tags(state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let notes = state.notes.lock().map_err(|e| e.to_string())?;
    let mut tag_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    for note in notes.iter() {
        for tag in &note.meta.tags {
            *tag_counts.entry(tag.clone()).or_insert(0) += 1;
        }
    }
    Ok(tag_counts
        .into_iter()
        .map(|(name, count)| TagInfo { name, count })
        .collect())
}

/// 基于时间生成一个随机噪声值
fn rand_noise() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    (d.as_nanos() & 0xFFFFFF) as u64
}
