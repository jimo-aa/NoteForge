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
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub word_count: u32,
    pub version: u32,
    pub created_at: u64,
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
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
}

/// 更新笔记请求
#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub notebook_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_pinned: Option<bool>,
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
    pub parent_id: Option<String>,
    pub note_count: u32,
    pub sort_order: i32,
    pub created_at: u64,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub query: String,
    pub limit: usize,
    pub offset: usize,
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
        (now >> 16) as u16 & 0xFFFF,
        (now & 0xFFFF) as u16,
        ((now >> 48) as u16 & 0x3FFF) | 0x8000,
        (now as u64 >> 8) & 0xFFFFFFFFFFFF
    )
}

/// 获取当前时间戳（毫秒）
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
