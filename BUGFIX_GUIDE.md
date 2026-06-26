# NoteForge 笔记创建错误修复方案

## 问题分析

**错误信息:**
```
[Tauri API Error] create_note: NOT NULL constraint failed: notes.notebook_id
[createNote] Backend returned null for note creation
```

**根本原因:**
1. 前端在创建笔记时，可能传递了 `null` 或 `undefined` 作为 `notebook_id`
2. 数据库 `notes` 表中的 `notebook_id` 字段有 NOT NULL 约束
3. 后端没有提供默认值的处理

## 修复方案

### 第一步：后端修复（核心）

**文件: `core/src/storage.rs`**

修改 `create_note` 方法，确保在 `notebook_id` 为空时使用默认值：

```rust
pub fn create_note(&self, req: &CreateNoteRequest) 
    -> Result<Note, Box<dyn std::error::Error>> {
    let id = types::generate_id();
    let now = types::now_ms();
    let plain = crate::md_engine::MarkdownEngine::extract_plain_text(&req.content);
    let wc = crate::md_engine::MarkdownEngine::count_words(&req.content);

    // 关键修复：如果 notebook_id 为空则使用 'default'
    let notebook_id = req.notebook_id.as_deref().unwrap_or("default");

    self.conn.execute(
        "INSERT INTO notes (id, notebook_id, title, content, content_plain,
                            word_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, notebook_id, req.title, req.content, plain, wc, now, now],
    )?;

    // ... 标签和 wiki links 处理 ...
    
    self.get_note(&id)
}
```

### 第二步：Serde 属性修复（兼容性）

**文件: `core/src/types.rs`**

添加 serde 属性，支持驼峰命名法（来自 JavaScript）：

```rust
#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    #[serde(alias = "notebookId")]  // ← 支持驼峰命名
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    #[serde(rename = "notebookId")]
    pub notebook_id: Option<String>,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
    #[serde(rename = "wordCount")]
    pub word_count: u32,
    pub version: u32,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
}
```

### 第三步：前端修复（数据验证）

**文件: `desktop/src/stores/noteStore.tsx`**

确保前端在调用后端时总是提供有效的 `notebook_id`：

```typescript
const createNote = useCallback(
  async (title: string, content: string, notebookId: string, tags: string[]) => {
    try {
      // ← 关键修复：确保 notebookId 总是有值
      const finalNotebookId = 
        notebookId && notebookId !== 'all' ? notebookId : 'default';
      
      const note = await tauriInvoke<Note>('create_note', { 
        request: { 
          title, 
          content, 
          notebook_id: finalNotebookId,  // ← 使用确保有值的 ID
          tags 
        } 
      });
      
      if (note) {
        setNotes((prev) => [note, ...prev]);
        setCurrentNoteId(note.meta.id);
        return note;
      }
    } catch (error) {
      console.error('[createNote] Error:', error);
      return null;
    }
  },
  []
);
```

### 第四步：前端 UI 修复

**文件: `desktop/src/components/Modals/NewNoteModal.tsx`**

确保笔记本选择始终有值：

```typescript
const createNote = async () => {
  if (!title.trim()) return;

  // ← 关键修复：确保 notebookId 始终有效
  const finalNotebookId =
    notebookId && notebookId !== 'all'
      ? notebookId
      : notebooks.find((item) => item.id !== 'all')?.id || 'default';

  await onCreate({
    title: title.trim() || '未命名笔记',
    notebookId: finalNotebookId,  // ← 使用确保有值的 ID
    tags,
    content: content.trim(),
  });
};
```

## 核心更改清单

### 后端 (Rust)
- [x] `core/src/storage.rs`: 修改 `create_note()` 方法，添加默认值处理
- [x] `core/src/types.rs`: 添加 serde 属性，支持驼峰命名法

### 前端 (React)
- [x] `desktop/src/stores/noteStore.tsx`: 确保 notebookId 总是有值
- [x] `desktop/src/components/Modals/NewNoteModal.tsx`: 笔记本选择验证

## 测试方案

### 测试场景 1: 正常创建笔记
1. 打开应用
2. 按 `Ctrl+N` 创建笔记
3. 输入标题
4. 选择笔记本（不为空）
5. 点击"创建笔记"
6. ✅ 应该成功创建笔记

### 测试场景 2: 没有选择笔记本
1. 打开应用
2. 如果没有笔记本，创建一个
3. 按 `Ctrl+N` 创建笔记
4. 输入标题
5. 点击"创建笔记"
6. ✅ 应该使用 'default' 笔记本创建笔记

### 测试场景 3: 使用模板创建笔记
1. 打开应用
2. 按 `Ctrl+N` 创建笔记
3. 选择"会议记录"模板
4. 输入标题
5. 点击"创建笔记"
6. ✅ 应该成功创建笔记，内容为模板内容

## 问题根源详解

### 为什么会出现这个错误？

1. **命名不一致**: JavaScript 使用驼峰命名 (`notebookId`)，Rust 使用蛇形命名 (`notebook_id`)
   - 解决: 使用 `serde(alias)` 和 `serde(rename)` 属性

2. **缺少默认值**: 当 `notebook_id` 为 `None` 时，没有回退到默认值
   - 解决: 在后端添加 `unwrap_or("default")` 处理

3. **UI 验证不足**: 前端可能在某些情况下允许笔记本为空
   - 解决: 在前端添加显式的默认值选择

## 完整的数据流

```
前端 (React)
  ↓
用户点击"创建笔记"
  ↓
NewNoteModal 检查 notebookId
  ├─ 如果为空，使用 'default'
  └─ 否则，使用选择的值
  ↓
store.createNote(title, content, finalNotebookId, tags)
  ↓
Tauri IPC 调用: invoke('create_note', { request: {...} })
  ↓
后端 (Rust)
  ↓
CreateNoteRequest 反序列化
  ├─ 支持 notebookId 和 notebook_id 两种格式
  └─ notebook_id: Option<String>
  ↓
storage.create_note()
  ├─ 检查 notebook_id
  ├─ 如果为 None，使用 'default'
  └─ 插入数据库
  ↓
返回创建的 Note 对象
  ↓
前端显示成功消息
```

## 后续验证步骤

1. **编译检查**
   ```bash
   cd desktop
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

2. **开发模式运行**
   ```bash
   npm run dev          # 终端 1
   npm run tauri dev    # 终端 2
   ```

3. **测试创建笔记**
   - 创建新笔记
   - 检查浏览器控制台是否有错误
   - 验证笔记是否出现在列表中

4. **检查数据库**
   ```bash
   sqlite3 ~/.config/noteforge/noteforge.db
   SELECT id, title, notebook_id FROM notes LIMIT 5;
   ```

## 预期效果

修复后，用户应该能够：
- ✅ 成功创建笔记
- ✅ 笔记自动关联到选定的笔记本，或默认笔记本
- ✅ 不再看到 "NOT NULL constraint failed" 错误
- ✅ 笔记立即出现在应用UI中

## 技术细节

### Serde 序列化配置

| 配置方式 | 用途 | 示例 |
|---------|------|------|
| `#[serde(rename = "...")]` | 序列化/反序列化时改变字段名 | `#[serde(rename = "notebookId")]` |
| `#[serde(alias = "...")]` | 反序列化时接受额外的字段名 | `#[serde(alias = "notebookId")]` |
| `#[serde(skip)]` | 序列化时跳过字段 | `#[serde(skip)]` |

### Option 类型处理

```rust
// Option<String> 处理方式
let value = Some("default".to_string());
let result = value.as_deref().unwrap_or("fallback");
// result = "default"

let value: Option<String> = None;
let result = value.as_deref().unwrap_or("fallback");
// result = "fallback"
```

## 总结

这个修复方案从三个方面解决了问题：
1. **后端防守**: 即使前端传递了 null，也要有默认值
2. **中间层兼容**: 支持不同的命名约定（驼峰 vs 蛇形）
3. **前端验证**: 确保在源头就提供有效数据

这样可以确保系统的鲁棒性，避免类似问题再次出现。
