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

/// A character offset range within a snippet text marking a matched term.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightSpan {
    pub start: u16,
    pub end: u16,
}

/// Snippet text with associated highlight spans for matched terms.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetHighlights {
    pub text: String,
    pub highlights: Vec<HighlightSpan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub note_id: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub updated_at: u64,
    #[serde(default)]
    pub total_hits: usize,
    /// Structured snippet with character-level highlight spans.
    /// Frontend should use this for rendering <mark> tags when available.
    #[serde(default)]
    pub snippet_highlights: Option<SnippetHighlights>,
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

// ============================================================
// 版本快照 (NoteSnapshot) — 替代旧的 git.git_history + milestone
// ============================================================

/// 笔记版本快照
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSnapshot {
    pub id: String,
    pub note_id: String,
    pub version_number: u32,
    pub title: String,
    pub description: String,
    pub content: String,
    pub content_plain: String,
    pub word_count: u32,
    pub is_auto_save: bool,
    pub created_at: u64,
}

/// Diff 操作
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffOperation {
    pub op_type: String,  // "add" | "remove" | "equal"
    pub line_num: u32,
    pub old_text: Option<String>,
    pub new_text: Option<String>,
    pub context: String,
}

/// Diff 结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub from_version: String,
    pub to_version: String,
    pub operations: Vec<DiffOperation>,
    pub similarity: f32,
    pub change_summary: ChangeSummary,
}

/// 变更摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSummary {
    pub lines_added: u32,
    pub lines_removed: u32,
    pub lines_modified: u32,
    pub word_count_delta: i32,
}

/// 扫描到的外部笔记信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedNote {
    pub file_path: String,
    pub title: String,
    pub modified_at: u64,
}

/// 递归扫描得到的文件树节点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFileTree {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<ScannedFileTree>,
    pub title: String,
    pub modified_at: u64,
}

/// 获取当前时间戳（毫秒）
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
