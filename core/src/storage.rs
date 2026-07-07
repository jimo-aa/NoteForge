//! NoteForge Core — 本地存储引擎
//!
//! 使用 SQLite 实现笔记、笔记本、标签的本地持久化存储。
//! 支持事务操作和批量写入。

use rusqlite::{Connection, params};
use std::path::Path;
use tracing::info;

use crate::types::{self, Note, NoteMeta, Notebook, Tag, CreateNoteRequest, UpdateNoteRequest, SyncQueueItem, BacklinkEntry, NoteSnapshot};
use crate::encryption::EncryptionManager;
use crate::error::CoreError;

/// 本地存储引擎
pub struct LocalStorage {
    conn: Connection,
    encryption: Option<EncryptionManager>,
}

impl LocalStorage {
    /// 打开（或创建）SQLite 数据库
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, CoreError> {
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

    // ============================================================
    // 加密元数据持久化
    // ============================================================

    /// 存储加密盐值到数据库
    pub fn store_encryption_salt(&self, salt: &str) -> Result<(), CoreError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO encryption_meta (key, value) VALUES ('encryption_salt', ?1)",
            params![salt],
        )?;
        info!("🔐 加密盐值已持久化存储");
        Ok(())
    }

    /// 获取存储的加密盐值
    pub fn get_encryption_salt(&self) -> Result<Option<String>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT value FROM encryption_meta WHERE key = 'encryption_salt'"
        )?;
        let result = stmt.query_row([], |row| row.get::<_, String>(0)).ok();
        Ok(result)
    }

    /// 检查数据库中是否存在加密盐值
    pub fn has_encryption_salt(&self) -> Result<bool, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT COUNT(*) FROM encryption_meta WHERE key = 'encryption_salt'"
        )?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count > 0)
    }

    /// 清除所有加密元数据
    pub fn clear_encryption_metadata(&self) -> Result<(), CoreError> {
        self.conn.execute(
            "DELETE FROM encryption_meta WHERE key = 'encryption_salt'",
            [],
        )?;
        info!("🔓 加密元数据已清除");
        Ok(())
    }

    /// 初始化数据库表
    fn initialize_tables(&self) -> Result<(), CoreError> {
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

             CREATE TABLE IF NOT EXISTS encryption_meta (
                 key   TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );

             CREATE TABLE IF NOT EXISTS sync_queue (
                 id         TEXT PRIMARY KEY,
                 note_id    TEXT NOT NULL,
                 operation  TEXT NOT NULL,
                 payload    TEXT NOT NULL,
                 created_at INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS note_snapshots (
                 id             TEXT PRIMARY KEY,
                 note_id        TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                 version_number INTEGER NOT NULL,
                 title          TEXT NOT NULL DEFAULT '',
                 description    TEXT NOT NULL DEFAULT '',
                 content        TEXT NOT NULL DEFAULT '',
                 content_plain  TEXT NOT NULL DEFAULT '',
                 word_count     INTEGER NOT NULL DEFAULT 0,
                 is_auto_save   INTEGER NOT NULL DEFAULT 0,
                 created_at     INTEGER NOT NULL
             );
             "
        )?;

        self.ensure_note_columns()?;
        self.ensure_indexes()?;
        self.ensure_snapshot_indexes()?;
        Ok(())
    }

    fn ensure_indexes(&self) -> Result<(), CoreError> {
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

    fn ensure_snapshot_indexes(&self) -> Result<(), CoreError> {
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_note ON note_snapshots(note_id, version_number DESC)", [])?;
        Ok(())
    }

    fn ensure_note_columns(&self) -> Result<(), CoreError> {
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

    pub fn create_notebook(&self, name: &str, icon: Option<&str>, color: Option<&str>) -> Result<Notebook, CoreError> {
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

    pub fn get_notebook(&self, id: &str) -> Result<Notebook, CoreError> {
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

    pub fn list_notebooks(&self) -> Result<Vec<Notebook>, CoreError> {
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

    pub fn rename_notebook(&self, id: &str, name: &str) -> Result<Notebook, CoreError> {
        let now = types::now_ms();
        self.conn.execute(
            "UPDATE notebooks SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, now, id],
        )?;
        self.get_notebook(id)
    }

    pub fn delete_notebook(&self, id: &str) -> Result<(), CoreError> {
        self.conn.execute(
            "DELETE FROM notebooks WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    // ============================================================
    // 加密辅助函数
    // ============================================================

    fn encrypt_content(&self, content: &str) -> Result<String, CoreError> {
        if let Some(ref em) = self.encryption {
            em.encrypt(content).map_err(|e| format!("加密失败: {}", e).into())
        } else {
            Ok(content.to_string())
        }
    }

    fn decrypt_content(&self, encrypted: &str) -> Result<String, CoreError> {
        if let Some(ref em) = self.encryption {
            em.decrypt(encrypted).map_err(|e| format!("解密失败: {}", e).into())
        } else {
            Ok(encrypted.to_string())
        }
    }

    // ============================================================
    // 笔记 CRUD
    // ============================================================

    pub fn create_note(&self, req: &CreateNoteRequest) -> Result<Note, CoreError> {
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

    pub fn get_note(&self, id: &str) -> Result<Note, CoreError> {
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

    pub fn get_notes_batch(&self, ids: &[&str]) -> Result<Vec<Note>, CoreError> {
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
    ) -> Result<Note, CoreError> {
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

    pub fn delete_note(&self, id: &str) -> Result<(), CoreError> {
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
    ) -> Result<Vec<NoteMeta>, CoreError> {
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
    // 同步队列持久化
    // ============================================================

    pub fn enqueue_sync_change(&self, note_id: &str, operation: &str, payload: &str) -> Result<(), CoreError> {
        let id = types::generate_id();
        let now = types::now_ms() as i64;
        self.conn.execute(
            "INSERT INTO sync_queue (id, note_id, operation, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, note_id, operation, payload, now],
        )?;
        Ok(())
    }

    pub fn get_pending_sync_changes(&self) -> Result<Vec<SyncQueueItem>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, note_id, operation, payload, created_at FROM sync_queue ORDER BY created_at ASC"
        )?;
        let items = stmt.query_map([], |row| {
            Ok(SyncQueueItem {
                id: row.get(0)?,
                note_id: row.get(1)?,
                operation: row.get(2)?,
                payload: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    pub fn count_pending_sync_changes(&self) -> Result<i64, CoreError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM sync_queue", [], |row| row.get(0)
        )?;
        Ok(count)
    }

    pub fn remove_sync_changes(&self, ids: &[&str]) -> Result<(), CoreError> {
        if ids.is_empty() { return Ok(()); }
        let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!("DELETE FROM sync_queue WHERE id IN ({})", placeholders.join(","));
        let params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
        self.conn.execute(&sql, params.as_slice())?;
        Ok(())
    }

    pub fn clear_sync_queue(&self) -> Result<(), CoreError> {
        self.conn.execute("DELETE FROM sync_queue", [])?;
        Ok(())
    }

    // ============================================================
    // Wiki Link 反向链接
    // ============================================================

    /// 获取链接到指定笔记标题的反向链接（哪些笔记引用了此标题）
    pub fn get_backlinks(&self, title: &str) -> Result<Vec<String>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT source_id FROM note_links WHERE target = ?1"
        )?;
        let source_ids: Vec<String> = stmt.query_map(
            params![title],
            |row| row.get::<_, String>(0),
        )?.collect::<Result<Vec<_>, _>>()?;
        Ok(source_ids)
    }

    /// 获取指定笔记发出的所有 Wiki Link 目标
    pub fn get_note_outgoing_links(&self, note_id: &str) -> Result<Vec<String>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT target FROM note_links WHERE source_id = ?1"
        )?;
        let targets: Vec<String> = stmt.query_map(
            params![note_id],
            |row| row.get::<_, String>(0),
        )?.collect::<Result<Vec<_>, _>>()?;
        Ok(targets)
    }

    // ============================================================
    // 版本快照 (NoteSnapshot) — 替代旧的 git + milestone 体系
    // ============================================================

    /// 创建手动版本快照（用户主动保存的版本）
    pub fn create_manual_snapshot(&self, note_id: &str, title: &str, description: &str) -> Result<NoteSnapshot, CoreError> {
        let note = self.get_note(note_id)?;
        let id = types::generate_id();
        let now = types::now_ms();
        let next_version = self.next_snapshot_version(note_id)?;

        let content_encrypted = self.encrypt_content(&note.content)?;

        self.conn.execute(
            "INSERT INTO note_snapshots (id, note_id, version_number, title, description, content, content_plain, word_count, is_auto_save, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)",
            params![id, note_id, next_version, title, description, content_encrypted, note.content_plain, note.meta.word_count as i32, now],
        )?;

        self.get_snapshot(&id)
    }

    /// 自动创建版本快照（编辑保存时触发）
    /// 如果离上一个自动快照不足 AUTO_SNAPSHOT_INTERVAL_MS，则跳过。
    pub fn create_auto_snapshot(&self, note_id: &str, content: &str, content_plain: &str, word_count: u32) -> Result<Option<NoteSnapshot>, CoreError> {
        // Check minimum interval: don't create auto-snapshots more than once per 5 minutes
        const MIN_INTERVAL_MS: u64 = 5 * 60 * 1000;
        
        if let Ok(Some(last_time)) = self.last_auto_snapshot_time(note_id) {
            let elapsed = types::now_ms().saturating_sub(last_time);
            if elapsed < MIN_INTERVAL_MS {
                return Ok(None); // Skip — too soon
            }
        }

        let id = types::generate_id();
        let now = types::now_ms();
        let next_version = self.next_snapshot_version(note_id)?;
        let title = format!("自动保存 #{}", next_version);

        let content_encrypted = self.encrypt_content(content)?;

        self.conn.execute(
            "INSERT INTO note_snapshots (id, note_id, version_number, title, description, content, content_plain, word_count, is_auto_save, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9)",
            params![id, note_id, next_version, title, "", content_encrypted, content_plain, word_count as i32, now],
        )?;

        self.get_snapshot(&id).map(Some)
    }

    /// 获取最近一次自动快照的时间戳
    fn last_auto_snapshot_time(&self, note_id: &str) -> Result<Option<u64>, CoreError> {
        let result: Result<Option<i64>, _> = self.conn.query_row(
            "SELECT MAX(created_at) FROM note_snapshots WHERE note_id = ?1 AND is_auto_save = 1",
            params![note_id],
            |row| row.get(0),
        );
        Ok(result.ok().flatten().map(|v| v as u64))
    }

    /// 列出笔记的所有快照（最新在前）
    pub fn list_snapshots(&self, note_id: &str) -> Result<Vec<NoteSnapshot>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, note_id, version_number, title, description, content, content_plain, word_count, is_auto_save, created_at
             FROM note_snapshots WHERE note_id = ?1
             ORDER BY version_number DESC"
        )?;
        let snapshots = stmt.query_map(params![note_id], |row| {
            Ok(NoteSnapshot {
                id: row.get(0)?,
                note_id: row.get(1)?,
                version_number: row.get::<_, i32>(2)? as u32,
                title: row.get(3)?,
                description: row.get(4)?,
                content: row.get(5)?,
                content_plain: row.get(6)?,
                word_count: row.get::<_, i32>(7)? as u32,
                is_auto_save: row.get::<_, i32>(8)? != 0,
                created_at: row.get::<_, i64>(9)? as u64,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        // Decrypt content for each snapshot
        let mut result = Vec::with_capacity(snapshots.len());
        for mut s in snapshots {
            s.content = self.decrypt_content(&s.content)?;
            result.push(s);
        }
        Ok(result)
    }

    /// 获取单个快照
    pub fn get_snapshot(&self, id: &str) -> Result<NoteSnapshot, CoreError> {
        let mut snapshot = self.conn.query_row(
            "SELECT id, note_id, version_number, title, description, content, content_plain, word_count, is_auto_save, created_at
             FROM note_snapshots WHERE id = ?1",
            params![id],
            |row| {
                Ok(NoteSnapshot {
                    id: row.get(0)?,
                    note_id: row.get(1)?,
                    version_number: row.get::<_, i32>(2)? as u32,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    content: row.get(5)?,
                    content_plain: row.get(6)?,
                    word_count: row.get::<_, i32>(7)? as u32,
                    is_auto_save: row.get::<_, i32>(8)? != 0,
                    created_at: row.get::<_, i64>(9)? as u64,
                })
            },
        )?;
        snapshot.content = self.decrypt_content(&snapshot.content)?;
        Ok(snapshot)
    }

    /// 获取最新快照版本号 + 1（用于插入）
    fn next_snapshot_version(&self, note_id: &str) -> Result<u32, CoreError> {
        let max: Option<i32> = self.conn.query_row(
            "SELECT MAX(version_number) FROM note_snapshots WHERE note_id = ?1",
            params![note_id],
            |row| row.get(0),
        ).ok().flatten();
        Ok(max.map(|v| v as u32 + 1).unwrap_or(1))
    }

    /// 删除快照
    pub fn delete_snapshot(&self, id: &str) -> Result<bool, CoreError> {
        let affected = self.conn.execute(
            "DELETE FROM note_snapshots WHERE id = ?1",
            params![id],
        )?;
        Ok(affected > 0)
    }

    /// 标记快照（给自动快照添加名称/描述）
    pub fn tag_snapshot(&self, id: &str, title: &str, description: &str) -> Result<NoteSnapshot, CoreError> {
        self.conn.execute(
            "UPDATE note_snapshots SET title = ?1, description = ?2 WHERE id = ?3",
            params![title, description, id],
        )?;
        self.get_snapshot(id)
    }

    /// 获取笔记的快照数量
    pub fn count_snapshots(&self, note_id: &str) -> Result<u32, CoreError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM note_snapshots WHERE note_id = ?1",
            params![note_id],
            |row| row.get(0),
        )?;
        Ok(count as u32)
    }

    /// 获取指定数量的最近快照摘要（预览用）
    pub fn list_snapshot_summaries(&self, note_id: &str, limit: u32) -> Result<Vec<NoteSnapshot>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, note_id, version_number, title, description, '', content_plain, word_count, is_auto_save, created_at
             FROM note_snapshots WHERE note_id = ?1
             ORDER BY version_number DESC
             LIMIT ?2"
        )?;
        let snapshots = stmt.query_map(params![note_id, limit as i32], |row| {
            Ok(NoteSnapshot {
                id: row.get(0)?,
                note_id: row.get(1)?,
                version_number: row.get::<_, i32>(2)? as u32,
                title: row.get(3)?,
                description: row.get(4)?,
                content: String::new(),  // 摘要不加载内容
                content_plain: row.get(5)?,
                word_count: row.get::<_, i32>(7)? as u32,
                is_auto_save: row.get::<_, i32>(8)? != 0,
                created_at: row.get::<_, i64>(9)? as u64,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(snapshots)
    }

    /// 获取笔记的反向链接（包含源笔记的标题）
    pub fn get_backlinks_with_titles(&self, note_id: &str) -> Result<Vec<BacklinkEntry>, CoreError> {
        let mut stmt = self.conn.prepare(
            "SELECT n.id, n.title FROM note_links nl
             JOIN notes n ON n.id = nl.source_id AND n.is_deleted = 0
             WHERE nl.target = (SELECT title FROM notes WHERE id = ?1 AND is_deleted = 0)"
        )?;
        let entries = stmt.query_map(
            params![note_id],
            |row| {
                Ok(BacklinkEntry {
                    source_id: row.get(0)?,
                    source_title: row.get(1)?,
                })
            },
        )?.collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    // ============================================================
    // 标签
    // ============================================================

    fn ensure_tag(&self, name: &str) -> Result<(), CoreError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (id, name) VALUES (?1, ?2)",
            params![types::generate_id(), name],
        )?;
        Ok(())
    }

    fn get_tag_by_name(&self, name: &str) -> Result<Tag, CoreError> {
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

    pub fn list_tags(&self) -> Result<Vec<Tag>, CoreError> {
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
