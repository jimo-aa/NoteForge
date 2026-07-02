//! NoteForge Core — 统一错误类型
//!
//! 替代原有的 `Box<dyn std::error::Error>` 模式，提供类型化的错误处理。

use thiserror::Error;

/// 核心引擎错误
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("SQLite 错误: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("全文搜索错误: {0}")]
    Search(#[from] tantivy::TantivyError),

    #[error("搜索查询错误: {0}")]
    SearchQuery(String),

    #[error("加密错误: {0}")]
    Encryption(#[from] crate::encryption::EncryptionError),

    #[error("解析错误: {0}")]
    Parse(String),

    #[error("操作失败: {0}")]
    Operation(String),

    #[error("未找到: {0}")]
    NotFound(String),
}

impl From<tantivy::query::QueryParserError> for CoreError {
    fn from(e: tantivy::query::QueryParserError) -> Self {
        CoreError::SearchQuery(e.to_string())
    }
}

impl From<String> for CoreError {
    fn from(msg: String) -> Self {
        CoreError::Operation(msg)
    }
}

impl From<&str> for CoreError {
    fn from(msg: &str) -> Self {
        CoreError::Operation(msg.to_string())
    }
}
