//! NoteForge Core — 本地存储引擎
//!
//! 使用 SQLite 实现笔记、笔记本、标签的本地持久化存储。
//! 支持事务操作和批量写入。

use rusqlite::{Connection, params};
use std::path::Path;
use tracing::info;

use crate::types::{self, Note, NoteMeta, Notebook, Tag, CreateNoteRequest, UpdateNoteRequest};
use crate::encryption::EncryptionManager;

/// 本地存储引擎
pub struct LocalStorage {
    conn: Connection,
    encryption: Option<EncryptionManager>,
}

impl LocalStorage {
    /// 打开（或创建）SQLite 数据库
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(&path)?;
        let storage = Self { conn, encryption: None };
        storage.initialize_tables()?;
        info!("🗄️  本地存储已打开: {:?}", path.as_ref());
        Ok(storage)
    }

    /// 初始化加密管理器
    pub fn set_encryption(&mut self, encryption: EncryptionManager) {
        self.encryption = Some(encryption);
        info!("🔐 存储层已启用加密");
    }

    /// 检查是否启用了加密
    pub fn has_encryption(&self) -> bool {
        self.encryption.is_some()
    }

    /// 禁用加密
    pub fn clear_encryption(&mut self) {
        self.encryption = None;
        info!("🔓 存储层已禁用加密");
    }

    /// 初始化数据库表
    fn initialize_tables(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;

             CREATE TABLE IF NOT EXISTS notebooks (
                 id          TEXT PRIMARY KEY,
                 name        TEXT NOT NULL DEFAULT '未命名',
                 icon        TEXT NOT NULL DEFAULT '📁',
                 color       TEXT NOT NULL DEFAULT '#6366f1',
                 parent_id   TEXT REFERENCES notebooks(id),
                 sort_order  INTEGER NOT NULL DEFAULT 0,
                 created_at  INTEGER NOT NULL,
                 updated_at  INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS notes (
                 id             TEXT PRIMARY KEY,
                 notebook_id    TEXT NOT NULL DEFAULT 'default' REFERENCES notebooks(id) ON DELETE SET NULL,
                 title          TEXT NOT NULL DEFAULT '',
                 content        TEXT NOT NULL DEFAULT '',
                 content_plain  TEXT NOT NULL DEFAULT '',
                 is_pinned      INTEGER NOT NULL DEFAULT 0,
                 is_favorite    INTEGER NOT NULL DEFAULT 0,
                 word_count     INTEGER NOT NULL DEFAULT 0,
                 version        INTEGER NOT NULL DEFAULT 1,
                 created_at     INTEGER NOT NULL,
                 updated_at     INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS tags (
                 id     TEXT PRIMARY KEY,
                 name   TEXT NOT NULL UNIQUE,
                 color  TEXT NOT NULL DEFAULT '#6366f1'
             );

             CREATE TABLE IF NOT EXISTS note_tags (
                 note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                 tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                 PRIMARY KEY (note_id, tag_id)
             );

             CREATE TABLE IF NOT EXISTS note_links (
                 source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                 target    TEXT NOT NULL,
                 PRIMARY KEY (source_id, target)
             );
             "
        )?;

        self.ensure_note_columns()?;
        self.ensure_indexes()?;
        Ok(())
    }

    fn ensure_indexes(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare("PRAGMA table_info(notes)")?;
        let existing = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        if !existing.iter().any(|c| c == "is_deleted") {
            return Ok(());
        }
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id) WHERE is_deleted = 0", [])?;
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC)", [])?;
        Ok(())
    }

    fn ensure_note_columns(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare("PRAGMA table_info(notes)")?;
        let existing = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;

        if !existing.iter().any(|c| c == "is_deleted") {
            self.conn.execute("ALTER TABLE notes ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0", [])?;
        }
        if !existing.iter().any(|c| c == "content_plain") {
            self.conn.execute("ALTER TABLE notes ADD COLUMN content_plain TEXT NOT NULL DEFAULT ''", [])?;
        }
        if !existing.iter().any(|c| c == "word_count") {
            self.conn.execute("ALTER TABLE notes ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0", [])?;
        }
        if !existing.iter().any(|c| c == "version") {
            self.conn.execute("ALTER TABLE notes ADD COLUMN version INTEGER NOT NULL DEFAULT 1", [])?;
        }
        
        // Ensure notebooks table has required columns
        let mut stmt = self.conn.prepare("PRAGMA table_info(notebooks)")?;
        let notebook_cols = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        
        if !notebook_cols.iter().any(|c| c == "color") {
            self.conn.execute("ALTER TABLE notebooks ADD COLUMN color TEXT NOT NULL DEFAULT '#6366f1'", [])?;
        }
        if !notebook_cols.iter().any(|c| c == "created_at") {
            self.conn.execute("ALTER TABLE notebooks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0", [])?;
        }
        if !notebook_cols.iter().any(|c| c == "updated_at") {
            self.conn.execute("ALTER TABLE notebooks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0", [])?;
        }
        
        // Ensure default notebook exists
        self.conn.execute(
            "INSERT OR IGNORE INTO notebooks (id, name, icon, created_at, updated_at) 
             VALUES ('default', '未分类', '📋', 0, 0)",
            []
        )?;
        
        Ok(())
    }

    // ============================================================
    // 笔记本 CRUD
    // ============================================================

    pub fn create_notebook(&self, name: &str, icon: Option<&str>, color: Option<&str>) -> Result<Notebook, Box<dyn std::error::Error>> {
        let id = types::generate_id();
        let now = types::now_ms();
        let icon_val = icon.unwrap_or("📓");
        let color_val = color.unwrap_or("#6366f1");
        self.conn.execute(
            "INSERT INTO notebooks (id, name, icon, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, icon_val, color_val, now, now],
        )?;
        self.get_notebook(&id)
    }

    pub fn get_notebook(&self, id: &str) -> Result<Notebook, Box<dyn std::error::Error>> {
        self.conn.query_row(
            "SELECT n.id, n.name, n.icon, n.color, COUNT(nt.id) as note_count, n.created_at, n.updated_at
             FROM notebooks n
             LEFT JOIN notes nt ON nt.notebook_id = n.id AND nt.is_deleted = 0
             WHERE n.id = ?1
             GROUP BY n.id",
            params![id],
            |row| {
                Ok(Notebook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    icon: row.get(2)?,
                    color: row.get::<_, String>(3)?,
                    parent_id: None,
                    sort_order: 0,
                    note_count: row.get::<_, i64>(4)? as u32,
                    created_at: row.get::<_, i64>(5)? as u64,
                    updated_at: row.get::<_, i64>(6)? as u64,
                })
            },
        ).map_err(|e| e.into())
    }

    pub fn list_notebooks(&self) -> Result<Vec<Notebook>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT n.id, n.name, n.icon, n.color, COUNT(nt.id) as note_count, n.created_at, n.updated_at
             FROM notebooks n
             LEFT JOIN notes nt ON nt.notebook_id = n.id AND nt.is_deleted = 0
             GROUP BY n.id
             ORDER BY n.created_at ASC"
        )?;

        let notebooks = stmt.query_map([], |row| {
            Ok(Notebook {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get::<_, String>(3)?,
                parent_id: None,
                sort_order: 0,
                note_count: row.get::<_, i64>(4)? as u32,
                created_at: row.get::<_, i64>(5)? as u64,
                updated_at: row.get::<_, i64>(6)? as u64,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(notebooks)
    }

    pub fn rename_notebook(&self, id: &str, name: &str) -> Result<Notebook, Box<dyn std::error::Error>> {
        let now = types::now_ms();
        self.conn.execute(
            "UPDATE notebooks SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id],
        )?;
        self.get_notebook(id)
    }

    pub fn delete_notebook(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.conn.execute(
            "DELETE FROM notebooks WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    // ============================================================
    // 加密辅助函数
    // ============================================================

    fn encrypt_content(&self, content: &str) -> Result<String, Box<dyn std::error::Error>> {
        if let Some(ref em) = self.encryption {
            em.encrypt(content).map_err(|e| format!("加密失败: {}", e).into())
        } else {
            Ok(content.to_string())
        }
    }

    fn decrypt_content(&self, encrypted: &str) -> Result<String, Box<dyn std::error::Error>> {
        if let Some(ref em) = self.encryption {
            em.decrypt(encrypted).map_err(|e| format!("解密失败: {}", e).into())
        } else {
            Ok(encrypted.to_string())
        }
    }

    // ============================================================
    // 笔记 CRUD
    // ============================================================

    pub fn create_note(&self, req: &CreateNoteRequest) -> Result<Note, Box<dyn std::error::Error>> {
        let id = types::generate_id();
        let now = types::now_ms();
        let plain = crate::md_engine::MarkdownEngine::extract_plain_text(&req.content);
        let wc = crate::md_engine::MarkdownEngine::count_words(&req.content);

        // 处理 notebook_id：如果为空则使用 'default'
        let notebook_id = req.notebook_id.as_deref().unwrap_or("default");

        // 加密笔记内容
        let encrypted_content = self.encrypt_content(&req.content)?;

        self.conn.execute(
            "INSERT INTO notes (id, notebook_id, title, content, content_plain,
                                word_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, notebook_id, req.title, encrypted_content, plain, wc, now, now],
        )?;

        // 处理标签
        for tag_name in &req.tags {
            self.ensure_tag(tag_name)?;
            let tag = self.get_tag_by_name(tag_name)?;
            self.conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
                params![id, tag.id],
            )?;
        }

        // 提取并存储 Wiki Link
        let links = crate::md_engine::MarkdownEngine::extract_wiki_links(&req.content);
        for link in &links {
            self.conn.execute(
                "INSERT OR IGNORE INTO note_links (source_id, target) VALUES (?1, ?2)",
                params![id, link],
            )?;
        }

        self.get_note(&id)
    }

    pub fn get_note(&self, id: &str) -> Result<Note, Box<dyn std::error::Error>> {
        let note = self.conn.query_row(
            "SELECT id, notebook_id, title, content, content_plain, is_pinned,
                    is_favorite, word_count, version, created_at, updated_at
             FROM notes WHERE id = ?1 AND is_deleted = 0",
            params![id],
            |row| {
                let meta = NoteMeta {
                    id: row.get(0)?,
                    title: row.get(2)?,
                    notebook_id: row.get(1)?,
                    tags: Vec::new(),  // 后面再查
                    is_pinned: row.get::<_, i32>(5)? != 0,
                    is_favorite: row.get::<_, i32>(6)? != 0,
                    word_count: row.get::<_, i32>(7)? as u32,
                    version: row.get::<_, i32>(8)? as u32,
                    created_at: row.get::<_, i64>(9)? as u64,
                    updated_at: row.get::<_, i64>(10)? as u64,
                };
                Ok(Note {
                    meta,
                    content: row.get(3)?,
                    content_plain: row.get(4)?,
                })
            },
        )?;

        // 解密内容
        let decrypted_content = self.decrypt_content(&note.content)?;

        Ok(Note {
            meta: note.meta,
            content: decrypted_content,
            content_plain: note.content_plain,
        })
    }

    pub fn get_notes_batch(&self, ids: &[&str]) -> Result<Vec<Note>, Box<dyn std::error::Error>> {
        if ids.is_empty() { return Ok(Vec::new()); }
        let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "SELECT id, notebook_id, title, content, content_plain, is_pinned,
                    is_favorite, word_count, version, created_at, updated_at
             FROM notes WHERE id IN ({}) AND is_deleted = 0",
            placeholders.join(",")
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<String> = ids.iter().map(|id| id.to_string()).collect();
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i32>(5)?,
                row.get::<_, i32>(6)?,
                row.get::<_, i32>(7)?,
                row.get::<_, i32>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, i64>(10)?,
            ))
        })?.collect::<Result<Vec<_>, _>>()?;
        let mut notes = Vec::with_capacity(rows.len());
        for (id, notebook_id, title, content, content_plain, is_pinned, is_favorite, word_count, version, created_at, updated_at) in rows {
            let decrypted = self.decrypt_content(&content)?;
            notes.push(Note {
                meta: NoteMeta {
                    id,
                    title,
                    notebook_id: Some(notebook_id),
                    tags: Vec::new(),
                    is_pinned: is_pinned != 0,
                    is_favorite: is_favorite != 0,
                    word_count: word_count as u32,
                    version: version as u32,
                    created_at: created_at as u64,
                    updated_at: updated_at as u64,
                },
                content: decrypted,
                content_plain,
            });
        }
        Ok(notes)
    }

    pub fn update_note(
        &self,
        id: &str,
        req: &UpdateNoteRequest,
    ) -> Result<Note, Box<dyn std::error::Error>> {
        let mut fields = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(title) = &req.title {
            fields.push("title = ?");
            values.push(Box::new(title.clone()));
        }
        if let Some(content) = &req.content {
            fields.push("content = ?");
            fields.push("content_plain = ?");
            fields.push("word_count = ?");
            let plain = crate::md_engine::MarkdownEngine::extract_plain_text(content);
            let wc = crate::md_engine::MarkdownEngine::count_words(content);
            
            // 加密内容
            let encrypted = self.encrypt_content(content)?;
            
            values.push(Box::new(encrypted));
            values.push(Box::new(plain));
            values.push(Box::new(wc as i32));
        }
        if let Some(pinned) = req.is_pinned {
            fields.push("is_pinned = ?");
            values.push(Box::new(pinned as i32));
        }
        if let Some(fav) = req.is_favorite {
            fields.push("is_favorite = ?");
            values.push(Box::new(fav as i32));
        }

        if fields.is_empty() {
            return self.get_note(id);
        }

        fields.push("version = version + 1");
        fields.push("updated_at = ?");
        values.push(Box::new(types::now_ms() as i64));
        values.push(Box::new(id.to_string()));

        let sql = format!(
            "UPDATE notes SET {} WHERE id = ?",
            fields.join(", ")
        );

        self.conn.execute(&sql, rusqlite::params_from_iter(values.iter().map(|v| v.as_ref())))?;

        self.get_note(id)
    }

    pub fn delete_note(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let now = types::now_ms();
        self.conn.execute(
            "UPDATE notes SET is_deleted = 1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn list_notes(
        &self,
        notebook_id: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<NoteMeta>, Box<dyn std::error::Error>> {
        let (where_clause, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) =
            if let Some(nbid) = notebook_id {
                ("WHERE is_deleted = 0 AND notebook_id = ?".into(),
                 vec![Box::new(nbid.to_string())])
            } else {
                ("WHERE is_deleted = 0".into(), vec![])
            };

        let sql = format!(
            "SELECT id, notebook_id, title, is_pinned, is_favorite,
                    word_count, version, created_at, updated_at
             FROM notes {}
             ORDER BY is_pinned DESC, updated_at DESC
             LIMIT ? OFFSET ?",
            where_clause
        );

        let mut stmt = self.conn.prepare(&sql)?;

        let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = params_vec;
        all_params.push(Box::new(limit as i64));
        all_params.push(Box::new(offset as i64));

        let metas = stmt.query_map(
            rusqlite::params_from_iter(all_params.iter().map(|v| v.as_ref())),
            |row| {
                Ok(NoteMeta {
                    id: row.get(0)?,
                    title: row.get(2)?,
                    notebook_id: row.get(1)?,
                    tags: Vec::new(),
                    is_pinned: row.get::<_, i32>(3)? != 0,
                    is_favorite: row.get::<_, i32>(4)? != 0,
                    word_count: row.get::<_, i32>(5)? as u32,
                    version: row.get::<_, i32>(6)? as u32,
                    created_at: row.get::<_, i64>(7)? as u64,
                    updated_at: row.get::<_, i64>(8)? as u64,
                })
            },
        )?.collect::<Result<Vec<_>, _>>()?;

        Ok(metas)
    }

    // ============================================================
    // 标签
    // ============================================================

    fn ensure_tag(&self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (id, name) VALUES (?1, ?2)",
            params![types::generate_id(), name],
        )?;
        Ok(())
    }

    fn get_tag_by_name(&self, name: &str) -> Result<Tag, Box<dyn std::error::Error>> {
        self.conn.query_row(
            "SELECT id, name, color FROM tags WHERE name = ?1",
            params![name],
            |row| Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                note_count: 0,
            }),
        ).map_err(|e| e.into())
    }

    pub fn list_tags(&self) -> Result<Vec<Tag>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.name, t.color, COUNT(nt.note_id) as note_count
             FROM tags t
             LEFT JOIN note_tags nt ON nt.tag_id = t.id
             GROUP BY t.id
             ORDER BY note_count DESC"
        )?;

        let tags = stmt.query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                note_count: row.get::<_, i64>(3)? as u32,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(tags)
    }
}
