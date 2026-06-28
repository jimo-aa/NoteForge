# NoteForge Rust 核心引擎设计

## 一、引擎概览

```
NoteForge Core Engine
├── md-engine/        Markdown 解析 + AST + 渲染
├── search-engine/    全文索引 + 搜索 (tantivy)
├── crypto-engine/    加密/解密 (AES-256-GCM)
├── sync-engine/      CRDT 同步 (automerge-rs)
├── storage/          本地存储 (SQLite)
└── ffi/              Tauri / Flutter FFI 桥接
```

## 二、各子引擎设计

### 2.1 Markdown Engine

```rust
// md-engine/src/lib.rs
pub struct MarkdownEngine {
    parser: Parser,     // pulldown-cmark
    renderer: Renderer, // 自定义 HTML 渲染
}

impl MarkdownEngine {
    /// 解析 Markdown 为 AST
    pub fn parse(&self, input: &str) -> AstNode;
    
    /// 增量解析（只更新变化部分）
    pub fn parse_incremental(&self, old_ast: &AstNode, diff: &str) -> AstNode;
    
    /// 渲染为 HTML
    pub fn render_html(&self, ast: &AstNode) -> String;
    
    /// 提取纯文本（用于搜索）
    pub fn extract_plain_text(&self, ast: &AstNode) -> String;
    
    /// 解析 [[Wiki Links]]
    pub fn extract_wiki_links(&self, ast: &AstNode) -> Vec<LinkRef>;
    
    /// 提取标签 #tag
    pub fn extract_tags(&self, ast: &AstNode) -> Vec<String>;
}
```

### 2.2 Search Engine

```rust
// search-engine/src/lib.rs
pub struct SearchEngine {
    index: tantivy::Index,
    writer: IndexWriter,
}

impl SearchEngine {
    /// 添加文档到索引
    pub fn add_document(&mut self, note: &NoteMeta) -> Result<()>;
    
    /// 从索引移除文档
    pub fn remove_document(&mut self, note_id: &str) -> Result<()>;
    
    /// 搜索
    pub fn search(&self, query: &str, opts: &SearchOpts) -> Result<Vec<SearchResult>>;
    
    /// 中文分词
    pub fn tokenize_cn(&self, text: &str) -> Vec<String>;
}
```

### 2.3 Crypto Engine

```rust
// crypto-engine/src/lib.rs
pub struct CryptoEngine {
    master_key: [u8; 32],
}

impl CryptoEngine {
    /// 从口令派生密钥
    pub fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32]>;
    
    /// 加密笔记内容
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>>;
    
    /// 解密笔记内容
    pub fn decrypt(&self, ciphertext: &[u8]) -> Result<Vec<u8>>;
    
    /// 生成加密密钥对
    pub fn generate_keypair() -> (PublicKey, SecretKey);
}
```

## 三、FFI 桥接（Tauri 命令）

```rust
// ffi/src/lib.rs — 导出给 Tauri 前端的 API

#[tauri::command]
fn create_note(title: String, content: String) -> Result<NoteMeta, String>;

#[tauri::command]
fn get_note(id: String) -> Result<Note, String>;

#[tauri::command]
fn search_notes(query: String, limit: usize) -> Result<Vec<SearchResult>, String>;

#[tauri::command]
fn encrypt_note(id: String, passphrase: String) -> Result<(), String>;

#[tauri::command]
fn get_knowledge_graph() -> Result<GraphData, String>;

#[tauri::command]
fn sync_to_cloud() -> Result<SyncStatus, String>;

#[tauri::command]
fn export_note(id: String, format: String) -> Result<Vec<u8>, String>;
```

## 四、性能指标

| 操作 | 性能目标 | 测试方法 |
|------|:--------:|---------|
| Markdown 解析 (10万字) | < 10ms | criterion bench |
| 全文搜索 (10万笔记) | < 50ms | criterion bench |
| AES 加密 (1MB) | < 5ms | criterion bench |
| CRDT 合并 (1000 ops) | < 30ms | criterion bench |
| 本地 SQLite 写入 | > 1000 tps | tokio bench |
