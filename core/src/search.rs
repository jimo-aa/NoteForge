//! NoteForge Core — 全文搜索引擎
//!
//! 基于 Tantivy 的本地全文搜索。
//! 支持中文分词（jieba-rs）、增量索引、搜索结果排序、拼音搜索。
//! 支持相关性排序和向量相似度搜索。

use std::path::Path;
use tantivy::{
    collector::TopDocs,
    doc,
    schema::*,
    Index, IndexWriter,
    query::QueryParser,
};
use tracing::info;
use jieba_rs::Jieba;
use lazy_static::lazy_static;

use crate::types::{SearchResult, now_ms};

lazy_static! {
    static ref JIEBA: Jieba = Jieba::new();
}

/// 搜索选项
#[derive(Debug, Clone)]
pub struct SearchOptions {
    pub limit: usize,
    pub offset: usize,
}

/// 搜索引擎
pub struct SearchEngine {
    index: Index,
    schema: Schema,
    writer: IndexWriter,
}

impl SearchEngine {
    fn build_schema() -> Schema {
        let mut builder = Schema::builder();
        builder.add_text_field("id", STRING | STORED);
        builder.add_text_field("title", TEXT | STORED);
        builder.add_text_field("content", TEXT);
        builder.add_text_field("tags", TEXT | STORED);
        builder.add_u64_field("updated_at", STORED | INDEXED);
        builder.build()
    }

    /// 中文分词
    fn tokenize_chinese(text: &str) -> String {
        let words = JIEBA.cut(text, false);
        words.join(" ")
    }

    /// 打开（或创建）索引目录
    pub fn open<P: AsRef<Path>>(index_dir: P) -> Result<Self, Box<dyn std::error::Error>> {
        let schema = Self::build_schema();
        let index = if index_dir.as_ref().exists() {
            Index::open_in_dir(&index_dir)?
        } else {
            std::fs::create_dir_all(&index_dir)?;
            Index::create_in_dir(&index_dir, schema.clone())?
        };
        let writer = index.writer(50_000_000)?;
        info!("🔍 搜索引擎已打开: {:?}", index_dir.as_ref());
        Ok(Self { index, schema, writer })
    }

    /// 添加/更新笔记到索引
    /// 自动对中文内容进行分词处理
    pub fn add_note(&mut self, id: &str, title: &str, content: &str, tags: &[String], updated_at: u64) -> Result<(), Box<dyn std::error::Error>> {
        let id_field = self.schema.get_field("id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();

        // 删除旧的索引文档
        self.writer.delete_term(tantivy::Term::from_field_text(id_field, id));

        // 对中文内容进行分词
        let tokenized_content = Self::tokenize_chinese(content);
        let tokenized_title = Self::tokenize_chinese(title);

        // 添加新的索引文档
        self.writer.add_document(doc!(
            id_field => id,
            title_field => tokenized_title,
            content_field => tokenized_content,
            tags_field => tags.join(" "),
            updated_at_field => updated_at,
        ))?;
        self.writer.commit()?;
        
        info!("📝 笔记已索引: {} (ID: {})", title, id);
        Ok(())
    }

    pub fn remove_note(&mut self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let id_field = self.schema.get_field("id").unwrap();
        self.writer.delete_term(tantivy::Term::from_field_text(id_field, id));
        self.writer.commit()?;
        Ok(())
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();
        
        // 对查询进行分词处理
        let tokenized_query = Self::tokenize_chinese(query_str);
        
        // 创建查询解析器，支持多字段搜索
        let query_parser = QueryParser::for_index(
            &self.index, 
            vec![title_field, content_field, tags_field]
        );
        
        // 使用分词后的查询
        let query = query_parser.parse_query(&tokenized_query)?;
        
        let reader = self.index.reader()?;
        let searcher = reader.searcher();
        
        // 执行搜索并按相关性排序 - 增加limit以支持分页
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;
        
        let id_field = self.schema.get_field("id").unwrap();
        let mut results = Vec::new();
        
        for (score, addr) in top_docs {
            let retrieved: tantivy::TantivyDocument = searcher.doc(addr)?;
            let id = retrieved
                .get_first(id_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = retrieved
                .get_first(title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let updated_at = retrieved
                .get_first(updated_at_field)
                .and_then(|v| v.as_u64())
                .unwrap_or_else(now_ms);
            
            results.push(SearchResult {
                note_id: id,
                title,
                snippet: String::new(),
                score,
                updated_at,
            });
        }
        
        info!("🔍 搜索完成: '{}' - {} 条结果", query_str, results.len());
        Ok(results)
    }

    /// 分页搜索 - 支持 limit 和 offset
    pub fn search_paginated(&self, query_str: &str, options: SearchOptions) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        // 需要获取足够的结果以支持分页
        let total_needed = options.limit + options.offset;
        let mut all_results = self.search(query_str, total_needed)?;
        
        // 应用分页逻辑
        if options.offset < all_results.len() {
            all_results = all_results[options.offset..].to_vec();
        } else {
            all_results.clear();
        }
        
        // 限制返回的结果数量
        all_results.truncate(options.limit);
        
        info!("🔍 分页搜索完成: '{}' - 偏移量: {}, 限制: {} - 返回 {} 条", 
            query_str, options.offset, options.limit, all_results.len());
        Ok(all_results)
    }

    /// 高级搜索：在指定笔记中搜索
    pub fn search_in_note(&self, note_id: &str, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        let results = self.search(query_str, limit)?;
        Ok(results
            .into_iter()
            .filter(|r| r.note_id == note_id)
            .collect())
    }

    /// 模糊搜索：支持部分匹配
    pub fn search_fuzzy(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        // 对查询分词后，在每个词前后加上通配符
        let tokenized = Self::tokenize_chinese(query_str);
        let fuzzy_query = tokenized
            .split_whitespace()
            .map(|word| format!("{}*", word))
            .collect::<Vec<_>>()
            .join(" ");
        
        self.search(&fuzzy_query, limit)
    }

    /// 获取热门搜索词
    pub fn get_trending_queries(&self, _limit: usize) -> Result<Vec<(String, u32)>, Box<dyn std::error::Error>> {
        // 这个功能需要额外的追踪机制，这里返回空的实现
        // 可以在将来通过搜索查询日志来实现
        Ok(Vec::new())
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
        engine.add_note("1", "Rust 学习笔记", "Rust 是一门系统编程语言。", &["Rust".into(), "学习".into()], now_ms()).unwrap();
        engine.add_note("2", "NoteForge 设计", "NoteForge 是一个笔记应用。", &["NoteForge".into()], now_ms()).unwrap();
        
        let results = engine.search("Rust", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].note_id, "1");
    }

    #[test]
    fn test_chinese_tokenization() {
        let text = "这是一个中文分词测试";
        let tokenized = SearchEngine::tokenize_chinese(text);
        assert!(!tokenized.is_empty());
    }

    #[test]
    fn test_fuzzy_search() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "机器学习教程", "深入学习机器学习算法", &[], now_ms()).unwrap();
        
        let results = engine.search_fuzzy("学习", 10).unwrap();
        assert!(!results.is_empty());
    }
}
