# 快速开发指南 - 搜索功能升级

## 🚀 快速开始

### 修改文件清单

#### ✅ 已完成的修改

```
后端 (Rust):
  ✓ core/src/search.rs                  - 搜索引擎增强
  ✓ desktop/src-tauri/src/commands.rs   - Tauri 命令更新

前端 (TypeScript/React):
  ✓ desktop/src/components/Sidebar/SearchBox.tsx  - 分页 UI
  ✓ desktop/src/styles/globals.css                - 分页样式
```

### 编译和运行

```bash
# 编译 Rust 后端
cargo build --release

# 运行前端
npm run dev

# 测试搜索功能
# 1. 打开搜索框 (Cmd+K)
# 2. 输入关键词
# 3. 查看分页导航
```

---

## 🔧 常用配置

### 改变每页数量

**文件**: `desktop/src/components/Sidebar/SearchBox.tsx`

```typescript
// 第 44 行
const pageSize = 5;  // 改为其他值，如 10、20
```

### 改变搜索结果上限

**文件**: `desktop/src-tauri/src/commands.rs`

```rust
// 第 200 行
pub fn search_notes(...) {
  state.core.lock()?
    .search.search(&query, 1000)  // 改为其他值
}
```

### 改变搜索防抖时间

**文件**: `desktop/src/components/Sidebar/SearchBox.tsx`

```typescript
// 第 90 行
const t = window.setTimeout(async () => {
  // ...
}, 300);  // 改为其他毫秒数，如 500
```

---

## 📝 代码注释

### 关键位置

#### 1. 前端分页状态

```typescript
// desktop/src/components/Sidebar/SearchBox.tsx:44-48
const [currentPage, setCurrentPage] = useState(0);      // 当前页码（0-indexed）
const [totalResults, setTotalResults] = useState(0);    // 总结果数
const inputRef = useRef<HTMLInputElement>(null);
const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const pageSize = 5;  // 每页显示5条
```

#### 2. 分页加载函数

```typescript
// desktop/src/components/Sidebar/SearchBox.tsx:136-165
const loadPage = async (pageNum: number) => {
  // 获取所有结果 → 切割当前页 → 设置状态
  // ...
};
```

#### 3. 搜索结果统计

```typescript
// desktop/src/components/Sidebar/SearchBox.tsx:249
{totalResults > 0 ? `${currentPageNum}/${totalPages} 页 (共 ${totalResults} 条)` : `${results.length} 条`}
```

#### 4. 分页导航按钮

```typescript
// desktop/src/components/Sidebar/SearchBox.tsx:310-339
{totalPages > 1 && (
  <div className="search-pagination">
    {/* 分页按钮 */}
  </div>
)}
```

---

## 🔍 调试技巧

### 1. 查看搜索日志

**后端日志**：
```bash
# 编译时启用日志
RUST_LOG=debug cargo run

# 查看日志输出
# [INFO] 🔍 搜索完成: 'xxx' - 100 条结果
# [INFO] 🔍 分页搜索完成: 'xxx' - 偏移量: 5, 限制: 5 - 返回 5 条
```

**前端日志**：
```typescript
// 浏览器控制台会显示
console.log('Search error:', error);
```

### 2. 查看搜索结果

```typescript
// 在浏览器控制台
// 1. 打开搜索框
// 2. 检查 Network 标签
// 3. 查看 Tauri 命令的返回值

// 或在代码中调试
console.log('All results:', allResults);
console.log('Page results:', pageResults);
console.log('Total pages:', totalPages);
```

### 3. 性能分析

```typescript
// 添加性能计时
console.time('search');
const results = await tauriInvoke('search_notes', { query });
console.timeEnd('search');
```

---

## 🧪 测试用例

### 单元测试（Rust）

```rust
#[test]
fn test_search_pagination() {
    let dir = tempdir().unwrap();
    let mut engine = SearchEngine::open(dir.path().join("index")).unwrap();
    
    // 添加 100 条笔记
    for i in 0..100 {
        engine.add_note(
            &i.to_string(),
            &format!("Note {}", i),
            "搜索关键词",
            &[],
            now_ms()
        ).unwrap();
    }
    
    // 测试分页
    let options = SearchOptions { limit: 5, offset: 0 };
    let page1 = engine.search_paginated("关键词", options).unwrap();
    assert_eq!(page1.len(), 5);
    
    let options = SearchOptions { limit: 5, offset: 5 };
    let page2 = engine.search_paginated("关键词", options).unwrap();
    assert_eq!(page2.len(), 5);
}
```

### 集成测试（TypeScript）

```typescript
// 测试分页交互
test('should paginate search results', async () => {
  // 1. 打开搜索框
  // 2. 输入搜索词
  // 3. 等待结果加载
  // 4. 验证第1页显示5条
  // 5. 点击下一页
  // 6. 验证第2页显示正确结果
  // 7. 点击上一页
  // 8. 验证回到第1页
});
```

---

## 📊 示例数据

### 搜索结果示例

```typescript
SearchResult {
  note_id: "abc123",
  title: "Python 数据分析教程",
  snippet: "本教程介绍了 Python 在数据分析中的应用...",
  score: 0.95,
  updated_at: 1687891200000
}

// score 范围: 0.0 - 1.0
// 显示为: 95% (score * 100)
```

### 分页状态示例

```typescript
currentPage = 0           // 第1页
pageSize = 5             // 每页5条
totalResults = 245       // 总共245条结果
totalPages = 49          // 共49页

// 显示
currentPageNum = 1       // 1/49 页
```

---

## 🐛 常见问题解决

### Q1: 搜索无结果

**问题**：搜索输入后没有结果

**排查步骤**：
1. 检查笔记是否已创建
2. 检查搜索引擎是否初始化
3. 检查笔记是否已被索引

```rust
// 在 add_note 时检查日志
info!("📝 笔记已索引: {} (ID: {})", title, id);
```

### Q2: 翻页很慢

**问题**：点击下一页响应缓慢

**排查步骤**：
1. 检查结果数量（太多会慢）
2. 检查浏览器性能
3. 检查网络延迟

```typescript
// 添加性能计时
const start = performance.now();
await loadPage(pageNum);
const end = performance.now();
console.log(`翻页耗时: ${end - start}ms`);
```

### Q3: 分页按钮不显示

**问题**：没有看到分页导航

**原因**：
- 结果 < 5 条（单页）
- CSS 未加载
- 条件判断有误

```typescript
// 检查条件
console.log('totalPages:', totalPages);
console.log('show pagination:', totalPages > 1);
```

### Q4: 高亮不工作

**问题**：选择结果后没有高亮

**排查**：
1. 检查 CSS 样式是否加载
2. 检查 `highlightedId` 状态
3. 检查超时设置

```typescript
// 检查高亮状态
console.log('highlightedId:', highlightedId);
console.log('item.noteId:', item.noteId);
```

---

## 🔄 更新流程

### 如需调整功能

1. **更改页大小**
   ```typescript
   // SearchBox.tsx 第 44 行
   const pageSize = 10;  // 改为 10
   ```

2. **更改搜索限制**
   ```rust
   // commands.rs 第 200 行
   .search(&query, 2000)  // 改为 2000
   ```

3. **更改防抖时间**
   ```typescript
   // SearchBox.tsx 第 90 行
   }, 500);  // 改为 500ms
   ```

4. **重新编译并测试**
   ```bash
   cargo build --release
   npm run dev
   ```

---

## 📦 依赖检查

### 确保已安装

```bash
# Rust 依赖
# - tantivy (搜索)
# - jieba-rs (分词)
# - serde (序列化)

# TypeScript 依赖
# - react (前端框架)
# - @tauri-apps/api (Tauri 通信)
```

### 验证依赖版本

```bash
# Rust
cargo tree | grep tantivy

# Node
npm list | grep react
```

---

## ✅ 最终验收清单

- [ ] 搜索能返回 1000+ 条结果
- [ ] 分页导航按钮显示正确
- [ ] 翻页加载新结果
- [ ] 修改搜索词重置页码
- [ ] 高亮功能仍然工作
- [ ] 相关性分数显示正确
- [ ] 没有控制台错误
- [ ] 性能流畅（< 150ms）

---

## 📞 获取帮助

### 查看详细文档

- `SEARCH_UPGRADE_COMPLETE.md` - 完整升级说明
- `SEARCH_PAGINATION_ENHANCEMENT.md` - 分页功能详解
- `SEARCH_BOX_FIX_DETAILS.md` - 搜索框修复记录

### 查看代码

- 搜索引擎：`core/src/search.rs`
- 搜索框 UI：`desktop/src/components/Sidebar/SearchBox.tsx`
- 样式：`desktop/src/styles/globals.css`

---

**最后更新** 2026-06-27  
**维护者** NoteForge Team  
**版本** 1.2
