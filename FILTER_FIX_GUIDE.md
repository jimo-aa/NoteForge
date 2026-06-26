# 笔记本筛选功能修复方案

## 问题诊断

**症状**: 点击笔记本后，对应类型的笔记未正常展示在列表中

**根本原因分析**:

### 1. 类型字段映射问题

后端 Rust 代码使用：
```rust
pub struct NoteMeta {
    pub notebook_id: Option<String>,  // ← 蛇形命名
    // ...
}
```

前端 TypeScript 期望：
```typescript
interface NoteMeta {
    notebookId: string | null;  // ← 驼峰命名
    // ...
}
```

### 2. 序列化不一致

当后端返回 JSON 时，字段名应该被转换：
```json
{
    "id": "note-1",
    "notebookId": "notebook-1",    // 应该是这样
    "title": "Note Title",
    // ...
}
```

但实际可能返回的是：
```json
{
    "id": "note-1",
    "notebook_id": "notebook-1",   // ← 问题：这是蛇形
    "title": "Note Title",
    // ...
}
```

### 3. 过滤逻辑问题

前端过滤代码：
```typescript
if (activeNotebook !== 'all' && n.meta.notebookId !== activeNotebook) return false;
```

如果 `n.meta.notebookId` 是 `undefined` 或字段名不匹配，这个过滤就会失效。

---

## 修复方案

### 第一步：确保序列化正确（后端）

**文件: `core/src/types.rs`**

已经修改过，确保使用了 serde 属性：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    #[serde(rename = "notebookId")]  // ← 确保序列化为驼峰
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
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

### 第二步：修复前端过滤逻辑（关键）

**文件: `desktop/src/stores/noteStore.tsx`**

添加防御性代码，处理 `notebookId` 为 `null` 的情况：

```typescript
const filteredNotes = sortNotes(notes.filter((n) => {
  // 搜索过滤
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const inTitle = n.meta.title.toLowerCase().includes(q);
    const inTags = n.meta.tags.some((t) => t.toLowerCase().includes(q));
    const inContent = n.content.toLowerCase().includes(q);
    if (!inTitle && !inTags && !inContent) return false;
  }
  
  // ← 关键修复：笔记本过滤
  if (activeNotebook !== 'all') {
    // 获取笔记的笔记本ID，如果为空则使用 'default'
    const noteNotebookId = n.meta.notebookId || 'default';
    // 比较时确保两者都有值
    if (noteNotebookId !== activeNotebook) {
      return false;
    }
  }
  
  // 其他过滤条件
  if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
  if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
  if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
  
  return true;
}));
```

### 第三步：调试日志（可选但推荐）

**文件: `desktop/src/stores/noteStore.tsx`**

添加调试信息以诊断问题：

```typescript
const filteredNotes = sortNotes(notes.filter((n) => {
  // 搜索过滤
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const inTitle = n.meta.title.toLowerCase().includes(q);
    const inTags = n.meta.tags.some((t) => t.toLowerCase().includes(q));
    const inContent = n.content.toLowerCase().includes(q);
    if (!inTitle && !inTags && !inContent) return false;
  }
  
  // 笔记本过滤
  if (activeNotebook !== 'all') {
    const noteNotebookId = n.meta.notebookId || 'default';
    
    // 调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Filter] activeNotebook: ${activeNotebook}, noteNotebookId: ${noteNotebookId}, title: ${n.meta.title}`);
    }
    
    if (noteNotebookId !== activeNotebook) {
      return false;
    }
  }
  
  // 其他过滤条件...
  if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
  if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
  if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
  
  return true;
}));
```

### 第四步：验证笔记本列表更新

**文件: `desktop/src/stores/noteStore.tsx`**

确保笔记本列表正确关联笔记计数：

```typescript
const refreshNotebooks = useCallback(async () => {
  const backendNotebooks = await tauriInvoke<Notebook[]>('list_notebooks');
  if (backendNotebooks) {
    console.log('[refreshNotebooks] Notebooks from backend:', backendNotebooks);
    setNotebooks([ALL_NOTEBOOK, ...backendNotebooks]);
  } else {
    console.warn('[refreshNotebooks] Failed to fetch notebooks from backend');
    setNotebooks([ALL_NOTEBOOK]);
  }
}, []);
```

---

## 完整修复清单

### 后端 (Rust) - `core/src/types.rs`
- [x] 添加 `#[serde(rename = "notebookId")]` 到 `NoteMeta.notebook_id`
- [x] 添加 `#[serde(rename = "isPinned")]` 到 `NoteMeta.is_pinned`
- [x] 添加 `#[serde(rename = "isFavorite")]` 到 `NoteMeta.is_favorite`
- [x] 添加 `#[serde(rename = "wordCount")]` 到 `NoteMeta.word_count`
- [x] 添加 `#[serde(rename = "createdAt")]` 到 `NoteMeta.created_at`
- [x] 添加 `#[serde(rename = "updatedAt")]` 到 `NoteMeta.updated_at`

### 前端 (React) - `desktop/src/stores/noteStore.tsx`
- [ ] 修改笔记本过滤逻辑，添加默认值处理
- [ ] 添加调试日志
- [ ] 添加 null 值处理

---

## 测试步骤

### 测试 1: 基本筛选
1. 启动应用
2. 创建 2-3 个笔记本
3. 在每个笔记本中创建几个笔记
4. 点击左侧笔记本列表
5. ✅ 验证列表中只显示该笔记本的笔记

### 测试 2: 全部笔记
1. 点击"全部笔记"
2. ✅ 验证所有笔记都显示

### 测试 3: 混合筛选
1. 在一个笔记本中选择笔记
2. 添加标签筛选
3. ✅ 验证同时应用笔记本和标签过滤

### 测试 4: 笔记本计数
1. 创建笔记本和笔记
2. 查看笔记本旁的计数
3. ✅ 验证计数是否准确

---

## 数据流诊断

### 创建笔记时的数据流

```
前端 (React)
  ↓
用户选择笔记本 ID: "notebook-1"
  ↓
store.createNote(..., "notebook-1", ...)
  ↓
Tauri IPC → 后端
  ↓
create_note_note 插入数据库
  ├─ notebook_id = "notebook-1"
  └─ 创建成功
  ↓
后端返回 Note 对象
  ├─ Serde 序列化
  ├─ notebook_id → "notebookId" (驼峰)
  └─ 返回 JSON
  ↓
前端收到
  ├─ n.meta.notebookId = "notebook-1"
  └─ 正确!
```

### 筛选时的数据流

```
用户点击笔记本 "notebook-1"
  ↓
setActiveNotebook("notebook-1")
  ↓
filteredNotes 重新计算
  ├─ activeNotebook = "notebook-1"
  ├─ 遍历所有笔记
  ├─ 对每个笔记检查:
  │  ├─ n.meta.notebookId = "notebook-1" ✓ 包括
  │  ├─ n.meta.notebookId = "notebook-2" ✗ 排除
  │  └─ n.meta.notebookId = null/undefined → 使用 'default' 比较
  └─ 返回筛选后的笔记列表
  ↓
UI 更新显示
```

---

## 调试指南

### 在浏览器控制台检查数据

```javascript
// 打开浏览器开发者工具 (F12)

// 1. 检查笔记本 ID
console.log(store.activeNotebook);  // 应该显示选中的笔记本 ID

// 2. 检查笔记数据
console.log(store.notes[0]?.meta);  // 应该显示笔记元数据

// 3. 检查筛选结果
console.log(store.filteredNotes);  // 应该显示筛选后的笔记

// 4. 手动测试过滤逻辑
store.notes.filter(n => n.meta.notebookId === store.activeNotebook);
```

### 检查网络请求

1. 打开浏览器开发者工具 → Network 标签
2. 查看 Tauri IPC 调用
3. 检查返回的 JSON 数据格式

### 检查数据库

```bash
sqlite3 ~/.config/noteforge/noteforge.db

# 查看笔记本
SELECT id, name FROM notebooks;

# 查看笔记与笔记本的关系
SELECT id, title, notebook_id FROM notes;
```

---

## 常见问题

### Q: 为什么笔记本过滤不工作？

**可能原因:**
1. ✗ `notebookId` 字段未被正确序列化（蛇形 vs 驼峰）
2. ✗ 笔记的 `notebookId` 为 `null` 或 `undefined`
3. ✗ 过滤逻辑中 `activeNotebook` 为 `'all'` 而笔记 `notebookId` 为其他值
4. ✗ 笔记本列表与实际笔记不匹配

**解决方案:**
- [x] 检查 Serde 属性配置
- [x] 添加默认值处理
- [x] 验证过滤逻辑
- [x] 使用调试日志追踪数据

### Q: 如何清除笔记本过滤？

**步骤:**
1. 点击左侧 "全部笔记" 选项
2. 应该显示所有笔记

### Q: 新创建的笔记为什么不显示？

**检查清单:**
1. ✓ 笔记是否实际创建了（检查数据库）
2. ✓ 笔记的 `notebook_id` 是否正确设置
3. ✓ 是否刷新了笔记列表
4. ✓ 当前活跃笔记本是否是笔记所在的笔记本

---

## 完整的修复代码

### backend/core/src/types.rs

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    #[serde(rename = "notebookId")]
    pub notebook_id: Option<String>,
    pub tags: Vec<String>,
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

### frontend/desktop/src/stores/noteStore.tsx

```typescript
const filteredNotes = sortNotes(notes.filter((n) => {
  // 搜索过滤
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const inTitle = n.meta.title.toLowerCase().includes(q);
    const inTags = n.meta.tags.some((t) => t.toLowerCase().includes(q));
    const inContent = n.content.toLowerCase().includes(q);
    if (!inTitle && !inTags && !inContent) return false;
  }
  
  // 笔记本过滤 - 修复部分
  if (activeNotebook !== 'all') {
    // 关键修复：处理 notebookId 为 null 的情况
    const noteNotebookId = n.meta.notebookId || 'default';
    if (noteNotebookId !== activeNotebook) {
      return false;
    }
  }
  
  // 其他过滤
  if (currentFilter === 'favorites' && !n.meta.isFavorite) return false;
  if (currentFilter === 'pinned' && !n.meta.isPinned) return false;
  if (activeTags.length > 0 && !activeTags.every((tag) => n.meta.tags.includes(tag))) return false;
  
  return true;
}));
```

---

## 总结

笔记本筛选问题的三个主要原因：

1. **序列化问题**: Rust 的蛇形命名没有正确转换为 JavaScript 的驼峰命名
   → 解决: 使用 `serde(rename)` 属性

2. **Null 处理问题**: 笔记的 `notebookId` 可能为 `null`
   → 解决: 使用 `|| 'default'` 提供默认值

3. **过滤逻辑问题**: 过滤条件没有考虑 null 和默认值
   → 解决: 添加防御性代码处理边界情况

实施这些修复后，笔记本筛选功能应该能够正常工作。
