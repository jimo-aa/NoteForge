//! NoteForge Core — 公共类型定义

use serde::{Deserialize, Serialize};


// ============================================================
// 笔记
// ============================================================

/// 笔记元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    #[serde(rename = "notebookId")]
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
    #[serde(rename = "wordCount")]
    pub word_count: u32,
    pub version: u32,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

/// 笔记完整数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub meta: NoteMeta,
    pub content: String,        // Markdown 原文
    pub content_plain: String,  // 纯文本（用于搜索）
}

/// 创建笔记请求
#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    #[serde(alias = "notebookId")]
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
}

/// 更新笔记请求
#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(alias = "notebookId")]
    pub notebook_id: Option<String>,
    pub tags: Option<Vec<String>>,
    #[serde(alias = "isPinned")]
    pub is_pinned: Option<bool>,
    #[serde(alias = "isFavorite")]
    pub is_favorite: Option<bool>,
}

// ============================================================
// 笔记本
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "noteCount")]
    pub note_count: u32,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}

// ============================================================
// 标签
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub note_count: u32,
}

// ============================================================
// 搜索结果
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub note_id: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub updated_at: u64,
    #[serde(default)]
    pub total_hits: usize,
}

// ============================================================
// 同步
// ============================================================

/// 同步变更
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncChange {
    pub note_id: String,
    pub version: u32,
    pub action: SyncAction,
    pub data: Option<String>,  // JSON 序列化的笔记
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncAction {
    Create,
    Update,
    Delete,
}

// ============================================================
// 工具
// ============================================================

/// 生成 UUID v4
pub fn generate_id() -> String {
    uuid_v4()
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (now >> 32) as u32,
        (now >> 16) as u16,
        (now & 0xFFFF) as u16,
        ((now >> 48) as u16 & 0x3FFF) | 0x8000,
        (now as u64 >> 8) & 0xFFFFFFFFFFFF
    )
}

/// 同步队列条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncQueueItem {
    pub id: String,
    #[serde(rename = "noteId")]
    pub note_id: String,
    pub operation: String,
    pub payload: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

/// 反向链接条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklinkEntry {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "sourceTitle")]
    pub source_title: String,
}

/// 获取当前时间戳（毫秒）
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
