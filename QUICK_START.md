# NoteForge 快速参考

## 🎯 快速开始

### 后端初始化

```rust
// 1. 创建存储和搜索
let mut storage = LocalStorage::open("noteforge.db")?;
let mut search = SearchEngine::open("index")?;

// 2. 初始化加密（可选）
let salt = EncryptionManager::generate_salt();
let key = EncryptionManager::derive_key_from_password("password", &salt)?;
let mut em = EncryptionManager::new();
em.initialize(key);
storage.set_encryption(em);

// 3. 保存 salt 供后续使用
// store_salt(salt);
```

### 前端集成

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// 搜索
const results = await invoke('search_notes', { query: 'keyword' });

// 初始化加密
const salt = await invoke('init_encryption', { password: 'pwd' });
```

---

## 🔍 搜索 API

### 搜索方法

| 方法 | 用途 | 返回 |
|------|------|------|
| `search(query, limit)` | 基础搜索 | `Vec<SearchResult>` |
| `search_fuzzy(query, limit)` | 模糊搜索 | `Vec<SearchResult>` |
| `search_in_note(id, query, limit)` | 笔记内搜索 | `Vec<SearchResult>` |

### 搜索结果

```rust
SearchResult {
    note_id: String,        // 笔记 ID
    title: String,          // 标题
    snippet: String,        // 摘要
    score: f32,             // 相关性
    updated_at: u64,        // 更新时间
}
```

---

## 🔐 加密 API

### EncryptionManager

```rust
// 创建实例
let mut em = EncryptionManager::new();

// 初始化
em.initialize(key);

// 加密
let encrypted = em.encrypt("content")?;

// 解密
let plain = em.decrypt(&encrypted)?;

// 批量操作
let encrypted_batch = em.encrypt_batch(vec!["text1", "text2"])?;
let decrypted_batch = em.decrypt_batch(encrypted_batch)?;
```

### 密钥派生

```rust
// 生成盐值
let salt = EncryptionManager::generate_salt();

// 派生密钥
let key = EncryptionManager::derive_key_from_password("password", &salt)?;
```

---

## 📊 常用 Tauri 命令

| 命令 | 参数 | 返回值 |
|------|------|--------|
| `search_notes` | `query: String` | `Vec<SearchResult>` |
| `search_notes_fuzzy` | `query: String` | `Vec<SearchResult>` |
| `search_in_note` | `noteId, query` | `Vec<SearchResult>` |
| `search_notes_advanced` | `query, limit, offset` | `Vec<SearchResult>` |
| `init_encryption` | `password: String` | `String` (salt) |
| `is_encryption_enabled` | - | `bool` |
| `disable_encryption` | - | `()` |

---

## ⚡ 性能提示

### 搜索优化
- 限制搜索结果数量（默认 50）
- 使用模糊搜索前验证用户输入
- 定期重建索引以保持性能

### 加密优化
- 批量操作时使用 `encrypt_batch()`
- 密钥派生是计算密集的，缓存结果
- 避免频繁初始化新的加密管理器

---

## 🐛 故障排查

### 搜索问题

```rust
// 问题：搜索没有返回结果
// 解决：确保笔记已添加到索引
search.add_note(&id, &title, &content, &tags, updated_at)?;

// 问题：中文搜索失败
// 解决：检查 jieba-rs 是否正确初始化
```

### 加密问题

```rust
// 问题：解密失败
// 解决：验证密钥和盐值是否匹配
// let key = EncryptionManager::derive_key_from_password(password, &salt)?;

// 问题：加密很慢
// 解决：Argon2 KDF 需要时间，这是正常的
```

---

## 📝 示例代码

### 完整工作流

```rust
use noteforge_core::{
    storage::LocalStorage,
    search::SearchEngine,
    encryption::EncryptionManager,
    types::*,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化存储和搜索
    let mut storage = LocalStorage::open("noteforge.db")?;
    let mut search = SearchEngine::open("index")?;

    // 初始化加密
    let salt = EncryptionManager::generate_salt();
    let key = EncryptionManager::derive_key_from_password("password", &salt)?;
    let mut em = EncryptionManager::new();
    em.initialize(key);
    storage.set_encryption(em);

    // 创建笔记
    let note_req = CreateNoteRequest {
        title: "My Note".to_string(),
        content: "Important information".to_string(),
        notebook_id: None,
        tags: vec!["important".to_string()],
    };

    let note = storage.create_note(&note_req)?;

    // 索引笔记
    search.add_note(
        &note.meta.id,
        &note.meta.title,
        &note.content,
        &note.meta.tags,
        note.meta.updated_at,
    )?;

    // 搜索笔记
    let results = search.search("important", 50)?;
    println!("Found {} results", results.len());

    // 获取笔记（自动解密）
    let retrieved = storage.get_note(&note.meta.id)?;
    println!("Note: {}", retrieved.meta.title);

    Ok(())
}
```

---

## 🔑 关键概念

### Salt（盐值）
- 16 字节随机数
- 防彩虹表攻击
- 与密钥派生一起使用
- 可以存储在数据库中

### Key（密钥）
- 32 字节 (256 位)
- 从密码和盐派生
- 用于 AES 加密
- 不应存储在数据库中

### IV（初始向量）
- 12 字节随机数
- 每次加密生成新的
- 与密文一起存储
- 确保相同内容产生不同密文

### Nonce
- 与 IV 同义（在 GCM 模式中）
- 必须唯一
- 影响加密安全性

---

## 📚 进阶主题

### 自定义分词

```rust
// 修改 tokenize_chinese() 来自定义分词行为
fn tokenize_chinese(text: &str) -> String {
    let words = JIEBA.cut(text, true); // 精确模式
    words.join(" ")
}
```

### 密钥轮换

```rust
// 用新密钥重新加密所有笔记
fn rotate_keys(old_key: &[u8], new_key: &[u8]) -> Result<()> {
    let mut old_em = EncryptionManager::new();
    old_em.initialize(old_key.try_into()?);
    
    let mut new_em = EncryptionManager::new();
    new_em.initialize(new_key.try_into()?);
    
    // 遍历所有笔记并重新加密
    // ...
}
```

### 索引维护

```rust
// 重建完整索引
fn rebuild_index(storage: &LocalStorage, search: &mut SearchEngine) -> Result<()> {
    let notes = storage.list_notes(None, 10000, 0)?;
    
    for note_meta in notes {
        if let Ok(note) = storage.get_note(&note_meta.id) {
            search.add_note(
                &note.meta.id,
                &note.meta.title,
                &note.content,
                &note.meta.tags,
                note.meta.updated_at,
            )?;
        }
    }
    
    Ok(())
}
```

---

## ✅ 生产检查清单

- [ ] 所有测试通过
- [ ] 依赖项已更新
- [ ] 加密密钥安全存储
- [ ] Salt 值已保存
- [ ] 定期备份数据库
- [ ] 监控搜索性能
- [ ] 日志已配置
- [ ] 错误处理完善

---

## 🚀 下一步

1. **集成到你的应用**
   - 添加搜索 UI
   - 添加加密设置页面
   - 集成到笔记编辑器

2. **优化性能**
   - 测试大数据集
   - 优化搜索结果限制
   - 考虑索引缓存

3. **增强功能**
   - 搜索历史
   - 搜索建议
   - 高级搜索语法

---

**版本**: 1.0  
**最后更新**: 2026-06-27  
**维护状态**: 主动维护 ✓
