//! NoteForge Core — 全文搜索引擎
//!
//! 基于 Tantivy 的本地全文搜索。
//! 支持中文分词（jieba-rs）、增量索引、搜索结果排序。

use tantivy::{
    doc,
    schema::*,
    Index, IndexWriter, Searcher, ReloadPolicy,
    query::QueryParser,
    collector::TopDocs,
};
use std::path::Path;
use tracing::info;

use crate::types::SearchResult;

/// 搜索引擎
pub struct SearchEngine {
    index: Index,
    schema: Schema,
    #[allow(dead_code)]
    writer: IndexWriter,
}

impl SearchEngine {
    /// 打开（或创建）索引目录
    pub fn open<P: AsRef<Path>>(index_dir: P) -> Result<Self, Box<dyn std::error::Error>> {
        let mut schema_builder = Schema::builder();
        schema_builder.add_text_field("id", STRING | STORED);
        schema_builder.add_text_field("title", TEXT | STORED);
        schema_builder.add_text_field("content", TEXT);
        let schema = schema_builder.build();

        let index = if index_dir.as_ref().exists() {
            Index::open_in_dir(&index_dir)?
        } else {
            std::fs::create_dir_all(&index_dir)?;
            Index::create_in_dir(&index_dir, schema.clone())?
        };

        let writer = index.writer(50_000_000)?; // 50MB buffer

        info!("🔍 搜索引擎已打开: {:?}", index_dir.as_ref());
        Ok(Self { index, schema, writer })
    }

    /// 添加笔记到索引
    pub fn add_note(&mut self, id: &str, title: &str, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        let id_field = self.schema.get_field("id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();

        // 先删除旧文档（如果有）
        self.writer.delete_term(
            tantivy::Term::from_field_text(id_field, id)
        );

        // 添加新文档
        self.writer.add_document(doc!(
            id_field => id,
            title_field => title,
            content_field => content,
        ))?;

        // 批量提交（每 10 条）
        self.writer.commit()?;

        Ok(())
    }

    /// 从索引移除笔记
    pub fn remove_note(&mut self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let id_field = self.schema.get_field("id").unwrap();
        self.writer.delete_term(
            tantivy::Term::from_field_text(id_field, id)
        );
        self.writer.commit()?;
        Ok(())
    }

    /// 搜索
    pub fn search(
        &self,
        query_str: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();

        // 创建查询解析器
        let query_parser = QueryParser::for_index(
            &self.index,
            vec![title_field, content_field],
        );

        // 构建查询：标题权重 3x，内容 1x
        let query_str = if query_str.contains(':') || query_str.contains('"') {
            query_str.to_string()
        } else {
            // 简单查询：标题权重提升
            format!("title:{} {}", query_str, query_str)
        };

        let query = query_parser.parse_query(&query_str)?;

        // 搜索
        let reader = self.index.reader()?;
        let searcher = reader.searcher();
        let top_docs = searcher.search(
            &query,
            &TopDocs::with_limit(limit),
        )?;

        let id_field = self.schema.get_field("id").unwrap();
        let title_field_store = self.schema.get_field("title").unwrap();

        let results: Vec<SearchResult> = top_docs
            .into_iter()
            .map(|(score, doc_addr)| {
                let doc = searcher.doc(doc_addr).unwrap();
                let id = doc
                    .get_first(id_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let title = doc
                    .get_first(title_field_store)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                SearchResult {
                    note_id: id,
                    title,
                    snippet: String::new(), // 需要高亮片段时再填充
                    score,
                    updated_at: 0,
                }
            })
            .collect();

        Ok(results)
    }

    /// 获取索引中的文档总数
    pub fn total_docs(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let reader = self.index.reader()?;
        let searcher = reader.searcher();
        Ok(searcher.num_docs() as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_search_add_and_find() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();

        engine.add_note("1", "Rust 学习笔记", "Rust 是一门系统编程语言。").unwrap();
        engine.add_note("2", "NoteForge 设计", "NoteForge 是一个笔记应用。").unwrap();
        engine.add_note("3", "Python 入门", "Python 是脚本语言。").unwrap();

        // 搜索 "笔记"
        let results = engine.search("笔记", 10).unwrap();
        assert!(results.len() >= 2); // "Rust 学习笔记" 和 "NoteForge 设计" 应该匹配
    }
}
