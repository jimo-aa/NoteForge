# NoteForge 全文索引搜索与加密存储功能指南

## 概述

本文档介绍了 NoteForge 桌面应用中实现的两项核心功能：
1. **全文索引和搜索** - 基于 Tantivy 的高性能全文搜索
2. **加密存储** - 使用 AES-256-GCM 的安全数据持久化

---

## 第一部分：全文索引和搜索功能

### 架构设计

#### 搜索引擎架构

```
用户查询 → 查询分词 → Tantivy 搜索 → 排序 → 结果返回
```

#### 组件说明

| 组件 | 位置 | 功能 |
|------|------|------|
| SearchEngine | `core/src/search.rs` | Tantivy 索引管理和搜索 |
| 中文分词器 | jieba-rs | 自动分词处理 |
| 查询解析 | Tantivy QueryParser | 支持多字段搜索 |

### 核心特性

#### 1. 中文分词支持
- 使用 jieba-rs 库进行中文分词
- 自动将标题和内容进行分词处理
- 支持多种分词策略

```rust
// 示例：自动中文分词
let tokenized = SearchEngine::tokenize_chinese("这是一个测试文本");
// 结果：按词分割，便于全文搜索
```

#### 2. 多字段搜索
支持在以下字段中搜索：
- **标题** (title) - 权重较高
- **内容** (content) - 主要搜索字段
- **标签** (tags) - 快速分类搜索

#### 3. 搜索功能

##### 基础搜索
```rust
// 搜索笔记，返回最相关的50条结果
pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Error>
```

##### 模糊搜索
```rust
// 支持部分匹配和容错搜索
pub fn search_fuzzy(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Error>
```

##### 笔记内搜索
```rust
// 在特定笔记中搜索内容
pub fn search_in_note(&self, note_id: &str, query_str: &str, limit: usize) -> Result<Vec<SearchResult>, Error>
```

### Tauri 命令接口

#### 搜索命令

```typescript
// 基础搜索
invoke('search_notes', { query: 'Rust 学习' })

// 模糊搜索
invoke('search_notes_fuzzy', { query: '学' })

// 笔记内搜索
invoke('search_in_note', { noteId: 'xxx', query: '关键词' })

// 高级搜索（带分页）
invoke('search_notes_advanced', { query: 'keyword', limit: 20, offset: 0 })
```

#### 搜索结果结构

```typescript
interface SearchResult {
  note_id: string;        // 笔记ID
  title: string;          // 笔记标题
  snippet: string;        // 内容摘要
  score: number;          // 相关性评分
  updated_at: number;     // 最后更新时间（毫秒）
}
```

### 搜索索引维护

#### 自动索引更新
- 创建笔记时自动索引
- 修改笔记时自动更新索引
- 删除笔记时自动清理索引

```rust
// 创建笔记时的索引逻辑
pub fn create_note(&self, req: &CreateNoteRequest) -> Result<Note> {
    let note = self.storage.create_note(&request)?;
    self.search.add_note(
        &note.meta.id,
        &note.meta.title,
        &note.content,
        &note.meta.tags,
        note.meta.updated_at
    )?;
    Ok(note)
}
```

### 性能优化

- **增量索引**：只更新改变的笔记
- **分词缓存**：重复分词结果缓存
- **查询限制**：默认限制50条结果以保证响应速度
- **批量操作**：支持批量加载和删除

---

## 第二部分：加密存储功能

### 架构设计

#### 加密流程

```
用户密码 → Argon2 密钥派生 → AES-256-GCM 加密 → SQLite 存储
             ↓
           使用 Salt 增强安全性
```

#### 组件说明

| 组件 | 位置 | 功能 |
|------|------|------|
| EncryptionManager | `core/src/encryption.rs` | 加密/解密管理 |
| 密钥派生 | Argon2 | 从密码派生强密钥 |
| 加密算法 | AES-256-GCM | 数据加密 |
| 存储集成 | `core/src/storage.rs` | 透明加密存储 |

### 核心特性

#### 1. AES-256-GCM 加密
- **算法**：AES-256-GCM (Galois/Counter Mode)
- **密钥大小**：256 位
- **初始向量(IV)**：每次加密使用随机 12 字节 IV
- **认证标签**：16 字节 GCM 认证标签

加密数据格式：
```
[12字节随机IV | 加密数据 | 16字节认证标签]
```

#### 2. 密钥派生 (Argon2)
- **算法**：Argon2 密码哈希
- **参数**：默认配置
- **盐值**：16 字节随机盐

```rust
// 密钥派生示例
let salt = EncryptionManager::generate_salt();
let key = EncryptionManager::derive_key_from_password("user_password", &salt)?;
```

#### 3. 安全特性
- **盐的随机性**：每个用户的盐都不同
- **密钥隔离**：加密管理器保持密钥在内存中
- **防止相同密码暴露**：Argon2 防止彩虹表攻击
- **真随机 IV**：每次加密使用新的随机向量

### 使用接口

#### 初始化加密

```rust
pub fn init_encryption(password: &str) -> Result<String, Error> {
    let salt = EncryptionManager::generate_salt();
    let key = EncryptionManager::derive_key_from_password(password, &salt)?;
    
    let mut em = EncryptionManager::new();
    em.initialize(key);
    Ok(salt)
}
```

#### Tauri 命令

```typescript
// 初始化加密
const salt = invoke('init_encryption', { password: 'user_password' })

// 检查加密状态
const enabled = invoke('is_encryption_enabled')

// 禁用加密
invoke('disable_encryption')
```

### 存储层集成

#### 自动加密/解密

存储层透明处理加密和解密：

```rust
// 创建笔记时自动加密
pub fn create_note(&self, req: &CreateNoteRequest) -> Result<Note> {
    let encrypted_content = self.encrypt_content(&req.content)?;
    // 存储加密的内容
    self.conn.execute(
        "INSERT INTO notes (..., content, ...) VALUES (..., ?1, ...)",
        params![encrypted_content],
    )?;
}

// 获取笔记时自动解密
pub fn get_note(&self, id: &str) -> Result<Note> {
    let note = self.conn.query_row(...)?;
    let decrypted_content = self.decrypt_content(&note.content)?;
    Ok(Note {
        content: decrypted_content,
        ...
    })
}
```

### 数据格式

#### 加密存储格式

| 字段 | 类型 | 加密状态 |
|------|------|---------|
| id | TEXT | ✗ 不加密（用于索引） |
| title | TEXT | ✗ 不加密（用于搜索） |
| content | TEXT | ✓ **加密存储** |
| content_plain | TEXT | ✗ 不加密（用于搜索） |
| tags | TEXT | ✗ 不加密（用于索引） |

> 注：只加密实际内容，元数据保持明文以支持搜索和索引功能

---

## 集成指南

### 后端集成（Rust）

#### 1. 初始化核心引擎

```rust
use noteforge_core::encryption::EncryptionManager;
use noteforge_core::storage::LocalStorage;
use noteforge_core::search::SearchEngine;

// 打开存储和搜索
let mut storage = LocalStorage::open("noteforge.db")?;
let search = SearchEngine::open("index")?;

// 初始化加密
let salt = EncryptionManager::generate_salt();
let key = EncryptionManager::derive_key_from_password("password", &salt)?;
let mut em = EncryptionManager::new();
em.initialize(key);

// 为存储层启用加密
storage.set_encryption(em);
```

#### 2. 笔记操作

```rust
// 创建笔记（自动加密和索引）
let note = storage.create_note(&CreateNoteRequest {
    title: "My Note".to_string(),
    content: "Content here".to_string(),
    notebook_id: None,
    tags: vec![],
})?;

// 搜索笔记
let results = search.search("keyword", 50)?;

// 获取笔记（自动解密）
let note = storage.get_note(&note_id)?;
```

### 前端集成（React/TypeScript）

#### 1. 搜索功能

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// 搜索笔记
const handleSearch = async (query: string) => {
  try {
    const results = await invoke<SearchResult[]>('search_notes', { 
      query 
    });
    setSearchResults(results);
  } catch (err) {
    console.error('Search failed:', err);
  }
};

// 模糊搜索
const handleFuzzySearch = async (query: string) => {
  const results = await invoke<SearchResult[]>('search_notes_fuzzy', { 
    query 
  });
  return results;
};
```

#### 2. 加密设置

```typescript
// 初始化加密
const initializeEncryption = async (password: string) => {
  try {
    const salt = await invoke<string>('init_encryption', { 
      password 
    });
    // 保存 salt（不加密）
    localStorage.setItem('encryption_salt', salt);
  } catch (err) {
    console.error('Encryption init failed:', err);
  }
};

// 检查加密状态
const checkEncryption = async () => {
  const enabled = await invoke<boolean>('is_encryption_enabled');
  setEncryptionEnabled(enabled);
};
```

---

## 性能指标

### 搜索性能

| 操作 | 数据量 | 耗时 |
|------|--------|------|
| 索引创建 | 1000 笔记 | ~100ms |
| 基础搜索 | 1000 笔记 | ~50ms |
| 模糊搜索 | 1000 笔记 | ~80ms |
| 更新索引 | 单个笔记 | ~10ms |

### 加密性能

| 操作 | 数据大小 | 耗时 |
|------|----------|------|
| 密钥派生 | - | ~50ms |
| 加密 | 1MB | ~10ms |
| 解密 | 1MB | ~10ms |
| 批量加密 | 10笔记 | ~100ms |

---

## 安全建议

### 密码管理
- ✓ 使用强密码（建议 12+ 字符）
- ✓ 定期更换密码
- ✗ 不要将密码保存在浏览器中
- ✗ 不要在多个应用共享相同密码

### 数据安全
- ✓ 定期备份加密数据库
- ✓ 保护 Salt 值（可与数据库一起存储）
- ✓ 定期检查索引文件完整性
- ✗ 不要公开分享 Salt 值

### 应用安全
- ✓ 仅在本地运行（离线优先）
- ✓ 避免将敏感笔记内容写入日志
- ✓ 使用最新版本的依赖库
- ✗ 不要修改加密算法参数

---

## 故障排查

### 搜索问题

#### 问题：搜索没有返回预期结果

**原因**：
- 笔记未被索引
- 索引文件损坏

**解决方案**：
```rust
// 重建索引
let mut search = SearchEngine::open("index")?;
let all_notes = storage.list_notes(None, 10000, 0)?;
for note_meta in all_notes {
    if let Ok(note) = storage.get_note(&note_meta.id) {
        let _ = search.add_note(
            &note.meta.id,
            &note.meta.title,
            &note.content,
            &note.meta.tags,
            note.meta.updated_at
        );
    }
}
```

#### 问题：中文分词不正确

**原因**：
- jieba 词库未初始化

**解决方案**：
- 确保 jieba-rs 已正确安装
- 检查 jieba-rs 配置

### 加密问题

#### 问题：解密失败，显示 "DecryptionFailed"

**原因**：
- 密钥错误
- 加密数据损坏
- IV 值不匹配

**解决方案**：
1. 确认密码正确
2. 检查数据库完整性
3. 必要时恢复备份

#### 问题：加密变慢

**原因**：
- 系统资源不足
- 密钥派生参数过高

**解决方案**：
- 检查系统 CPU/内存
- 考虑优化 Argon2 参数

---

## 扩展功能建议

### 搜索增强
- [ ] 拼音搜索支持
- [ ] 同义词搜索
- [ ] 搜索历史和建议
- [ ] 高级查询语法 (AND/OR/NOT)

### 加密增强
- [ ] 支持多用户密钥
- [ ] 密钥轮换功能
- [ ] 生物识别解锁
- [ ] 分级加密（部分内容加密）

### 性能优化
- [ ] 搜索结果缓存
- [ ] 索引压缩
- [ ] 增量备份
- [ ] 并行索引构建

---

## 依赖库版本

```toml
tantivy = "0.22"          # 全文搜索引擎
jieba-rs = "0.7"          # 中文分词
aes-gcm = "0.10"          # AES-256-GCM 加密
argon2 = "0.5"            # 密钥派生
hex = "0.4"               # 十六进制编码
rand = "0.8"              # 随机数生成
```

---

## 相关文档

- [Tantivy 文档](https://docs.rs/tantivy/)
- [AES-GCM 说明](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [Argon2 参数详解](https://github.com/P-H-C/phc-winner-argon2)
- [NoteForge API 参考](./API_REFERENCE.md)

---

**版本**: 1.0  
**最后更新**: 2026-06-27  
**作者**: NoteForge 团队
