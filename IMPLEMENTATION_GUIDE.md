# NoteForge 桌面端 - 笔记和笔记本创建功能设计方案

## 目录
1. [架构概览](#架构概览)
2. [系统特性](#系统特性)
3. [数据模型](#数据模型)
4. [实现详情](#实现详情)
5. [使用指南](#使用指南)
6. [API 参考](#api-参考)

---

## 架构概览

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React)                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ UI 层                                                 │  │
│  │ ├─ App.tsx (主应用容器)                              │  │
│  │ ├─ Sidebar (侧边栏，笔记本导航)                      │  │
│  │ ├─ Editor (编辑器)                                   │  │
│  │ ├─ NewNoteModal (笔记创建模态框)                     │  │
│  │ ├─ NotebookModal (笔记本管理模态框)                  │  │
│  │ └─ EntityModal (通用实体编辑模态框)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 状态管理层 (Zustand/Context)                          │  │
│  │ └─ noteStore.tsx (全局状态管理)                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↓  (Tauri IPC 调用)
┌─────────────────────────────────────────────────────────────┐
│                   后端 (Rust + Tauri)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 命令层 (Tauri Commands)                               │  │
│  │ ├─ create_note()                                     │  │
│  │ ├─ update_note()                                     │  │
│  │ ├─ delete_note()                                     │  │
│  │ ├─ get_note()                                        │  │
│  │ ├─ list_notes()                                      │  │
│  │ ├─ create_notebook()                                 │  │
│  │ ├─ rename_notebook()                                 │  │
│  │ ├─ delete_notebook()                                 │  │
│  │ └─ list_notebooks()                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 业务逻辑层 (NoteForgeDesktopCore)                      │  │
│  │ ├─ LocalStorage (存储操作)                           │  │
│  │ ├─ SearchEngine (搜索功能)                           │  │
│  │ └─ GitHistory (版本控制)                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                   数据持久化层 (SQLite)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 数据库表                                              │  │
│  │ ├─ notebooks (笔记本表)                              │  │
│  │ ├─ notes (笔记表)                                    │  │
│  │ ├─ tags (标签表)                                    │  │
│  │ ├─ note_tags (笔记-标签关系表)                       │  │
│  │ └─ note_links (笔记链接表)                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 系统特性

### 1. 笔记功能
- ✅ **创建笔记**: 支持模板选择、标签、笔记本分类
- ✅ **编辑笔记**: 实时保存、自动版本控制
- ✅ **删除笔记**: 软删除，保留历史记录
- ✅ **收藏/固定**: 快速访问常用笔记
- ✅ **搜索**: 全文搜索、标签筛选

### 2. 笔记本功能
- ✅ **创建笔记本**: 自定义名称和图标
- ✅ **重命名笔记本**: 修改笔记本信息
- ✅ **删除笔记本**: 级联删除笔记
- ✅ **笔记本分类**: 清晰的层级管理
- ✅ **统计信息**: 实时显示笔记数量

### 3. 数据持久化
- ✅ **SQLite 数据库**: 本地离线存储
- ✅ **WAL 模式**: 提高并发写入性能
- ✅ **外键约束**: 数据完整性保证
- ✅ **索引优化**: 查询性能提升
- ✅ **事务支持**: 原子操作保证

### 4. 高级特性
- ✅ **Markdown 支持**: 丰富的编辑体验
- ✅ **版本控制**: Git-like 历史追踪
- ✅ **标签系统**: 灵活的分类方式
- ✅ **草稿保存**: 自动恢复机制
- ✅ **拖拽排序**: 直观的交互方式

---

## 数据模型

### Notebook（笔记本）

```typescript
interface Notebook {
  id: string;           // UUID
  name: string;         // 笔记本名称
  icon: string;         // 图标 emoji
  color: string;        // 颜色代码
  parentId: string | null;  // 父级笔记本
  sortOrder: number;    // 排序值
  noteCount: number;    // 笔记数量（只读）
  createdAt: number;    // 创建时间（毫秒）
  updatedAt: number;    // 更新时间（毫秒）
}
```

### Note（笔记）

```typescript
interface Note {
  meta: NoteMeta;
  content: string;
  contentPlain: string;
}

interface NoteMeta {
  id: string;              // UUID
  title: string;           // 笔记标题
  notebookId: string | null;  // 所属笔记本
  tags: string[];          // 标签数组
  isPinned: boolean;       // 是否置顶
  isFavorite: boolean;     // 是否收藏
  wordCount: number;       // 字数统计
  version: number;         // 版本号
  createdAt: number;       // 创建时间（毫秒）
  updatedAt: number;       // 更新时间（毫秒）
}
```

### SQLite 表结构

#### notebooks 表
```sql
CREATE TABLE notebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '未命名',
  icon TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT '#6366f1',
  parent_id TEXT REFERENCES notebooks(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### notes 表
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_plain TEXT NOT NULL DEFAULT '',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
```

#### tags 表
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1'
);
```

#### note_tags 关系表
```sql
CREATE TABLE note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
```

---

## 实现详情

### 后端实现（Rust）

#### 核心命令（src-tauri/src/commands.rs）

```rust
// 笔记创建
#[tauri::command]
pub fn create_note(
  state: State<'_, AppState>,
  request: CreateNoteRequest,
) -> Result<Note, String> {
  let core = state.core.lock().map_err(|e| e.to_string())?;
  core.storage.create_note(&request)
    .map_err(|e| e.to_string())
}

// 笔记本创建
#[tauri::command]
pub fn create_notebook(
  state: State<'_, AppState>,
  name: String,
) -> Result<Notebook, String> {
  let core = state.core.lock().map_err(|e| e.to_string())?;
  core.storage.create_notebook(&name)
    .map_err(|e| e.to_string())
}

// 笔记本重命名
#[tauri::command]
pub fn rename_notebook(
  state: State<'_, AppState>,
  id: String,
  name: String,
) -> Result<Notebook, String> {
  let core = state.core.lock().map_err(|e| e.to_string())?;
  core.storage.rename_notebook(&id, &name)
    .map_err(|e| e.to_string())
}

// 笔记本删除
#[tauri::command]
pub fn delete_notebook(
  state: State<'_, AppState>,
  id: String,
) -> Result<bool, String> {
  let core = state.core.lock().map_err(|e| e.to_string())?;
  core.storage.delete_notebook(&id)
    .map_err(|e| e.to_string())?;
  Ok(true)
}
```

#### 存储层（core/src/storage.rs）

```rust
pub struct LocalStorage {
  conn: Connection,
}

impl LocalStorage {
  // 创建笔记本
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

  // 重命名笔记本
  pub fn rename_notebook(&self, id: &str, name: &str)
    -> Result<Notebook, Box<dyn std::error::Error>> {
    let now = types::now_ms();
    self.conn.execute(
      "UPDATE notebooks SET name = ?1, updated_at = ?2 WHERE id = ?3",
      params![name, now, id],
    )?;
    self.get_notebook(id)
  }

  // 删除笔记本
  pub fn delete_notebook(&self, id: &str)
    -> Result<(), Box<dyn std::error::Error>> {
    self.conn.execute(
      "DELETE FROM notebooks WHERE id = ?1",
      params![id],
    )?;
    Ok(())
  }
}
```

### 前端实现（React + TypeScript）

#### 状态管理（src/stores/noteStore.tsx）

```typescript
export function useNoteStore() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // 创建笔记本
  const createNotebook = useCallback(
    async (name: string) => {
      try {
        const notebook = await tauriInvoke<Notebook>(
          'create_notebook',
          { name }
        );
        if (notebook) {
          await refreshNotebooks();
          showToast('success', '📒 已创建笔记本');
          return notebook;
        }
      } catch (error) {
        showToast('error', '创建笔记本失败');
        return null;
      }
    },
    [refreshNotebooks, showToast]
  );

  // 重命名笔记本
  const renameNotebook = useCallback(
    async (id: string, name: string) => {
      try {
        const notebook = await tauriInvoke<Notebook>(
          'rename_notebook',
          { id, name }
        );
        if (notebook) {
          await refreshNotebooks();
          showToast('success', '✏️ 已重命名笔记本');
          return notebook;
        }
      } catch (error) {
        showToast('error', '重命名失败');
        return null;
      }
    },
    [refreshNotebooks, showToast]
  );

  // 删除笔记本
  const deleteNotebook = useCallback(
    async (id: string) => {
      try {
        const ok = await tauriInvoke<boolean>(
          'delete_notebook',
          { id }
        );
        if (ok) {
          await refreshNotes();
          await refreshNotebooks();
          showToast('success', '🗑️ 已删除笔记本');
          return true;
        }
      } catch (error) {
        showToast('error', '删除失败');
        return false;
      }
    },
    [refreshNotes, refreshNotebooks, showToast]
  );

  return {
    notebooks,
    notes,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    // ... 其他方法
  };
}
```

#### UI 组件

##### NewNoteModal.tsx - 笔记创建模态框

```typescript
const TEMPLATES = [
  {
    id: 'blank',
    name: '空白笔记',
    icon: '📄',
    content: '',
  },
  {
    id: 'meeting',
    name: '会议记录',
    icon: '🗓️',
    content: '# 会议记录\n...',
  },
  // ... 更多模板
];

export function NewNoteModal({ open, notebooks, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [tags, setTags] = useState('');

  const handleCreate = async () => {
    await onCreate({
      title,
      notebookId,
      tags: tags.split(',').filter(Boolean),
      content: selectedTemplate.content,
    });
  };

  return (
    <div className="modal-backdrop">
      {/* 标题输入 */}
      <label>
        <span>标题</span>
        <input value={title} onChange={e => setTitle(e.target.value)} />
      </label>

      {/* 笔记本选择 */}
      <label>
        <span>笔记本</span>
        <select value={notebookId} onChange={e => setNotebookId(e.target.value)}>
          {notebooks.map(nb => (
            <option key={nb.id} value={nb.id}>
              {nb.icon} {nb.name}
            </option>
          ))}
        </select>
      </label>

      {/* 模板选择 */}
      <label>
        <span>模板</span>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
          {TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </label>

      {/* 标签输入 */}
      <label>
        <span>标签</span>
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="逗号分隔"
        />
      </label>

      {/* 创建按钮 */}
      <button onClick={handleCreate}>创建笔记</button>
    </div>
  );
}
```

##### NotebookModal.tsx - 笔记本管理模态框

```typescript
const NOTEBOOK_ICONS = [
  '📓', '📔', '📙', '📕', '📚', '📖', 
  '📝', '✏️', '📋', '📰', '📑', '🗂️'
];

export function NotebookModal({ state, onClose, onConfirm }) {
  const [name, setName] = useState(state.value);
  const [selectedIcon, setSelectedIcon] = useState(NOTEBOOK_ICONS[0]);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name, selectedIcon);
    }
  };

  return (
    <div className="modal-backdrop">
      {/* 名称输入 */}
      <label>
        <span>笔记本名称</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="输入笔记本名称"
        />
      </label>

      {/* 图标选择器 */}
      <div>
        <span>选择图标</span>
        <div className="icon-picker">
          {NOTEBOOK_ICONS.map(icon => (
            <button
              key={icon}
              onClick={() => setSelectedIcon(icon)}
              className={selectedIcon === icon ? 'selected' : ''}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <button onClick={onClose}>取消</button>
      <button onClick={handleConfirm}>
        {state.mode === 'create' ? '创建' : '重命名'}
      </button>
    </div>
  );
}
```

---

## 使用指南

### 创建笔记

1. **快捷键**: `Ctrl+N` (Windows/Linux) 或 `Cmd+N` (macOS)
2. **或点击**: 侧边栏"＋ 新建笔记"按钮
3. **填写信息**:
   - 标题（必填）
   - 选择笔记本
   - 选择模板（可选）
   - 添加标签（逗号分隔）
   - 编辑内容（可选）
4. **点击创建**: 确认创建笔记

### 创建笔记本

1. **点击**: 侧边栏"＋ 新建笔记本"按钮
2. **填写信息**:
   - 笔记本名称
   - 选择图标（12 个可选图标）
3. **点击创建**: 确认创建笔记本

### 管理笔记本

#### 重命名笔记本
- 右键点击笔记本 → 选择"重命名"
- 输入新名称 → 确认

#### 删除笔记本
- 右键点击笔记本 → 选择"删除"
- 确认删除（会级联删除所有笔记）

#### 查看笔记本统计
- 笔记本名称旁显示笔记数量
- 点击笔记本查看其中的笔记

### 笔记管理

#### 搜索笔记
- 侧边栏搜索框输入关键词
- 支持标题、内容、标签搜索

#### 筛选笔记
- 收藏笔记: 点击"收藏的笔记"
- 置顶笔记: 点击"已固定"
- 标签筛选: 点击标签名称

#### 标记笔记
- 收藏: 点击笔记旁的 ⭐ 图标
- 置顶: 点击笔记旁的 📌 图标

---

## API 参考

### Tauri 命令

#### 笔记相关

```rust
// 创建笔记
create_note(request: CreateNoteRequest) -> Result<Note, String>

// 获取笔记
get_note(id: String) -> Result<Note, String>

// 更新笔记
update_note(id: String, title?: String, content?: String, ...) -> Result<Note, String>

// 删除笔记
delete_note(id: String) -> Result<(), String>

// 列表笔记
list_notes() -> Result<Vec<Note>, String>

// 搜索笔记
search_notes(query: String) -> Result<Vec<SearchResult>, String>
```

#### 笔记本相关

```rust
// 创建笔记本
create_notebook(name: String) -> Result<Notebook, String>

// 列表笔记本
list_notebooks() -> Result<Vec<Notebook>, String>

// 重命名笔记本
rename_notebook(id: String, name: String) -> Result<Notebook, String>

// 删除笔记本
delete_notebook(id: String) -> Result<bool, String>
```

#### 标签相关

```rust
// 列表标签
list_tags() -> Result<Vec<String>, String>
```

---

## 错误处理和验证

### 前端验证

```typescript
// 笔记标题不能为空
if (!title.trim()) {
  showToast('error', '标题不能为空');
  return;
}

// 笔记本名称不能为空
if (!name.trim()) {
  showToast('error', '笔记本名称不能为空');
  return;
}

// 笔记本不能重复删除
if (activeNotebook === id) {
  showToast('info', '已自动切换到其他笔记本');
  setActiveNotebook('all');
}
```

### 后端验证

```rust
// SQLite 外键约束
PRAGMA foreign_keys = ON;

// 笔记本删除时级联删除笔记
notebook_id TEXT REFERENCES notebooks(id) ON DELETE CASCADE

// 唯一性约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_name ON tags(name)
```

---

## 性能优化

### 前端优化

1. **虚拟滚动**: 长列表使用虚拟滚动减少 DOM 节点
2. **懒加载**: 按需加载笔记内容
3. **防抖**: 搜索和自动保存使用防抖

### 后端优化

1. **数据库索引**:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_notes_notebook ON notes(notebook_id);
   CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
   ```

2. **查询优化**:
   - 分页查询: `LIMIT ? OFFSET ?`
   - 联接查询: `LEFT JOIN` 计算笔记本笔记数
   - 缓存: 版本信息缓存 5 分钟

3. **WAL 模式**: 提高并发写入能力

---

## 故障排除

### 笔记创建失败

**症状**: 创建笔记后没有显示
**解决**:
1. 检查笔记本是否存在
2. 查看浏览器控制台错误
3. 重启应用

### 笔记本删除后笔记消失

**症状**: 删除笔记本后笔记也删除了
**原因**: 这是预期行为（级联删除）
**恢复**: 无法直接恢复，但笔记可能在回收站或版本历史中

### 数据库锁定

**症状**: 执行操作时卡顿
**解决**:
1. 关闭其他占用数据库的进程
2. 检查 WAL 日志文件是否过大
3. 清理临时文件

---

## 最佳实践

### 笔记管理

- ✅ 为笔记添加有意义的标签，便于后续搜索
- ✅ 定期整理笔记本，删除过期的分类
- ✅ 使用模板快速创建结构化笔记
- ✅ 经常保存重要笔记到收藏

### 笔记本组织

- ✅ 创建主题明确的笔记本（如"工作"、"学习"、"生活"）
- ✅ 避免创建过多笔记本，3-5 个主要笔记本足够
- ✅ 定期检查笔记本中的笔记数量，超过 100 个可考虑拆分

### 备份和恢复

- ✅ 定期导出重要笔记
- ✅ 使用版本控制功能追踪重要改动
- ✅ 保留本地数据库备份

---

## 技术栈总结

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 | UI 框架 |
| 前端 | TypeScript | 类型安全 |
| 前端 | Zustand/Context | 状态管理 |
| 桌面 | Tauri 2 | 桌面框架 |
| 后端 | Rust | 高性能后端 |
| 后端 | Tokio | 异步运行时 |
| 存储 | SQLite | 本地数据库 |
| 存储 | rusqlite | SQLite 驱动 |
| 版本控制 | Git | 笔记版本追踪 |
| 搜索 | Tantivy | 全文搜索引擎 |

---

## 后续改进方向

- [ ] 笔记本嵌套/树形结构
- [ ] 笔记权限管理
- [ ] 协作编辑功能
- [ ] 云同步支持
- [ ] 富文本编辑增强
- [ ] AI 智能摘要
- [ ] 语音笔记转录

---

**版本**: 1.0  
**最后更新**: 2026-06-16  
**维护者**: NoteForge Team
