use std::path::Path;
use tantivy::{
    collector::{Count, TopDocs},
    doc,
    schema::*,
    Index, IndexWriter,
    query::{BooleanQuery, FuzzyTermQuery, QueryParser, TermQuery},
    Term,
};
use tracing::info;
use jieba_rs::Jieba;
use lazy_static::lazy_static;

use crate::types::{SearchResult, now_ms};
use crate::error::CoreError;

lazy_static! {
    static ref JIEBA: Jieba = Jieba::new();
}

#[derive(Debug, Clone)]
pub struct SearchOptions {
    pub limit: usize,
    pub offset: usize,
}

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
        builder.add_text_field("content", TEXT | STORED);
        builder.add_text_field("tags", TEXT | STORED);
        builder.add_u64_field("updated_at", STORED | INDEXED);
        builder.build()
    }

    fn tokenize_chinese(text: &str) -> String {
        let words = JIEBA.cut(text, true);
        words.join(" ")
    }

    pub fn open<P: AsRef<Path>>(index_dir: P) -> Result<Self, CoreError> {
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

    pub fn add_note(&mut self, id: &str, title: &str, content: &str, tags: &[String], updated_at: u64) -> Result<(), CoreError> {
        let id_field = self.schema.get_field("id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();

        self.writer.delete_term(Term::from_field_text(id_field, id));

        let tokenized_content = Self::tokenize_chinese(content);
        let tokenized_title = Self::tokenize_chinese(title);

        self.writer.add_document(doc!(
            id_field => id,
            title_field => tokenized_title,
            content_field => tokenized_content,
            tags_field => tags.join(" "),
            updated_at_field => updated_at,
        ))?;

        info!("📝 笔记已索引: {} (ID: {})", title, id);
        Ok(())
    }

    pub fn commit(&mut self) -> Result<(), CoreError> {
        self.writer.commit()?;
        Ok(())
    }

    pub fn remove_note(&mut self, id: &str) -> Result<(), CoreError> {
        let id_field = self.schema.get_field("id").unwrap();
        self.writer.delete_term(Term::from_field_text(id_field, id));
        Ok(())
    }

    fn extract_snippet(&self, content: &str, query_lower: &str, context_chars: usize) -> String {
        let content_flat: Vec<char> = content.chars().collect();
        let flat_len = content_flat.len();
        let flat_string: String = content_flat.iter().collect();
        let flat_lower = flat_string.to_lowercase();
        let query_lower_chars: Vec<char> = query_lower.chars().collect();

        if let Some(pos) = flat_lower.find(query_lower) {
            let pos_chars = flat_lower[..pos].chars().count();
            let qlen_chars = query_lower_chars.len();
            let start = pos_chars.saturating_sub(context_chars);
            let end = (pos_chars + qlen_chars + context_chars).min(flat_len);
            let mut snippet = String::new();
            if start > 0 {
                snippet.push_str("...");
            }
            for c in &content_flat[start..end] {
                snippet.push(*c);
            }
            if end < flat_len {
                snippet.push_str("...");
            }
            return snippet;
        }

        if flat_len > context_chars * 2 {
            let mut s = String::new();
            for c in &content_flat[..context_chars * 2] {
                s.push(*c);
            }
            s.push_str("...");
            s
        } else {
            flat_string
        }
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, CoreError> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        let tokenized_query = Self::tokenize_chinese(query_str);

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![title_field, content_field, tags_field]
        );

        let query = query_parser.parse_query(&tokenized_query)?;

        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        let query_lower = query_str.to_lowercase();
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
            let content = retrieved
                .get_first(content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let updated_at = retrieved
                .get_first(updated_at_field)
                .and_then(|v| v.as_u64())
                .unwrap_or_else(now_ms);

            let snippet = self.extract_snippet(&content, &query_lower, 60);

            results.push(SearchResult {
                note_id: id,
                title,
                snippet,
                score,
                updated_at,
                total_hits: 0,
            });
        }

        info!("🔍 搜索完成: '{}' - {} 条结果", query_str, results.len());
        Ok(results)
    }

    pub fn search_paginated(&self, query_str: &str, options: SearchOptions) -> Result<SearchPage, CoreError> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        let tokenized_query = Self::tokenize_chinese(query_str);

        let query_parser = QueryParser::for_index(
            &self.index,
            vec![title_field, content_field, tags_field]
        );

        let query = query_parser.parse_query(&tokenized_query)?;

        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        let total_hits = searcher.search(&query, &Count)?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(options.limit + options.offset))?;

        let query_lower = query_str.to_lowercase();
        let mut results = Vec::new();

        for (score, addr) in top_docs.iter().skip(options.offset).take(options.limit) {
            let score = *score;
            let retrieved: tantivy::TantivyDocument = searcher.doc(*addr)?;
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
            let content = retrieved
                .get_first(content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let updated_at = retrieved
                .get_first(updated_at_field)
                .and_then(|v| v.as_u64())
                .unwrap_or_else(now_ms);

            let snippet = self.extract_snippet(&content, &query_lower, 60);

            results.push(SearchResult {
                note_id: id,
                title,
                snippet,
                score,
                updated_at,
                total_hits,
            });
        }

        info!("🔍 分页搜索完成: '{}' - 总计 {} 条, 返回 {} 条", query_str, total_hits, results.len());
        Ok(SearchPage { results, total_hits })
    }

    pub fn search_in_note(&self, note_id: &str, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, CoreError> {
        let id_field = self.schema.get_field("id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();

        let tokenized_query = Self::tokenize_chinese(query_str);
        let query_parser = QueryParser::for_index(
            &self.index,
            vec![title_field, content_field, tags_field]
        );
        let text_query = query_parser.parse_query(&tokenized_query)?;

        let id_query = TermQuery::new(
            Term::from_field_text(id_field, note_id),
            tantivy::schema::IndexRecordOption::Basic,
        );

        let boolean_query = BooleanQuery::new(vec![
            (tantivy::query::Occur::Must, Box::new(text_query)),
            (tantivy::query::Occur::Must, Box::new(id_query)),
        ]);

        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        let top_docs = searcher.search(&boolean_query, &TopDocs::with_limit(limit))?;

        let query_lower = query_str.to_lowercase();
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
            let content = retrieved
                .get_first(content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let updated_at = retrieved
                .get_first(updated_at_field)
                .and_then(|v| v.as_u64())
                .unwrap_or_else(now_ms);

            let snippet = self.extract_snippet(&content, &query_lower, 60);

            results.push(SearchResult {
                note_id: id,
                title,
                snippet,
                score,
                updated_at,
                total_hits: 0,
            });
        }

        info!("🔍 笔记内搜索完成: note={}, '{}' - {} 条结果", note_id, query_str, results.len());
        Ok(results)
    }

    pub fn search_fuzzy(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, CoreError> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        let tokenized = Self::tokenize_chinese(query_str);
        let words: Vec<&str> = tokenized.split_whitespace().collect();
        if words.is_empty() {
            return Ok(Vec::new());
        }

        let mut subqueries: Vec<(tantivy::query::Occur, Box<dyn tantivy::query::Query>)> = Vec::new();
        for word in &words {
            for field in &[title_field, content_field, tags_field] {
                subqueries.push((tantivy::query::Occur::Should, Box::new(FuzzyTermQuery::new(
                    Term::from_field_text(*field, word),
                    1,
                    true,
                ))));
                subqueries.push((tantivy::query::Occur::Should, Box::new(TermQuery::new(
                    Term::from_field_text(*field, word),
                    tantivy::schema::IndexRecordOption::Basic,
                ))));
            }
        }

        let query_parser = QueryParser::for_index(&self.index, vec![title_field, content_field, tags_field]);
        if let Ok(parsed) = query_parser.parse_query(&tokenized) {
            subqueries.push((tantivy::query::Occur::Should, parsed));
        }

        let boolean_query = BooleanQuery::new(subqueries);

        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        let top_docs = searcher.search(&boolean_query, &TopDocs::with_limit(limit))?;

        let query_lower = query_str.to_lowercase();
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
            let content = retrieved
                .get_first(content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let updated_at = retrieved
                .get_first(updated_at_field)
                .and_then(|v| v.as_u64())
                .unwrap_or_else(now_ms);

            let snippet = self.extract_snippet(&content, &query_lower, 60);

            results.push(SearchResult {
                note_id: id,
                title,
                snippet,
                score,
                updated_at,
                total_hits: 0,
            });
        }

        info!("🔍 模糊搜索完成: '{}' - {} 条结果", query_str, results.len());
        Ok(results)
    }

    pub fn get_trending_queries(&self, _limit: usize) -> Result<Vec<(String, u32)>, CoreError> {
        Ok(Vec::new())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPage {
    pub results: Vec<SearchResult>,
    pub total_hits: usize,
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
        engine.commit().unwrap();
        engine.add_note("2", "NoteForge 设计", "NoteForge 是一个笔记应用。", &["NoteForge".into()], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search("Rust", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].note_id, "1");
    }

    #[test]
    fn test_snippet_generated() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Test", "这是一段包含 Rust 关键字的测试内容，用于验证摘要生成功能。", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search("Rust", 10).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].snippet.contains("Rust"));
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
        engine.commit().unwrap();

        let results = engine.search_fuzzy("学习", 10).unwrap();
        assert!(!results.is_empty());
    }

    #[test]
    fn test_search_in_note() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Note A", "内容包含 Rust 编程语言", &[], now_ms()).unwrap();
        engine.add_note("2", "Note B", "内容包含 Python 编程语言", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search_in_note("1", "Rust", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].note_id, "1");

        let results = engine.search_in_note("2", "Rust", 10).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_paginated_search() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        for i in 0..10 {
            engine.add_note(&i.to_string(), &format!("Note {}", i), "内容包含 Rust 编程", &[], now_ms()).unwrap();
        }
        engine.commit().unwrap();

        let page = engine.search_paginated("Rust", SearchOptions { limit: 3, offset: 2 }).unwrap();
        assert_eq!(page.results.len(), 3);
        assert_eq!(page.total_hits, 10);
    }

    #[test]
    fn test_empty_query_returns_empty() {
        let dir = tempdir().unwrap();
        let engine = SearchEngine::open(dir.path().join("index")).unwrap();
        let results = engine.search("", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_re_add_after_delete() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Temp", "Temporary note", &[], now_ms()).unwrap();
        engine.commit().unwrap();
        engine.remove_note("1").unwrap();
        engine.commit().unwrap();
        // Re-add with same id but new content
        engine.add_note("1", "Permanent", "Permanent content", &[], now_ms()).unwrap();
        engine.commit().unwrap();
        let results = engine.search("Permanent", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Permanent");
        let old = engine.search("Temporary", 10).unwrap();
        assert!(old.is_empty());
    }

    #[test]
    fn test_unicode_search() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "日本語タイトル", "日本語の内容です。", &[], now_ms()).unwrap();
        engine.add_note("2", "한국어 제목", "한국어 내용입니다.", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search("日本語", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].note_id, "1");
    }

    #[test]
    fn test_search_not_found() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Rust", "Systems programming", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search("Python", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_fuzzy_search_finds_typo() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "机器学习", "深入机器学习算法", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        // "学" should fuzzy match "学习"
        let results = engine.search_fuzzy("学", 10).unwrap();
        assert!(!results.is_empty());
    }

    #[test]
    fn test_empty_fuzzy_query() {
        let dir = tempdir().unwrap();
        let engine = SearchEngine::open(dir.path().join("index")).unwrap();
        let results = engine.search_fuzzy("", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_update_note_reindex() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Original", "Original content", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        // Update same note with new content
        engine.add_note("1", "Updated", "Updated content", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        let results = engine.search("Updated", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].title, "Updated");
    }

    #[test]
    fn test_remove_note_excludes_from_search() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        engine.add_note("1", "Rust", "Rust programming", &[], now_ms()).unwrap();
        engine.commit().unwrap();

        engine.remove_note("1").unwrap();
        engine.commit().unwrap();

        let results = engine.search("Rust", 10).unwrap();
        assert!(results.is_empty());
    }
}
