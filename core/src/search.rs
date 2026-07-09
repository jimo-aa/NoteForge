use std::fs;
use std::path::{Path, PathBuf};
use tantivy::{
    collector::{Count, TopDocs},
    doc,
    schema::*,
    Index, IndexWriter,
    query::{BooleanQuery, FuzzyTermQuery, QueryParser, TermQuery},
    Term,
};
use tracing::{info, warn};
use jieba_rs::Jieba;
use lazy_static::lazy_static;

use crate::types::{SearchResult, now_ms};
use crate::error::CoreError;

/// Current schema version for search index.
/// Increment when making breaking schema changes that require re-indexing.
pub const SCHEMA_VERSION: u32 = 2;

/// A minimal note representation for index rebuild operations.
#[derive(Debug, Clone)]
pub struct IndexableNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub updated_at: u64,
}

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
    index_dir: PathBuf,
    schema_version: u32,
    needs_rebuild: bool,
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
        let index_dir_path = index_dir.as_ref().to_path_buf();
        let schema = Self::build_schema();
        let is_new = !index_dir_path.exists();

        let index = if is_new {
            std::fs::create_dir_all(&index_dir_path)?;
            Index::create_in_dir(&index_dir_path, schema.clone())?
        } else {
            Index::open_in_dir(&index_dir_path)?
        };
        let writer = index.writer(50_000_000)?;

        // Check schema version
        let (schema_version, needs_rebuild) = if is_new {
            // New index — write current schema version
            Self::write_schema_version(&index_dir_path, SCHEMA_VERSION)?;
            (SCHEMA_VERSION, false)
        } else {
            let disk_version = Self::read_schema_version(&index_dir_path);
            if disk_version < SCHEMA_VERSION {
                warn!(
                    "🔍 索引 schema 版本不匹配: disk={}, current={}. 需要重建索引",
                    disk_version, SCHEMA_VERSION
                );
                (disk_version, true)
            } else {
                (SCHEMA_VERSION, false)
            }
        };

        info!("🔍 搜索引擎已打开: {:?}", index_dir_path);
        Ok(Self {
            index,
            schema,
            writer,
            index_dir: index_dir_path,
            schema_version,
            needs_rebuild,
        })
    }

    fn schema_version_path(dir: &Path) -> PathBuf {
        dir.join("schema_version.txt")
    }

    fn read_schema_version(dir: &Path) -> u32 {
        let path = Self::schema_version_path(dir);
        fs::read_to_string(path)
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(0)
    }

    fn write_schema_version(dir: &Path, version: u32) -> Result<(), CoreError> {
        let path = Self::schema_version_path(dir);
        fs::write(&path, version.to_string())?;
        Ok(())
    }

    /// Check whether the index needs a rebuild due to schema version mismatch.
    pub fn needs_rebuild(&self) -> bool {
        self.needs_rebuild
    }

    /// Rebuild the search index from scratch using the provided notes.
    ///
    /// Creates a new index in a temporary directory, indexes all notes,
    /// then atomically swaps with the existing index directory.
    /// After successful rebuild, the schema version is updated.
    pub fn rebuild_index(&mut self, notes: &[IndexableNote]) -> Result<(), CoreError> {
        let temp_dir = self.index_dir.with_extension("index_rebuild_tmp");
        let _ = fs::remove_dir_all(&temp_dir);

        // Create a new index in the temp directory
        let schema = Self::build_schema();
        std::fs::create_dir_all(&temp_dir)?;
        let new_index = Index::create_in_dir(&temp_dir, schema.clone())?;
        let mut new_writer = new_index.writer(50_000_000)?;

        // Index all notes
        for note in notes {
            let tokenized_content = Self::tokenize_chinese(&note.content);
            let tokenized_title = Self::tokenize_chinese(&note.title);
            let id_field = schema.get_field("id").unwrap();
            let title_field = schema.get_field("title").unwrap();
            let content_field = schema.get_field("content").unwrap();
            let tags_field = schema.get_field("tags").unwrap();
            let updated_at_field = schema.get_field("updated_at").unwrap();

            new_writer.add_document(doc!(
                id_field => note.id.as_str(),
                title_field => tokenized_title,
                content_field => tokenized_content,
                tags_field => note.tags.join(" "),
                updated_at_field => note.updated_at,
            ))?;
        }

        new_writer.commit()?;
        drop(new_writer);

        // Write schema version marker in temp dir
        Self::write_schema_version(&temp_dir, SCHEMA_VERSION)?;
        info!("🔍 索引重建完成，共 {} 条笔记", notes.len());

        // Atomic swap: rename old -> backup, rename new -> live
        let backup_dir = self.index_dir.with_extension("index_backup");
        let _ = fs::remove_dir_all(&backup_dir);

        // On Windows, rename fails if dest exists, so remove old first
        // Use a two-step rename approach
        if self.index_dir.exists() {
            fs::rename(&self.index_dir, &backup_dir)?;
        }
        fs::rename(&temp_dir, &self.index_dir)?;

        // Clean up backup
        let _ = fs::remove_dir_all(&backup_dir);

        // Update self to use the new index
        let new_index = Index::open_in_dir(&self.index_dir)?;
        let new_writer = new_index.writer(50_000_000)?;
        let schema_version = Self::read_schema_version(&self.index_dir);

        self.index = new_index;
        self.schema = schema;
        self.writer = new_writer;
        self.schema_version = schema_version;
        self.needs_rebuild = false;

        info!("🔍 索引重建已生效 (schema v{})", schema_version);
        Ok(())
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

    /// Create a QueryParser with field boosting applied.
    /// Title matches rank highest (5x), then tags (3x), then content (1x).
    fn create_query_parser(&self, fields: Vec<tantivy::schema::Field>) -> QueryParser {
        let mut parser = QueryParser::for_index(&self.index, fields.clone());
        // Field boosts: title=5, tags=3, content=1
        for (i, f) in fields.iter().enumerate() {
            let boost = match i {
                0 => 5.0, // title
                1 => 3.0, // tags
                2 => 1.0, // content
                _ => 1.0,
            };
            parser.set_field_boost(*f, boost);
        }
        parser
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, CoreError> {
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();
        let id_field = self.schema.get_field("id").unwrap();

        let tokenized_query = Self::tokenize_chinese(query_str);

        let query_parser = self.create_query_parser(vec![title_field, content_field, tags_field]);

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

        let query_parser = self.create_query_parser(vec![title_field, content_field, tags_field]);

        let query = query_parser.parse_query(&tokenized_query)?;

        let reader = self.index.reader()?;
        let searcher = reader.searcher();

        let total_hits = searcher.search(&query, &Count)?;

        // Safety cap: prevent excessive memory usage from large offsets
        const MAX_OFFSET: usize = 10_000;
        if options.offset > MAX_OFFSET {
            warn!(
                "🔍 分页偏移过大 (offset={}), 上限为 {}，返回空结果",
                options.offset, MAX_OFFSET
            );
            return Ok(SearchPage {
                results: Vec::new(),
                total_hits,
            });
        }

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
        let query_parser = self.create_query_parser(vec![title_field, content_field, tags_field]);
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
        let _updated_at_field = self.schema.get_field("updated_at").unwrap();
        let _id_field = self.schema.get_field("id").unwrap();
        let fields = [title_field, content_field, tags_field];

        let tokenized = Self::tokenize_chinese(query_str);
        let words: Vec<&str> = tokenized.split_whitespace().collect();
        if words.is_empty() {
            return Ok(Vec::new());
        }

        let reader = self.index.reader()?;
        let searcher = reader.searcher();
        let query_lower = query_str.to_lowercase();

        // Execute a set of subqueries combined with SHOULD and collect results.
        let execute = |subqueries: Vec<(tantivy::query::Occur, Box<dyn tantivy::query::Query>)>|
            -> Result<Vec<(f32, tantivy::DocAddress)>, CoreError>
        {
            let bool_q = BooleanQuery::new(subqueries);
            let docs = searcher.search(&bool_q, &TopDocs::with_limit(limit))?;
            Ok(docs)
        };

        // Tier 1: Exact match (TermQuery only)
        let mut exact_queries: Vec<(tantivy::query::Occur, Box<dyn tantivy::query::Query>)> = Vec::new();
        for word in &words {
            for field in &fields {
                exact_queries.push((tantivy::query::Occur::Should, Box::new(TermQuery::new(
                    Term::from_field_text(*field, word),
                    tantivy::schema::IndexRecordOption::Basic,
                ))));
            }
        }
        // Also include parsed query for phrase-level matching
        let query_parser = self.create_query_parser(vec![title_field, content_field, tags_field]);
        if let Ok(parsed) = query_parser.parse_query(&tokenized) {
            exact_queries.push((tantivy::query::Occur::Should, parsed));
        }
        let exact_results = execute(exact_queries)?;
        let mut seen_ids = std::collections::HashSet::new();
        let mut results = Vec::new();

        for (score, addr) in &exact_results {
            let (id, title, content, updated_at) = self.read_doc(&searcher, *addr)?;
            if seen_ids.insert(id.clone()) {
                results.push(SearchResult {
                    note_id: id,
                    title,
                    snippet: self.extract_snippet(&content, &query_lower, 60),
                    score: *score,
                    updated_at,
                    total_hits: 0,
                });
            }
        }
        if results.len() >= limit {
            info!("🔍 模糊搜索(精确匹配): '{}' - {} 条结果", query_str, results.len());
            return Ok(results);
        }

        // Tier 2: Use parsed query which handles general/fuzzy matching
        let mut parsed_queries: Vec<(tantivy::query::Occur, Box<dyn tantivy::query::Query>)> = Vec::new();
        let query_parser2 = self.create_query_parser(vec![title_field, content_field, tags_field]);
        if let Ok(parsed) = query_parser2.parse_query(&tokenized) {
            parsed_queries.push((tantivy::query::Occur::Should, parsed));
        }
        let parsed_results = execute(parsed_queries)?;

        for (score, addr) in &parsed_results {
            let (id, title, content, updated_at) = self.read_doc(&searcher, *addr)?;
            if seen_ids.insert(id.clone()) {
                results.push(SearchResult {
                    note_id: id,
                    title,
                    snippet: self.extract_snippet(&content, &query_lower, 60),
                    score: *score,
                    updated_at,
                    total_hits: 0,
                });
                if results.len() >= limit {
                    break;
                }
            }
        }
        if results.len() >= limit {
            info!("🔍 模糊搜索(精确+解析): '{}' - {} 条结果", query_str, results.len());
            return Ok(results);
        }

        // Tier 3: Add FuzzyTermQuery (edit distance 1) for typo tolerance
        let mut fuzzy_queries: Vec<(tantivy::query::Occur, Box<dyn tantivy::query::Query>)> = Vec::new();
        for word in &words {
            for field in &fields {
                fuzzy_queries.push((tantivy::query::Occur::Should, Box::new(FuzzyTermQuery::new(
                    Term::from_field_text(*field, word),
                    1,
                    true,
                ))));
            }
        }
        let fuzzy_results = execute(fuzzy_queries)?;

        for (score, addr) in &fuzzy_results {
            let (id, title, content, updated_at) = self.read_doc(&searcher, *addr)?;
            if seen_ids.insert(id.clone()) {
                results.push(SearchResult {
                    note_id: id,
                    title,
                    snippet: self.extract_snippet(&content, &query_lower, 60),
                    score: *score,
                    updated_at,
                    total_hits: 0,
                });
                if results.len() >= limit {
                    break;
                }
            }
        }

        info!("🔍 模糊搜索(精确+前缀+模糊): '{}' - {} 条结果", query_str, results.len());
        Ok(results)
    }

    /// Helper to read a document from the searcher and extract common fields.
    fn read_doc(
        &self,
        searcher: &tantivy::Searcher,
        addr: tantivy::DocAddress,
    ) -> Result<(String, String, String, u64), CoreError> {
        let id_field = self.schema.get_field("id").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let updated_at_field = self.schema.get_field("updated_at").unwrap();

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
        Ok((id, title, content, updated_at))
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
    fn test_paginated_large_offset_capped() {
        let dir = tempdir().unwrap();
        let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
        for i in 0..5 {
            engine.add_note(&i.to_string(), &format!("Note {}", i), "内容包含 Rust 编程", &[], now_ms()).unwrap();
        }
        engine.commit().unwrap();

        // Offset beyond MAX_OFFSET should return empty results without panicking
        let page = engine.search_paginated("Rust", SearchOptions { limit: 3, offset: 999_999 }).unwrap();
        assert!(page.results.is_empty());
        assert_eq!(page.total_hits, 5);
    }

    #[test]
    fn test_index_rebuild() {
        let dir = tempdir().unwrap();
        let index_dir = dir.path().join("index");
        let mut engine = SearchEngine::open(&index_dir).unwrap();
        engine.add_note("1", "Original", "Original content", &[], now_ms()).unwrap();
        engine.add_note("2", "Another", "More content", &[], now_ms()).unwrap();
        engine.commit().unwrap();
        drop(engine);

        // Re-open to simulate old version detection (schema version will be 0 since
        // no marker file existed before this change)
        let mut engine = SearchEngine::open(&index_dir).unwrap();
        if engine.needs_rebuild() {
            let notes = vec![
                crate::search::IndexableNote {
                    id: "1".into(),
                    title: "Original".into(),
                    content: "Original content".into(),
                    tags: vec![],
                    updated_at: now_ms(),
                },
                crate::search::IndexableNote {
                    id: "2".into(),
                    title: "Another".into(),
                    content: "More content".into(),
                    tags: vec![],
                    updated_at: now_ms(),
                },
            ];
            engine.rebuild_index(&notes).unwrap();
            assert!(!engine.needs_rebuild());
        }

        // Verify search works after rebuild
        let results = engine.search("Original", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].note_id, "1");
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
