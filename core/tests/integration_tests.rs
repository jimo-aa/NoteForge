//! 集成测试：全文搜索和加密功能演示
//!
//! 这个文件演示如何使用 NoteForge 的全文搜索和加密功能

#[cfg(test)]
mod integration_tests {
    use noteforge_core::{
        storage::LocalStorage,
        search::SearchEngine,
        encryption::EncryptionManager,
        types::*,
    };
    use tempfile::tempdir;

    /// 演示：完整的笔记创建、加密、搜索流程
    #[test]
    fn test_complete_note_workflow() {
        // 初始化临时存储和搜索
        let dir = tempdir().unwrap();
        let mut storage = LocalStorage::open(dir.path().join("noteforge.db")).unwrap();
        let mut search = SearchEngine::open(dir.path().join("index")).unwrap();

        // 初始化加密
        let password = "secure_password_123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        
        let mut em = EncryptionManager::new();
        em.initialize(key);
        storage.set_encryption(em);

        // 创建笔记
        let note_req = CreateNoteRequest {
            title: "Rust 学习笔记".to_string(),
            content: "Rust 是一门现代的系统编程语言，强调安全性和性能。".to_string(),
            notebook_id: None,
            tags: vec!["Rust".to_string(), "编程".to_string()],
        };

        let note = storage.create_note(&note_req).unwrap();
        assert!(!note.meta.id.is_empty());

        // 为新笔记建立索引
        search.add_note(
            &note.meta.id,
            &note.meta.title,
            &note.content,
            &note.meta.tags,
            note.meta.updated_at,
        ).unwrap();

        // 搜索笔记
        let results = search.search("Rust", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].note_id, note.meta.id);

        // 验证加密：内容被加密存储
        // 注意：实际存储的是加密数据，但 get_note 会自动解密
        let retrieved = storage.get_note(&note.meta.id).unwrap();
        assert_eq!(retrieved.content, note.content);
    }

    /// 演示：Chinese tokenization（中文分词）
    #[test]
    fn test_chinese_search_workflow() {
        let dir = tempdir().unwrap();
        let mut search = SearchEngine::open(dir.path().join("index")).unwrap();

        // 创建包含中文内容的笔记
        let title = "机器学习基础";
        let content = "深入学习机器学习的核心概念，包括监督学习、无监督学习和强化学习";
        
        search.add_note(
            "note_1",
            title,
            content,
            &["AI".to_string(), "学习".to_string()],
            now_ms(),
        ).unwrap();

        // 搜索中文内容
        let results = search.search("机器学习", 10).unwrap();
        assert!(!results.is_empty());

        // 搜索分词后的单个词
        let results = search.search("学习", 10).unwrap();
        assert!(!results.is_empty());

        // 模糊搜索
        let results = search.search_fuzzy("学", 10).unwrap();
        assert!(!results.is_empty());
    }

    /// 演示：批量笔记加密和搜索
    #[test]
    fn test_batch_notes_with_search() {
        let dir = tempdir().unwrap();
        let mut search = SearchEngine::open(dir.path().join("index")).unwrap();

        // 创建多个笔记 - 直接使用 SearchEngine，不涉及加密
        let notes_data = vec![
            ("Rust 入门", "Rust 是一门安全的编程语言", vec!["Rust".to_string(), "编程".to_string()]),
            ("Python 指南", "Python 是一门通用的编程语言", vec!["Python".to_string(), "编程".to_string()]),
            ("JavaScript 基础", "JavaScript 在网页开发中广泛使用", vec!["JS".to_string(), "web".to_string()]),
        ];

        for (idx, (title, content, tags)) in notes_data.iter().enumerate() {
            search.add_note(
                &idx.to_string(),
                title,
                content,
                tags,
                now_ms(),
            ).unwrap();
        }

        // 搜索"编程" - 这会搜索到包含"编程"的笔记
        let results = search.search("编程", 20).unwrap();
        // 可能返回 1-2 条，取决于分词结果
        assert!(results.len() >= 1);

        // 搜索"Rust"
        let results = search.search("Rust", 20).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].title.contains("Rust"));
    }

    /// 演示：加密密钥隔离测试
    #[test]
    fn test_encryption_key_isolation() {
        let password1 = "password_alpha";
        let password2 = "password_beta";
        let salt = EncryptionManager::generate_salt();

        // 用第一个密码加密
        let key1 = EncryptionManager::derive_key_from_password(password1, &salt).unwrap();
        let mut em1 = EncryptionManager::new();
        em1.initialize(key1);

        let plaintext = "机密信息";
        let encrypted = em1.encrypt(plaintext).unwrap();

        // 尝试用第二个密码解密（应该失败）
        let key2 = EncryptionManager::derive_key_from_password(password2, &salt).unwrap();
        let mut em2 = EncryptionManager::new();
        em2.initialize(key2);

        let result = em2.decrypt(&encrypted);
        // 注意：由于 GCM 认证失败，解密会返回错误
        assert!(result.is_err() || result.unwrap() != plaintext);

        // 用正确的密码解密（应该成功）
        let decrypted = em1.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    /// 演示：笔记更新和搜索索引同步
    #[test]
    fn test_note_update_and_reindex() {
        let dir = tempdir().unwrap();
        let mut storage = LocalStorage::open(dir.path().join("noteforge.db")).unwrap();
        let mut search = SearchEngine::open(dir.path().join("index")).unwrap();

        // 初始化加密 - 使用生成的盐
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password("update_test", &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);
        storage.set_encryption(em);

        // 创建笔记
        let note_req = CreateNoteRequest {
            title: "初始标题".to_string(),
            content: "初始内容，讲述 Rust 编程".to_string(),
            notebook_id: None,
            tags: vec![],
        };

        let note = storage.create_note(&note_req).unwrap();
        search.add_note(
            &note.meta.id,
            &note.meta.title,
            &note.content,
            &note.meta.tags,
            note.meta.updated_at,
        ).unwrap();

        // 搜索初始内容
        let results = search.search("Rust", 10).unwrap();
        assert!(!results.is_empty());

        // 更新笔记
        let update_req = UpdateNoteRequest {
            title: Some("更新标题".to_string()),
            content: Some("更新内容，讲述 Python 编程".to_string()),
            notebook_id: None,
            tags: None,
            is_pinned: None,
            is_favorite: None,
        };

        let updated = storage.update_note(&note.meta.id, &update_req).unwrap();
        
        // 更新索引
        search.add_note(
            &updated.meta.id,
            &updated.meta.title,
            &updated.content,
            &updated.meta.tags,
            updated.meta.updated_at,
        ).unwrap();

        // 验证新搜索
        let results = search.search("Python", 10).unwrap();
        assert!(!results.is_empty());

        // 验证旧搜索不再返回此笔记
        let results = search.search("Rust", 10).unwrap();
        assert!(results.iter().all(|r| r.note_id != note.meta.id));
    }

    /// 演示：高级搜索功能
    #[test]
    fn test_advanced_search_features() {
        let dir = tempdir().unwrap();
        let mut search = SearchEngine::open(dir.path().join("index")).unwrap();

        // 添加测试数据
        search.add_note(
            "1",
            "Web 开发",
            "使用 JavaScript 和 React 进行前端开发",
            &["web".to_string(), "frontend".to_string()],
            now_ms(),
        ).unwrap();

        search.add_note(
            "2",
            "后端开发",
            "使用 Rust 和 Tauri 进行后端开发",
            &["backend".to_string(), "rust".to_string()],
            now_ms(),
        ).unwrap();

        // 基础搜索 - 中文分词可能返回多个结果
        let results = search.search("开发", 10).unwrap();
        assert!(results.len() >= 1);

        // 模糊搜索 - 搜索 JavaScript
        let results = search.search_fuzzy("JavaScript", 10).unwrap();
        assert!(results.len() >= 1);

        // 在特定笔记中搜索
        let results = search.search_in_note("1", "JavaScript", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].note_id, "1");
    }

    /// 演示：加密数据持久化
    #[test]
    fn test_encryption_persistence() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("noteforge.db");
        let salt = EncryptionManager::generate_salt();

        // 第一次：创建并加密笔记
        {
            let mut storage = LocalStorage::open(&db_path).unwrap();
            let key = EncryptionManager::derive_key_from_password("persist_pwd", &salt).unwrap();
            let mut em = EncryptionManager::new();
            em.initialize(key);
            storage.set_encryption(em);

            let note_req = CreateNoteRequest {
                title: "持久化测试".to_string(),
                content: "这是需要持久化的内容".to_string(),
                notebook_id: None,
                tags: vec![],
            };

            let _ = storage.create_note(&note_req).unwrap();
        } // 数据库和加密管理器被释放

        // 第二次：重新打开并验证数据
        {
            let mut storage = LocalStorage::open(&db_path).unwrap();
            let key = EncryptionManager::derive_key_from_password("persist_pwd", &salt).unwrap();
            let mut em = EncryptionManager::new();
            em.initialize(key);
            storage.set_encryption(em);

            let notes = storage.list_notes(None, 100, 0).unwrap();
            assert_eq!(notes.len(), 1);

            let note = storage.get_note(&notes[0].id).unwrap();
            assert_eq!(note.meta.title, "持久化测试");
            assert_eq!(note.content, "这是需要持久化的内容");
        }
    }
}
