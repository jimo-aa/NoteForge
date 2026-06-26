# NoteForge 快速启动指南

## 🚀 开发环境配置

### 前置要求

- **Node.js**: >= 18.0.0
- **Rust**: >= 1.70.0
- **Cargo**: 随 Rust 一同安装

### 项目结构

```
NoteForge/
├── desktop/              # Tauri 桌面应用
│   ├── src/             # React 前端源码
│   │   ├── components/  # React 组件
│   │   ├── stores/      # 状态管理
│   │   ├── types/       # TypeScript 类型
│   │   └── App.tsx      # 应用入口
│   ├── src-tauri/       # Rust 后端源码
│   │   ├── src/
│   │   │   ├── commands.rs      # Tauri 命令
│   │   │   ├── main.rs          # 应用入口
│   │   │   ├── lib.rs           # 库文件
│   │   │   └── git_history.rs   # 版本控制
│   │   └── tauri.conf.json      # Tauri 配置
│   ├── package.json
│   └── tsconfig.json
├── core/                # 核心库（Rust）
│   ├── src/
│   │   ├── lib.rs           # 库入口
│   │   ├── types.rs         # 数据类型
│   │   ├── storage.rs       # SQLite 存储
│   │   ├── search.rs        # 全文搜索
│   │   └── md_engine.rs     # Markdown 处理
│   └── Cargo.toml
└── IMPLEMENTATION_GUIDE.md  # 完整设计文档
```

## 📦 安装依赖

### 前端依赖

```bash
cd desktop
npm install
```

### 后端依赖

Rust 依赖在 `Cargo.toml` 中声明，首次构建时自动下载。

## 🛠️ 本地开发

### 启动开发服务器

```bash
cd desktop

# 开发模式（热重载）
npm run dev

# 在另一个终端启动 Tauri 应用
npm run tauri dev
```

### 构建生产版本

```bash
cd desktop

# 完整构建（前端 + 后端）
npm run build

# 生成安装程序（Windows .msi / macOS .dmg / Linux .AppImage）
npm run tauri build
```

## 📝 核心功能实现说明

### 1. 笔记创建流程

**前端流程**:
```
用户点击"新建笔记" 
  ↓
NewNoteModal 模态框打开
  ↓
用户填写标题、选择笔记本、模板、标签
  ↓
用户点击"创建笔记"按钮
  ↓
前端调用 store.createNote()
  ↓
store 通过 Tauri IPC 调用后端 create_note 命令
  ↓
后端创建笔记并返回 Note 对象
  ↓
前端更新本地状态
  ↓
显示成功提示
```

**后端实现**:
```rust
// 命令处理器（desktop/src-tauri/src/commands.rs）
#[tauri::command]
pub fn create_note(
    state: State<'_, AppState>,
    request: CreateNoteRequest,
) -> Result<Note, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.create_note(&request)
        .map_err(|e| e.to_string())
}

// 存储实现（core/src/storage.rs）
pub fn create_note(&self, req: &CreateNoteRequest) 
    -> Result<Note, Box<dyn std::error::Error>> {
    let id = types::generate_id();
    let now = types::now_ms();
    
    // 插入笔记
    self.conn.execute(
        "INSERT INTO notes (id, notebook_id, title, content, 
                           content_plain, word_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, req.notebook_id, req.title, req.content, 
                plain, wc, now, now],
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
    
    self.get_note(&id)
}
```

### 2. 笔记本创建流程

**前端流程**:
```
用户点击"新建笔记本"
  ↓
NotebookModal 模态框打开
  ↓
用户输入笔记本名称、选择图标
  ↓
用户点击"创建"按钮
  ↓
前端调用 store.createNotebook()
  ↓
store 通过 Tauri IPC 调用后端 create_notebook 命令
  ↓
后端创建笔记本并返回 Notebook 对象
  ↓
前端刷新笔记本列表
  ↓
显示成功提示
```

**后端实现**:
```rust
// 命令处理器
#[tauri::command]
pub fn create_notebook(
    state: State<'_, AppState>,
    name: String,
) -> Result<Notebook, String> {
    let core = state.core.lock().map_err(|e| e.to_string())?;
    core.storage.create_notebook(&name)
        .map_err(|e| e.to_string())
}

// 存储实现
pub fn create_notebook(&self, name: &str) 
    -> Result<Notebook, Box<dyn std::error::Error>> {
    let id = types::generate_id();
    let now = types::now_ms();
    self.conn.execute(
        "INSERT INTO notebooks (id, name, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4)",
        params![id, name, now, now],
    )?;
    self.get_notebook(&id)
}
```

### 3. 数据持久化（SQLite）

**数据库初始化**:
```rust
// 创建表结构
pub fn initialize_tables(&self) -> Result<(), Box<dyn std::error::Error>> {
    self.conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         
         CREATE TABLE IF NOT EXISTS notebooks (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             icon TEXT NOT NULL DEFAULT '📁',
             color TEXT NOT NULL DEFAULT '#6366f1',
             created_at INTEGER NOT NULL,
             updated_at INTEGER NOT NULL
         );
         
         CREATE TABLE IF NOT EXISTS notes (
             id TEXT PRIMARY KEY,
             notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
             title TEXT NOT NULL,
             content TEXT NOT NULL,
             content_plain TEXT NOT NULL,
             is_pinned INTEGER NOT NULL DEFAULT 0,
             is_favorite INTEGER NOT NULL DEFAULT 0,
             word_count INTEGER NOT NULL DEFAULT 0,
             version INTEGER NOT NULL DEFAULT 1,
             created_at INTEGER NOT NULL,
             updated_at INTEGER NOT NULL,
             is_deleted INTEGER NOT NULL DEFAULT 0
         );
         
         CREATE TABLE IF NOT EXISTS tags (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL UNIQUE,
             color TEXT NOT NULL DEFAULT '#6366f1'
         );
         
         CREATE TABLE IF NOT EXISTS note_tags (
             note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
             tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
             PRIMARY KEY (note_id, tag_id)
         );
         "
    )?;
    self.ensure_indexes()?;
    Ok(())
}
```

**查询优化**:
```rust
// 创建索引以提高查询性能
pub fn ensure_indexes(&self) -> Result<(), Box<dyn std::error::Error>> {
    self.conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_notebook 
         ON notes(notebook_id) WHERE is_deleted = 0",
        [],
    )?;
    self.conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_updated 
         ON notes(updated_at DESC)",
        [],
    )?;
    Ok(())
}
```

## 🔌 API 接口

### Tauri 命令列表

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `create_note` | `CreateNoteRequest` | `Note` | 创建笔记 |
| `get_note` | `id: String` | `Note` | 获取笔记 |
| `update_note` | `id, title?, content?, ...` | `Note` | 更新笔记 |
| `delete_note` | `id: String` | `()` | 删除笔记 |
| `list_notes` | 无 | `Vec<Note>` | 列表笔记 |
| `search_notes` | `query: String` | `Vec<SearchResult>` | 搜索笔记 |
| `create_notebook` | `name: String` | `Notebook` | 创建笔记本 |
| `list_notebooks` | 无 | `Vec<Notebook>` | 列表笔记本 |
| `rename_notebook` | `id, name` | `Notebook` | 重命名笔记本 |
| `delete_notebook` | `id: String` | `bool` | 删除笔记本 |
| `list_tags` | 无 | `Vec<String>` | 列表标签 |

## 🗄️ 数据库命令参考

### SQLite 常用查询

```sql
-- 查看所有笔记
SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC;

-- 查看笔记本中的笔记
SELECT n.* FROM notes n 
JOIN notebooks nb ON n.notebook_id = nb.id 
WHERE nb.id = 'notebook-id' AND n.is_deleted = 0;

-- 查看笔记的标签
SELECT t.name FROM tags t 
JOIN note_tags nt ON t.id = nt.tag_id 
WHERE nt.note_id = 'note-id';

-- 统计笔记数量
SELECT nb.name, COUNT(n.id) as count FROM notebooks nb 
LEFT JOIN notes n ON nb.id = n.notebook_id AND n.is_deleted = 0 
GROUP BY nb.id;

-- 全文搜索笔记
SELECT * FROM notes 
WHERE (title LIKE '%keyword%' OR content_plain LIKE '%keyword%') 
AND is_deleted = 0;
```

## 📊 性能指标

| 操作 | 预期时间 | 优化方法 |
|------|---------|---------|
| 创建笔记 | < 10ms | 异步提交 |
| 查询笔记 | < 5ms | 数据库索引 |
| 全文搜索 | < 50ms | Tantivy 索引 |
| 列表笔记 | < 20ms | 分页查询 |
| 列表笔记本 | < 5ms | JOIN 查询优化 |

## 🐛 调试技巧

### 启用调试日志

在 `src-tauri/src/main.rs` 中:

```rust
use tracing_subscriber;

#[cfg(debug_assertions)]
fn init_logging() {
    tracing_subscriber::fmt::init();
}
```

### 查看数据库内容

```bash
# 安装 sqlite3 命令行工具
sqlite3 ~/.config/noteforge/noteforge.db

# SQLite 交互式命令
.tables                          # 查看所有表
.schema notes                    # 查看表结构
SELECT COUNT(*) FROM notes;      # 统计笔记数
.quit                            # 退出
```

### 前端调试

```typescript
// 在浏览器控制台调试
await invoke('list_notes')
  .then(notes => console.log('Notes:', notes))
  .catch(err => console.error('Error:', err));
```

## 📚 常见问题

### Q: 如何重置数据库？
A: 删除 `~/.config/noteforge/` 目录下的 `noteforge.db` 文件，重启应用会重新创建。

### Q: 数据库在哪里？
A: 
- **Windows**: `%APPDATA%\noteforge\`
- **macOS**: `~/Library/Application Support/noteforge/`
- **Linux**: `~/.config/noteforge/`

### Q: 如何导出笔记？
A: 暂时需要手动从数据库导出，后续版本会提供 UI 导出功能。

### Q: 支持笔记本嵌套吗？
A: 当前版本不支持嵌套，后续版本将支持。

## 🔄 工作流程

### 日常开发

```bash
# 1. 启动开发服务器
npm run dev

# 2. 在另一个终端启动 Tauri 应用
npm run tauri dev

# 3. 修改代码后自动热重载

# 4. 打开浏览器开发者工具（Ctrl+Shift+I）查看日志

# 5. 完成测试后停止服务
Ctrl+C
```

### 提交改动

```bash
# 1. 检查代码格式
npm run fmt

# 2. 运行类型检查
npx tsc

# 3. 构建测试
npm run build

# 4. 提交改动
git add .
git commit -m "feat: 添加新功能"
```

## 📖 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [Rust 圣经](https://doc.rust-lang.org/book/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

## 📝 变更日志

### v1.0.0 (2026-06-16)

**新增功能**:
- ✅ 笔记创建和编辑
- ✅ 笔记本管理
- ✅ 标签系统
- ✅ 全文搜索
- ✅ 版本控制
- ✅ Markdown 支持
- ✅ 自动保存草稿
- ✅ 主题切换

**后续计划**:
- 🔜 笔记本嵌套结构
- 🔜 协作编辑
- 🔜 云同步
- 🔜 AI 摘要生成
- 🔜 语音笔记

---

**快速开始**: 运行 `npm run tauri dev` 立即开始开发！
