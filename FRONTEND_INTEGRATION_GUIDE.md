# NoteForge 前端功能集成指南

## 文件清单

本次实现为NoteForge添加了以下前端文件：

### 新增组件文件

#### 1. **DiffViewerModal.tsx** 
位置: `desktop/src/components/Modals/DiffViewerModal.tsx`

**功能**：版本对比与Diff查看器
- 展示两个版本之间的详细差异
- 显示相似度评分
- 统计行数、字数变化
- 支持可配置的上下文行数（1/3/5/10行）
- 行级别的add/remove/modify操作展示

**使用示例**：
```tsx
<DiffViewerModal 
  open={showDiffViewer}
  noteId={noteId}
  fromVersion={versionId1}
  toVersion={versionId2}
  onClose={() => setShowDiffViewer(false)}
/>
```

#### 2. **MilestoneModal.tsx**
位置: `desktop/src/components/Modals/MilestoneModal.tsx`

**功能**：里程碑管理界面
- 创建、编辑、删除里程碑
- 快速切换到历史里程碑版本
- 支持版本号、标签、描述
- 显示创建时间和关键元数据

**使用示例**：
```tsx
<MilestoneModal 
  open={showMilestones}
  noteId={noteId}
  onClose={() => setShowMilestones(false)}
  onCheckout={handleCheckout}
/>
```

#### 3. **VersionSearchModal.tsx**
位置: `desktop/src/components/Modals/VersionSearchModal.tsx`

**功能**：版本搜索界面
- 在版本历史中搜索
- 全局笔记搜索
- 显示版本计数和最新版本信息
- 实时搜索反馈

**使用示例**：
```tsx
<VersionSearchModal 
  open={showSearch}
  noteId={noteId}
  onClose={() => setShowSearch(false)}
  onSelect={handleSelectVersion}
/>
```

#### 4. **ExportBackupModal.tsx**
位置: `desktop/src/components/Modals/ExportBackupModal.tsx`

**功能**：导出和备份管理
- 导出为Markdown/HTML/JSON格式
- 单个笔记或整个笔记本导出
- 笔记备份到本地文件
- 从备份恢复笔记

**使用示例**：
```tsx
<ExportBackupModal 
  open={showExportBackup}
  noteId={noteId}
  noteTitle={title}
  notebookId={notebookId}
  notebookName={notebookName}
  onClose={() => setShowExportBackup(false)}
/>
```

#### 5. **AdvancedFeaturesToolbar.tsx**
位置: `desktop/src/components/Modals/AdvancedFeaturesToolbar.tsx`

**功能**：集成所有高级功能的工具栏
- 一键访问所有高级功能
- 版本对比快速入口
- 里程碑管理快速入口
- 版本搜索快速入口
- 导出/备份快速入口

**使用示例**：
```tsx
<AdvancedFeaturesToolbar 
  noteId={noteId}
  noteTitle={noteTitle}
  notebookId={notebookId}
  notebookName={notebookName}
  onVersionRestored={() => {
    // 版本被恢复后的回调
  }}
/>
```

### 新增类型定义

#### **advanced-features.ts**
位置: `desktop/src/types/advanced-features.ts`

包含所有高级功能相关的TypeScript类型定义：
- `DiffOperation`, `ChangeSummary`, `DiffResult`
- `Milestone`
- `VersionSearchResult`, `VersionMetadata`
- `CacheStats`, `ExportFormat`, `BackupConfig`

### 新增样式文件

#### **advanced-features.css**
位置: `desktop/src/styles/advanced-features.css`

完整的样式定义，包括：
- 工具栏样式
- 模态框样式
- Diff查看器样式
- 里程碑卡片样式
- 响应式设计支持

## 集成到编辑器

### 步骤1：导入新组件

在 `Editor.tsx` 中添加导入：

```tsx
import { AdvancedFeaturesToolbar } from '@/components/Modals/AdvancedFeaturesToolbar';
```

### 步骤2：在编辑器UI中添加工具栏

在编辑器的适当位置添加工具栏：

```tsx
{note && (
  <AdvancedFeaturesToolbar 
    noteId={note.meta.id}
    noteTitle={note.meta.title}
    notebookId={note.meta.notebookId}
    notebookName={notebookName}
    onVersionRestored={() => {
      // 重新加载笔记内容
      loadNote(note.meta.id);
    }}
  />
)}
```

### 步骤3：导入样式

在 `App.tsx` 或主样式文件中导入新的样式：

```tsx
import '@/styles/advanced-features.css';
```

## 前端集成示例

### 完整的编辑器集成

```tsx
import { Editor as MonacoEditor } from '@/components/Editor/Editor';
import { AdvancedFeaturesToolbar } from '@/components/Modals/AdvancedFeaturesToolbar';
import { VersionControlModal } from '@/components/Modals/VersionControlModal';
import '@/styles/advanced-features.css';

export function NoteEditor({ noteId, notebookId }) {
  const [note, setNote] = useState(null);
  const [showVersionControl, setShowVersionControl] = useState(false);

  const handleVersionRestored = async () => {
    // 重新加载笔记
    const updatedNote = await invoke('get_note', { id: noteId });
    setNote(updatedNote);
  };

  return (
    <div className="editor-container">
      {note && (
        <>
          <AdvancedFeaturesToolbar 
            noteId={note.meta.id}
            noteTitle={note.meta.title}
            notebookId={notebookId}
            notebookName="当前笔记本"
            onVersionRestored={handleVersionRestored}
          />
          <MonacoEditor value={note.content} onChange={(v) => setNote({...note, content: v})} />
          <VersionControlModal 
            open={showVersionControl}
            noteId={noteId}
            onClose={() => setShowVersionControl(false)}
            onCheckoutVersion={checkoutVersion}
            onCheckoutBranch={checkoutBranch}
            onCreateBranch={createBranch}
            onRestore={handleVersionRestored}
          />
        </>
      )}
    </div>
  );
}
```

## CSS主题变量

确保在全局CSS中定义以下主题变量：

```css
:root {
  /* 背景色 */
  --background-primary: #ffffff;
  --background-secondary: #f9fafb;
  --surface-secondary: #f3f4f6;
  --surface-tertiary: #e5e7eb;
  
  /* 文本色 */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  
  /* 边框 */
  --border-color: #e5e7eb;
  
  /* 强调色 */
  --accent-primary: #3b82f6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background-primary: #1f2937;
    --background-secondary: #111827;
    --surface-secondary: #374151;
    --surface-tertiary: #4b5563;
    --text-primary: #f3f4f6;
    --text-secondary: #d1d5db;
    --text-tertiary: #9ca3af;
    --border-color: #4b5563;
    --accent-primary: #60a5fa;
  }
}
```

## 关键API调用

### 后端API映射

| 功能 | API命令 | 说明 |
|------|--------|------|
| Diff对比 | `compare_versions_with_context` | 获取版本差异 |
| 创建里程碑 | `create_milestone` | 创建新里程碑 |
| 列出里程碑 | `list_milestones` | 获取所有里程碑 |
| 切换里程碑 | `checkout_milestone` | 恢复到里程碑版本 |
| 搜索版本 | `search_versions` | 搜索版本历史 |
| 全局搜索 | `search_notes_with_versions` | 全局搜索包含版本信息 |
| 导出笔记 | `export_note` | 导出为指定格式 |
| 导出笔记本 | `export_notebook` | 导出整个笔记本 |
| 备份笔记 | `backup_note` | 创建笔记备份 |
| 恢复备份 | `restore_note` | 从备份恢复笔记 |
| 缓存统计 | `get_cache_stats` | 获取缓存统计信息 |

## 错误处理

所有Tauri命令调用都应该包装在try-catch中：

```tsx
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`Command ${cmd} failed:`, error);
    showToast('error', `操作失败: ${error}`);
    return null;
  }
}
```

## 性能优化建议

1. **使用缓存版本**：在频繁调用的地方使用 `*_cached` 后缀的API
   ```tsx
   // 推荐 - 使用缓存
   const versions = await invoke('list_note_versions_cached', { note_id: noteId });
   
   // 不推荐 - 每次都查询
   const versions = await invoke('list_note_versions', { note_id: noteId });
   ```

2. **防抖搜索**：在搜索框中加入防抖逻辑
   ```tsx
   const [searchQuery, setSearchQuery] = useState('');
   
   useEffect(() => {
     const timer = setTimeout(() => {
       performSearch(searchQuery);
     }, 300);
     return () => clearTimeout(timer);
   }, [searchQuery]);
   ```

3. **懒加载模态框内容**：只在模态框打开时才加载数据
   ```tsx
   useEffect(() => {
     if (!open) return;
     loadMilestones();
   }, [open]);
   ```

## 测试清单

- [ ] Diff查看器显示正确的差异
- [ ] 里程碑可以创建、编辑、删除
- [ ] 搜索功能正确过滤版本
- [ ] 导出为各种格式成功
- [ ] 备份和恢复功能正常
- [ ] 响应式设计在小屏幕上正确显示
- [ ] 深色主题支持
- [ ] 错误消息正确显示

## 下一步

1. **集成到主编辑器** - 将工具栏添加到Editor.tsx
2. **测试功能** - 验证所有功能正常工作
3. **优化性能** - 根据实际使用情况调整缓存策略
4. **用户文档** - 为用户编写功能说明
5. **快捷键支持** - 添加键盘快捷键（如Ctrl+Shift+D打开Diff）

---

**文档版本**: 1.0  
**最后更新**: 2026-06-26  
**状态**: ✅ 就绪
