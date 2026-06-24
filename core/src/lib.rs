//! NoteForge Core — Rust 核心引擎
//!
//! # 模块说明
//!
//! - `md_engine` — Markdown 解析、AST、HTML 渲染、Wiki Link 提取
//! - `storage` — SQLite 本地存储，笔记/笔记本/标签 CRUD
//! - `search` — Tantivy 全文搜索引擎
//! - `types` — 公共数据类型

pub mod md_engine;
pub mod storage;
pub mod search;
pub mod types;

use std::path::Path;
use tracing::info;

/// NoteForge 核心引擎
pub struct NoteForge {
    pub storage: storage::LocalStorage,
    pub search: search::SearchEngine,
}

impl NoteForge {
    /// 打开（或创建）一个笔记本仓库
    pub fn open<P: AsRef<Path>>(data_dir: P) -> Result<Self, Box<dyn std::error::Error>> {
        let data_dir = data_dir.as_ref();
        std::fs::create_dir_all(data_dir)?;

        info!("📂 打开笔记本仓库: {:?}", data_dir);

        let storage = storage::LocalStorage::open(data_dir.join("noteforge.db"))?;
        let search = search::SearchEngine::open(data_dir.join("index"))?;

        Ok(Self { storage, search })
    }

    pub fn version() -> &'static str {
        env!("CARGO_PKG_VERSION")
    }
}
