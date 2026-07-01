# NoteForge 智能知识库设计文档

> 在现有笔记系统基础上，升级为**智能知识库平台**。支持多格式文件导入、AI 自动整理与分类、桌面端语义搜索、以及 MCP 服务对外暴露知识接口。

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NoteForge 智能知识库                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌────────────────────────────────────┐  │
│  │    知识生产（Ingestion）      │    │    知识消费（Retrieval）            │  │
│  │                             │    │                                    │  │
│  │ 文件上传 → 解析 → AI 提取     │    │ 桌面搜索 → 语义/全文 → 片段/文档   │  │
│  │   → 分类 → 索引 → 存储      │    │  RAG 问答 → LLM + 上下文          │  │
│  └──────────┬──────────────────┘    └──────────┬─────────────────────────┘  │
│             │                                   │                           │
│             ▼                                   ▼                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        知识存储层                                     │   │
│  │                                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │   │
│  │  │PostgreSQL│  │  MinIO   │  │  Tantivy │  │    向量索引       │    │   │
│  │  │ 知识元数据│  │ 原始文件  │  │ 全文索引  │  │ pgvector/Milvus   │    │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       MCP 服务层                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐   │   │
│  │  │ Search Tool  │  │ Retrieve Tool│  │  Resource Templates       │   │   │
│  │  │ 知识搜索      │  │ 知识检索      │  │  knowledge://{id}/chunk  │   │   │
│  │  └──────────────┘  └──────────────┘  └───────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 整体概念

| 层次 | 职责 | 技术选型 |
|------|------|---------|
| **知识生产** | 文件上传、格式解析、AI 提取与分类、知识化存储 | Rust (解析) + Python (AI) |
| **知识存储** | 知识文档、原始文件、全文索引、向量索引 | PostgreSQL + MinIO + Tantivy + pgvector |
| **知识检索** | 语义搜索、全文搜索、RAG 问答、片段高亮 | Tantivy + pgvector + LLM |
| **MCP 服务** | 对外暴露标准接口，供 AI 工具调用 | Python FastAPI + MCP SDK |

### 1.2 与现有系统的关系

```
现有 NoteForge:
┌─────────────────┐
│  笔记 (Markdown)  │ ← 用户手写
│  笔记本/标签      │
│  本地存储 + 云端   │
└─────────────────┘

升级后 NoteForge:
┌──────────────────────────────────────┐
│  笔记 (Markdown) ← 用户手写           │
│  知识文档 (AI 生成) ← 文件导入         │  ← 新增
│  笔记本/标签/AI 分类                  │  ← 增强
│  统一搜索 (全文 + 语义)               │  ← 增强
│  MCP 服务 (对外暴露)                  │  ← 新增
│  本地存储 + 云端 + 原始文件存储        │  ← 增强
└──────────────────────────────────────┘
```

---

## 二、知识文档模型

### 2.1 核心数据模型

```typescript
// 知识文档（Knowledge Document）- 文件导入后的产物
interface KnowledgeDoc {
  id: string;                    // UUID
  sourceFileName: string;        // 原始文件名，如 "架构设计.pptx"
  sourceFileType: string;        // 文件类型: pdf / docx / pptx / xlsx / txt / code
  sourceFileSize: number;        // 原始文件大小 (bytes)
  sourceFileHash: string;        // SHA-256，用于去重
  sourceFileUrl: string;         // MinIO 中原始文件的访问路径

  // AI 处理结果
  title: string;                 // AI 自动提取/生成的标题
  summary: string;               // AI 自动生成的摘要 (200-500 字)
  content: string;               // AI 整理后的 Markdown 正文
  contentPlain: string;          // 纯文本版本（用于搜索）
  wordCount: number;             // 字数统计

  // 分类信息
  category: string;              // 一级分类: 技术文档/项目管理/设计稿/数据报表/代码库/通用
  tags: string[];                // AI 自动标签 + 用户自定义
  notebookId: string | null;     // 所属笔记本（可选）

  // 知识结构
  headings: { level: number; text: string }[];  // 目录结构
  keyTerms: string[];            // AI 提取的关键术语/概念
  entities: { name: string; type: string }[];    // NER 实体（人名/项目/技术栈）

  // 元数据
  userId: string;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

// 知识块（Chunk）- 用于向量检索和片段搜索
interface KnowledgeChunk {
  id: string;
  docId: string;                 // 所属 KnowledgeDoc
  index: number;                 // 块序号
  content: string;               // 块内容
  heading: string;               // 所在章节标题
  embedding: number[];           // 向量 (1536d)
  tokenCount: number;            // token 数
}
```

### 2.2 数据库表扩展

在现有 `notes` 表基础上，新增知识文档相关表：

```sql
-- ============================================================
-- 知识文档表（新增）
-- ============================================================
CREATE TABLE knowledge_docs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notebook_id       UUID REFERENCES notebooks(id) ON DELETE SET NULL,

    -- 源文件信息
    source_file_name  VARCHAR(512) NOT NULL,
    source_file_type  VARCHAR(32) NOT NULL,   -- pdf/docx/pptx/xlsx/txt/code
    source_file_size  BIGINT NOT NULL DEFAULT 0,
    source_file_hash  VARCHAR(64) NOT NULL,
    source_file_url   VARCHAR(1024) NOT NULL,  -- MinIO 路径

    -- AI 处理结果
    title             VARCHAR(1024) NOT NULL DEFAULT '',
    summary           TEXT NOT NULL DEFAULT '',
    content           TEXT NOT NULL DEFAULT '',        -- Markdown 正文
    content_plain     TEXT NOT NULL DEFAULT '',        -- 纯文本（搜索用）
    word_count        INT NOT NULL DEFAULT 0,

    -- 分类
    category          VARCHAR(64) NOT NULL DEFAULT 'general',
    tags              TEXT[] NOT NULL DEFAULT '{}',     -- PostgreSQL array

    -- 知识结构（JSON）
    headings          JSONB NOT NULL DEFAULT '[]',
    key_terms         JSONB NOT NULL DEFAULT '[]',
    entities          JSONB NOT NULL DEFAULT '[]',

    -- 状态
    status            VARCHAR(16) NOT NULL DEFAULT 'processing',
                      -- processing / parsed / embedding / ready / failed
    error_message     TEXT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,

    -- 时间
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, source_file_hash)
);

CREATE INDEX idx_knowledge_docs_user     ON knowledge_docs(user_id) WHERE NOT is_deleted;
CREATE INDEX idx_knowledge_docs_type     ON knowledge_docs(source_file_type);
CREATE INDEX idx_knowledge_docs_category ON knowledge_docs(category);
CREATE INDEX idx_knowledge_docs_status   ON knowledge_docs(status);
CREATE INDEX idx_knowledge_docs_updated  ON knowledge_docs(updated_at DESC);

-- 全文搜索（PostgreSQL 兜底）
CREATE INDEX idx_knowledge_docs_fts ON knowledge_docs USING GIN(
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_plain, ''))
);


-- ============================================================
-- 知识块表（新增）- 向量检索粒度
-- ============================================================
CREATE TABLE knowledge_chunks (
    id                BIGSERIAL PRIMARY KEY,
    doc_id            UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
    chunk_index       INT NOT NULL,
    content           TEXT NOT NULL,
    heading           VARCHAR(512) NOT NULL DEFAULT '',
    token_count       INT NOT NULL DEFAULT 0,
    embedding         VECTOR(1536),                  -- text-embedding-3-small
    model             VARCHAR(64) DEFAULT 'text-embedding-3-small',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_chunks_doc ON knowledge_chunks(doc_id, chunk_index);
CREATE INDEX idx_knowledge_chunks_vec ON knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ============================================================
-- 文件上传记录表（新增）- 跟踪导入历史
-- ============================================================
CREATE TABLE upload_jobs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name         VARCHAR(512) NOT NULL,
    file_type         VARCHAR(32) NOT NULL,
    file_size         BIGINT NOT NULL,
    file_hash         VARCHAR(64) NOT NULL,
    storage_path      VARCHAR(1024) NOT NULL,         -- MinIO 路径
    status            VARCHAR(16) NOT NULL DEFAULT 'uploaded',
                      -- uploaded / parsing / ai_extracting / embedding / completed / failed
    error_message     TEXT,
    doc_id            UUID REFERENCES knowledge_docs(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_upload_jobs_user  ON upload_jobs(user_id);
CREATE INDEX idx_upload_jobs_status ON upload_jobs(status);
```

### 2.3 Rust 类型扩展

```rust
// core/src/types.rs — 新增知识文档类型

/// 知识文档元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeDocMeta {
    pub id: String,
    pub user_id: String,
    pub source_file_name: String,
    pub source_file_type: String,
    pub source_file_size: u64,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub tags: Vec<String>,
    pub word_count: u32,
    pub status: String,
    pub created_at: u64,
    pub updated_at: u64,
}

/// 知识块
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeChunk {
    pub id: i64,
    pub doc_id: String,
    pub chunk_index: i32,
    pub content: String,
    pub heading: String,
}

/// 上传任务
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadJob {
    pub id: String,
    pub file_name: String,
    pub file_type: String,
    pub file_size: u64,
    pub status: String,
    pub created_at: u64,
}
```

---

## 三、文件导入与 AI 处理管道

### 3.1 完整流程

```
用户拖拽/选择文件
       │
       ▼
┌─────────────────────────────┐
│  1. 文件接收                │
│  ├── Tauri 文件对话框 / 拖拽 │
│  ├── 计算 SHA-256 哈希      │
│  └── 上传至 MinIO 存储       │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  2. 格式解析                │
│  ├── PDF   → pdf-extract    │
│  ├── DOCX  → docx-rs        │
│  ├── PPTX  → pptx-rs / xml  │
│  ├── XLSX  → calamine       │
│  ├── TXT   → 直接读取       │
│  └── Code  → syntect (语法) │
│  → 统一输出纯文本 + 结构信息  │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  3. AI 智能提取             │
│  ├── 标题生成               │
│  ├── 摘要生成 (200-500字)    │
│  ├── 关键术语提取            │
│  ├── 实体识别 (NER)         │
│  └── 知识分类               │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  4. 格式化输出              │
│  ├── 生成 Markdown 正文     │
│  ├── 保持文档结构 (目录)     │
│  └── 嵌入原始引用链接        │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  5. 分块与向量化            │
│  ├── 语义分块 (≤512 tokens)  │
│  ├── 生成 Embedding         │
│  └── 存入 pgvector          │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│  6. 全文索引                │
│  ├── Tantivy 更新索引       │
│  ├── 标题/正文/标签多字段   │
│  └── 中文分词 (jieba-rs)    │
└──────────┬──────────────────┘
           ▼
      处理完成 → 桌面端展示
```

### 3.2 文件格式解析策略

| 格式 | Rust 方案 | 备用方案 | 提取内容 |
|------|----------|---------|---------|
| **PDF** | `pdf-extract` / `lopdf` | Python `pypdf` | 文本、标题层级、表格 |
| **DOCX** | `docx-rs` | Python `python-docx` | 文本、标题、列表、表格 |
| **PPTX** | 自解析 XML (OpenXML) | Python `python-pptx` | 幻灯片文本、备注 |
| **XLSX** | `calamine` | Python `openpyxl` | 表格数据、sheet 名 |
| **TXT** | `std::fs::read_to_string` | — | 纯文本，自动检测编码 |
| **代码** | `syntect` (语法高亮) | — | 代码内容、语言检测、注释提取 |
| **Markdown** | `pulldown-cmark` (已有) | — | 保留原始 Markdown |

> **设计决策**: 对于复杂格式（PDF 表格、PPTX 图表），采用 Rust 主解析 + Python 兜底的双轨策略。Rust 解析器处理 80% 的常规场景，遇到无法解析的格式时 fallback 到 Python AI Service。

### 3.3 AI 提取与分类设计

```python
# ai-service/knowledge/extractor.py — AI 知识提取服务

"""
LLM Prompt 策略：

系统指令:
  你是一个知识文档处理专家。你的任务是将用户上传的原始文档内容
  转化为结构化、可读性强的知识文档。

阶段 1 — 内容整理:
  输入: 原始解析文本（可能包含格式噪声）
  输出: 结构化的 Markdown 文档
  规则:
    - 保留原始文档的标题层级
    - 自动修正混乱的格式
    - 为无标题文档生成合适的标题
    - 表格转为 Markdown 表格格式
    - 代码块标注语言类型

阶段 2 — 摘要提取:
  输入: 整理后的 Markdown
  输出: 200-500 字的摘要

阶段 3 — 知识标签:
  输入: 整理后的 Markdown
  输出: 分类 + 标签列表 + 关键术语

阶段 4 — 实体识别:
  输入: 整理后的 Markdown
  输出: 实体列表 [{name, type}]
  type 取值: 技术栈 / 项目名 / 人名 / 公司 / 概念
"""

# LLM 路由策略
LLM_ROUTES = {
    "content_clean":    "claude-3-haiku",     # 快速、低成本
    "summary":          "claude-3-sonnet",    # 需要理解能力
    "classification":   "claude-3-haiku",     # 简单分类
    "ner":              "gpt-4o-mini",        # 实体识别
}

# 分类体系（一级分类）
CATEGORIES = [
    "技术文档",      # API 文档、技术方案、架构设计
    "项目管理",      # 项目计划、需求文档、会议纪要
    "设计稿",        # UI 设计、原型图说明、设计规范
    "数据报表",      # 数据分析、统计报表、Excel 表格
    "代码库",        # 源码文件、配置文件、脚本
    "学术文献",      # 论文、研究报告、技术白皮书
    "商务文档",      # 合同、报价、提案
    "通用知识",      # 其他无法明确分类的内容
]
```

### 3.4 分块策略

```python
# ai-service/knowledge/chunker.py

def chunk_document(content: str, doc_structure: dict) -> list[Chunk]:
    """
    智能分块策略：

    1. 按标题层级分块（优先）
       - 每个 <h2>/<h3> 章节作为一个独立块
       - 过长的章节（>512 tokens）递归分割

    2. 语义分块（后备）
       - 使用滑动窗口，窗口大小 256 tokens
       - 重叠 32 tokens 保证上下文连续性

    3. 特殊处理
       - 代码块保持完整，不分块
       - 表格保持完整，不分块
       - 列表项保持在同一块中
    """
    ...
```

---

## 四、桌面端知识管理功能

### 4.1 新增 UI 组件

```
desktop/src/
├── components/
│   ├── Knowledge/                   ← 新增：知识管理模块
│   │   ├── KnowledgePanel.tsx       ← 知识库主面板（侧边栏入口）
│   │   ├── KnowledgeList.tsx        ← 知识文档列表
│   │   ├── KnowledgeViewer.tsx      ← 知识文档阅读器
│   │   ├── KnowledgeUploader.tsx    ← 文件上传对话框
│   │   ├── KnowledgeSearch.tsx      ← 知识专属搜索
│   │   ├── KnowledgeCategoryTree.tsx ← 分类树
│   │   └── KnowledgeChunkView.tsx   ← 块级查看
│   └── Common/
│       └── FileIcon.tsx             ← 文件类型图标组件
├── stores/
│   ├── knowledgeStore.ts            ← 新增：知识文档状态管理
│   └── context.ts                   ← 更新：整合 knowledgeStore
├── services/
│   ├── knowledgeService.ts          ← 新增：知识文档 API
│   └── uploadService.ts             ← 新增：文件上传服务
└── types/
    └── knowledge.ts                 ← 新增：知识文档类型定义
```

### 4.2 桌面端 Tauri 命令扩展

```rust
// desktop/src-tauri/src/commands.rs — 新增命令

/// 上传文件并开始处理（异步）
#[tauri::command]
async fn upload_file(
    state: State<'_, AppState>,
    file_path: String,
    notebook_id: Option<String>,
) -> Result<UploadJob, String> {
    // 1. 计算文件哈希
    // 2. 上传到 MinIO
    // 3. 创建 UploadJob 记录
    // 4. 发送到 AI 处理队列（RabbitMQ）
    // 5. 返回 UploadJob（前端轮询进度）
}

/// 获取知识文档列表
#[tauri::command]
fn list_knowledge_docs(
    state: State<'_, AppState>,
    category: Option<String>,
    tag: Option<String>,
    page: u32,
    size: u32,
) -> Result<Vec<KnowledgeDocMeta>, String>;

/// 获取知识文档详情
#[tauri::command]
fn get_knowledge_doc(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<KnowledgeDocDetail, String>;

/// 搜索知识文档（全文 + 语义混合）
#[tauri::command]
fn search_knowledge(
    state: State<'_, AppState>,
    query: String,
    mode: String,    // fulltext / semantic / hybrid
    category: Option<String>,
    page: u32,
) -> Result<KnowledgeSearchResult, String>;

/// 获取知识块（用于片段展示）
#[tauri::command]
fn get_knowledge_chunks(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<Vec<KnowledgeChunk>, String>;

/// 删除知识文档
#[tauri::command]
fn delete_knowledge_doc(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<(), String>;

/// 重新 AI 处理
#[tauri::command]
fn reprocess_knowledge_doc(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<(), String>;
```

### 4.3 知识库主界面交互

```
┌──────────────────────────────────────────────────────────────┐
│  NoteForge — 智能知识库                                       │
├────────┬─────────────────────────────────────────────────────┤
│        │  🔍 [搜索所有知识...                    ] 🔄 刷新    │
│  笔记   │                                                     │
│        │  ┌─ 分类筛选 ────────────────────────────────────┐   │
│  知识库 │  │ 全部 (42) │ 技术文档 (18) │ 代码库 (8) │ ... │   │
│        │  └──────────────────────────────────────────────┘   │
│  搜索   │                                                     │
│        │  ┌──────────────────────────────────────────────┐   │
│  管理   │  │ 📄 系统架构设计方案.pdf           2026-06-29 │   │
│        │  │    摘要: 本文介绍了微服务架构的分层设计...    │   │
│  ─────  │  │    分类: 技术文档  ·  标签: 架构/微服务    │   │
│  新建   │  ├──────────────────────────────────────────────┤   │
│        │  │ 📊 Q2 数据分析报告.xlsx           2026-06-28 │   │
│        │  │    摘要: 第二季度用户增长 30%，MAU 突破...   │   │
│        │  │    分类: 数据报表  ·  标签: 季度/Q2/分析    │   │
│        │  ├──────────────────────────────────────────────┤   │
│        │  │ 🐍 user_service.py                  2026-06-27 │   │
│        │  │    摘要: 用户微服务核心实现，包含 JWT 认证...  │   │
│        │  │    分类: 代码库  ·  标签: Python/Flask/JWT  │   │
│        │  └──────────────────────────────────────────────┘   │
│        │                                      [上传文件]     │
├────────┴─────────────────────────────────────────────────────┤
│  状态栏: 已索引 42 个知识文档 · 存储空间 156 MB              │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 知识文档阅读器

```
┌──────────────────────────────────────────────────────────────┐
│  ← 返回列表    系统架构设计方案.pdf              [重新处理]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 目录                              📝 正文               │
│  ───────                              ──────                │
│  □ 1. 项目背景                        # 系统架构设计方案     │
│  □ 2. 技术选型                                               │
│    □ 2.1 后端框架                    > 摘要: 本文档详细描    │
│    □ 2.2 数据库选择                    述了系统的分层架构    │
│    □ 2.3 前端技术                      设计和技术选型理由    │
│  □ 3. 架构设计                      ─────────────────────     │
│    □ 3.1 分层架构                                            │
│    □ 3.2 微服务拆分                  ## 1. 项目背景          │
│  □ 4. 数据流                        本项目旨在构建一个...    │
│  □ 5. 部署方案                                             │
│                                    ## 2. 技术选型           │
│  🏷 标签                               | 2.1 后端框架         │
│  架构 / 微服务 / 系统设计              我们选择了 Spring...   │
│                                     ─────────────────────     │
│  📊 关键术语                                                 │
│  · 微服务架构                          🔗 关联知识           │
│  · CQRS 模式                           · API 设计规范.md     │
│  · 事件驱动                            · 数据库设计文档      │
│                                     ─────────────────────     │
│  原文件: 下载 PDF                      片段数: 24个          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 文件上传对话框

```
┌────────────────────────────────────┐
│  导入知识文件                        │
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │      📁 拖拽文件到此处       │  │
│  │     或点击选择文件           │  │
│  │                              │  │
│  │  支持: PDF/DOCX/PPTX/XLSX/   │  │
│  │  TXT/代码文件                │  │
│  └──────────────────────────────┘  │
│                                    │
│  目标笔记本: [架构文档 ▼]          │
│                                    │
│  ┌── 已选择文件 ────────────────┐  │
│  │ 📄 系统架构设计方案.pdf  5MB  │  │
│  │ 📊 Q2数据报告.xlsx      2MB  │  │
│  │ 🐍 user_service.py    156KB  │  │
│  └──────────────────────────────┘  │
│                                    │
│           [取消]    [开始导入]      │
└────────────────────────────────────┘
```

---

## 五、搜索系统增强

### 5.1 混合搜索架构

```
用户输入查询
      │
      ▼
┌─────────────────────────────────┐
│  查询处理                        │
│  ├── 中文分词 (jieba-rs)        │
│  ├── 拼音纠错                   │
│  ├── 同义词扩展                  │
│  └── 意图识别 (笔记/知识/全部)   │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┐
    ▼                  ▼
┌────────────┐  ┌────────────┐
│ 全文搜索    │  │ 语义搜索    │
│ (Tantivy)  │  │ (pgvector) │
│            │  │            │
│ BM25 评分  │  │ 余弦相似度  │
│ Top-30     │  │ Top-30     │
└──────┬─────┘  └──────┬─────┘
       │               │
       └───────┬───────┘
               ▼
┌─────────────────────────────────┐
│  RRF 融合排序                   │
│  Reciprocal Rank Fusion        │
│  Top-10 结果                   │
└────────────┬────────────────────┘
             ▼
┌─────────────────────────────────┐
│  结果后处理                      │
│  ├── 片段提取与高亮              │
│  ├── 来源文档信息拼接            │
│  └── 关联知识推荐               │
└────────────┬────────────────────┘
             ▼
       返回搜索结果
```

### 5.2 搜索结果格式

```typescript
interface KnowledgeSearchResult {
  total: number;
  results: KnowledgeSearchHit[];
  // RAG 就绪
  ragContext: {
    chunks: string[];           // Top-5 片段内容
    sources: string[];          // 来源文档标题
    totalTokens: number;        // 总 token 数
  };
}

interface KnowledgeSearchHit {
  doc: KnowledgeDocMeta;
  score: number;
  highlight: {
    title: string;              // 带 <mark> 标签的标题
    content: string;            // 带 <mark> 标签的片段
  };
  matchedChunks: {
    content: string;            // 匹配的块内容
    heading: string;            // 所在章节标题
    score: number;
  }[];
  sourceType: 'note' | 'knowledge';
}
```

### 5.3 RAG 就绪接口

桌面搜索功能不仅展示结果，还需提供 **"RAG 就绪"** 的输出格式，可直接传入 LLM 作为外置知识库：

```typescript
// 搜索结果的 RAG 上下文
interface RAGContext {
  // 拼接好的上下文文本（可直接放入 LLM prompt）
  context: string;
  
  // 格式示例：
  // === 知识片段 1 ===
  // 来源: 系统架构设计方案.pdf (技术文档)
  // 内容: [匹配的知识片段]
  // === 知识片段 2 ===
  // 来源: user_service.py (代码库)
  // 内容: [匹配的知识片段]
  
  totalTokens: number;          // 总 token 数
  chunks: {
    content: string;            // 片段内容
    source: string;             // 来源文档标题
    sourceType: string;         // 文档类型
    docId: string;              // 文档 ID
    chunkId: number;            // 块 ID
  }[];
}
```

---

## 六、MCP 服务设计

### 6.1 架构概览

MCP (Model Context Protocol) 是 Anthropic 推出的标准协议，允许 AI 模型通过统一接口与外部工具和数据源交互。NoteForge 知识库通过 MCP 服务，将知识检索能力暴露给任何支持 MCP 的 AI 工具（Claude Desktop、Cline、Cursor 等）。

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP 生态系统                              │
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐             │
│  │ Claude     │    │ Cline      │    │ Cursor     │  ...更多 AI │
│  │ Desktop    │    │ (VS Code)  │    │ (IDE)      │    工具      │
│  └──────┬─────┘    └──────┬─────┘    └──────┬─────┘             │
│         │                │                 │                     │
│         └────────────────┴─────────────────┘                     │
│                          │ MCP 协议 (stdio/SSE)                  │
│                          ▼                                       │
│              ┌─────────────────────────┐                        │
│              │  NoteForge MCP Server   │                        │
│              │  ┌───────────────────┐  │                        │
│              │  │  Tools            │  │                        │
│              │  │  ├─ search        │  │                        │
│              │  │  ├─ retrieve      │  │                        │
│              │  │  └─ query         │  │                        │
│              │  ├───────────────────┤  │                        │
│              │  │  Resources        │  │                        │
│              │  │  ├─ knowledge://  │  │                        │
│              │  │  └─ note://       │  │                        │
│              │  ├───────────────────┤  │                        │
│              │  │  Prompts          │  │                        │
│              │  │  ├─ knowledge_qa  │  │                        │
│              │  │  └─ summarize     │  │                        │
│              │  └───────────────────┘  │                        │
│              └──────────┬──────────────┘                        │
│                         │                                        │
│              ┌──────────▼──────────────┐                        │
│              │  NoteForge Backend API  │                        │
│              │  (Java Spring Boot)     │                        │
│              └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 MCP 服务技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| **MCP 框架** | Python `mcp` SDK (官方) | MCP 官方支持，生态最完善 |
| **传输层** | SSE (HTTP) + stdio | SSE 适合远程场景，stdio 适合本地 |
| **认证** | API Key + JWT 可选 | 简单部署用 API Key，生产环境用 JWT |
| **部署** | Docker + 反向代理 | 与现有 infra 一致 |

### 6.3 完整的 MCP 工具定义

```python
# ai-service/mcp/server.py — MCP Server 实现

"""
NoteForge MCP Server
====================

传输方式:
  - stdio:    Claude Desktop / Cline 本地调用
  - SSE:      远程部署 (http://host:8100/mcp)

认证:
  - stdio 模式: 无需认证（本地）
  - SSE 模式:   请求头 Authorization: Bearer <api_key>
"""

import mcp.types as types
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions

# ============================================================
# Tool 1: knowledge_search — 知识搜索
# ============================================================

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="knowledge_search",
            description="搜索知识库，返回匹配的知识文档和片段（支持语义搜索 + 全文搜索混合检索）",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词（支持中文和英文）",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["hybrid", "semantic", "fulltext"],
                        "description": "搜索模式: hybrid=混合(默认), semantic=语义, fulltext=全文",
                        "default": "hybrid",
                    },
                    "category": {
                        "type": "string",
                        "description": "按分类筛选（可选）: 技术文档/代码库/数据报表/项目管理/设计稿/学术文献/商务文档/通用知识",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "按标签筛选（可选）",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回结果数量 (默认: 5, 最大: 20)",
                        "default": 5,
                        "maximum": 20,
                    },
                    "include_chunks": {
                        "type": "boolean",
                        "description": "是否包含匹配的知识片段 (默认: true)",
                        "default": True,
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="knowledge_retrieve",
            description="通过文档 ID 获取知识文档的完整内容或指定片段",
            inputSchema={
                "type": "object",
                "properties": {
                    "doc_id": {
                        "type": "string",
                        "description": "知识文档 ID",
                    },
                    "include_chunks": {
                        "type": "boolean",
                        "description": "是否包含分块内容 (默认: false)",
                        "default": False,
                    },
                    "chunk_range": {
                        "type": "string",
                        "description": "片段范围，如 '0-5' 表示第0到第5块（可选）",
                    },
                },
                "required": ["doc_id"],
            },
        ),
        types.Tool(
            name="knowledge_query",
            description="直接提问知识库（RAG），返回基于知识库的答案并附引用来源",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "用户问题",
                    },
                    "knowledge_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "限定搜索范围的知识文档 ID 列表（可选，不传则搜索全部）",
                    },
                    "max_tokens": {
                        "type": "integer",
                        "description": "答案最大 token 数 (默认: 2048)",
                        "default": 2048,
                    },
                },
                "required": ["question"],
            },
        ),
    ]


# ============================================================
# Tool 实现
# ============================================================

@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict
) -> list[types.TextContent | types.EmbeddedResource]:
    
    if name == "knowledge_search":
        results = await knowledge_service.search(
            query=arguments["query"],
            mode=arguments.get("mode", "hybrid"),
            category=arguments.get("category"),
            tags=arguments.get("tags"),
            limit=min(arguments.get("limit", 5), 20),
            include_chunks=arguments.get("include_chunks", True),
        )
        return [types.TextContent(
            type="text",
            text=json.dumps(results, ensure_ascii=False, indent=2),
        )]

    elif name == "knowledge_retrieve":
        doc = await knowledge_service.get_document(
            doc_id=arguments["doc_id"],
            include_chunks=arguments.get("include_chunks", False),
            chunk_range=arguments.get("chunk_range"),
        )
        return [types.TextContent(
            type="text",
            text=json.dumps(doc, ensure_ascii=False, indent=2),
        )]

    elif name == "knowledge_query":
        answer = await rag_pipeline.answer(
            question=arguments["question"],
            knowledge_ids=arguments.get("knowledge_ids"),
            max_tokens=arguments.get("max_tokens", 2048),
        )
        return [types.TextContent(
            type="text",
            text=json.dumps(answer, ensure_ascii=False, indent=2),
        )]


# ============================================================
# Resource Templates — 知识文档资源
# ============================================================

@server.list_resource_templates()
async def handle_list_resource_templates() -> list[types.ResourceTemplate]:
    return [
        types.ResourceTemplate(
            uriTemplate="knowledge://{doc_id}",
            name="知识文档全文",
            description="获取知识文档的完整 Markdown 内容",
            mimeType="text/markdown",
        ),
        types.ResourceTemplate(
            uriTemplate="knowledge://{doc_id}/chunk/{chunk_index}",
            name="知识文档片段",
            description="获取知识文档的指定片段",
            mimeType="text/plain",
        ),
        types.ResourceTemplate(
            uriTemplate="knowledge://search/{query}",
            name="知识搜索结果",
            description="搜索并返回结构化结果",
            mimeType="application/json",
        ),
    ]


# ============================================================
# Prompts — 预定义的提示模板
# ============================================================

@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return [
        types.Prompt(
            name="knowledge_qa",
            description="基于知识库回答问题",
            arguments=[
                types.PromptArgument(
                    name="question",
                    description="用户问题",
                    required=True,
                ),
            ],
        ),
        types.Prompt(
            name="summarize_knowledge",
            description="对知识文档进行摘要",
            arguments=[
                types.PromptArgument(
                    name="doc_id",
                    description="文档 ID",
                    required=True,
                ),
            ],
        ),
    ]


# ============================================================
# 启动入口
# ============================================================

def main():
    server = Server("noteforge-mcp")
    # 注册 handlers ...
    
    if sys.argv[1] == "stdio":
        # Claude Desktop / Cline 本地调用
        from mcp.server.stdio import stdio_server
        ...
    elif sys.argv[1] == "sse":
        # 远程部署
        from mcp.server.sse import sse_server
        ...
```

### 6.4 MCP 接口规格速查

| 工具/资源 | 描述 | AI 工具使用场景 |
|-----------|------|---------------|
| `knowledge_search` | 搜索知识库，返回文档+片段 | "查一下我们项目的架构文档" |
| `knowledge_retrieve` | 获取文档全文或指定片段 | "把这份 API 设计文档发给我" |
| `knowledge_query` | RAG 问答 | "根据我们的知识库，解释一下这个项目的技术架构" |
| `knowledge://{id}` | 文档全文资源 | Claude 直接读取文档内容 |
| `knowledge://{id}/chunk/{idx}` | 文档片段资源 | 引用特定知识片段 |

### 6.5 MCP 使用示例

#### 场景 1: Claude Desktop 用户查询

```
用户: "帮我查一下我们项目的数据库设计"

Claude → 调用 knowledge_search(query="数据库设计", mode="hybrid")
      ← 返回: [文档 "数据库设计文档.md", 片段 "采用 PostgreSQL + pgvector..."]

Claude → 调用 knowledge_retrieve(doc_id="xxx", include_chunks=true)
      ← 返回: 完整 Markdown + 分块内容

Claude: "根据我们的知识库，项目采用 PostgreSQL 16 作为主数据库，
         并启用 pgvector 扩展用于向量存储。以下是详细设计..."
```

#### 场景 2: Cline (VS Code) 开发辅助

```
用户: "帮我看一下这段代码所属项目的 API 规范"

Cline → 调用 knowledge_search(query="API 设计规范", category="技术文档")
     ← 返回: 匹配的文档列表

Cline → 读取 knowledge://{id} 资源
     ← 返回: 完整 API 规范文档

Cline: "根据项目知识库中的 API 设计规范，RESTful API 遵循以下约定..."
```

---

## 七、AI 处理服务架构

### 7.1 服务模块

```
ai-service/                          ← Python FastAPI 服务
├── main.py                          ← 服务入口
├── mcp/
│   ├── server.py                    ← MCP Server 实现
│   ├── tools.py                     ← MCP 工具逻辑
│   └── resources.py                 ← MCP 资源处理
├── knowledge/
│   ├── extractor.py                 ← AI 内容提取（调用 LLM）
│   ├── classifier.py               ← 自动分类与打标签
│   ├── chunker.py                   ← 智能分块
│   ├── summarizer.py                ← 摘要生成
│   └── ner.py                       ← 实体识别
├── rag/
│   ├── pipeline.py                  ← RAG 问答管道
│   ├── retriever.py                 ← 检索器（向量 + 全文）
│   └── reranker.py                  ← 重排序
├── core/
│   ├── llm_client.py                ← LLM 调用封装（多模型）
│   ├── embeddings.py                ← Embedding 生成
│   └── models.py                    ← Pydantic 数据模型
├── queue/
│   └── consumer.py                  ← RabbitMQ 消费者
└── requirements.txt
```

### 7.2 LLM 调用策略

```python
# ai-service/core/llm_client.py

class LLMClient:
    """
    多模型路由策略：
    
    | 任务             | 模型               | 理由                 |
    |------------------|-------------------|----------------------|
    | 内容整理/清洗     | Claude 3 Haiku    | 快速、成本低          |
    | 摘要生成          | Claude 3 Sonnet   | 需要理解能力          |
    | 分类打标签        | Claude 3 Haiku    | 简单分类任务          |
    | 实体识别          | GPT-4o-mini       | NER 能力强           |
    | RAG 问答          | Claude 3 Sonnet   | 综合回答质量高        |
    | Embedding         | text-embedding-3  | 标准向量             |
    | 本地 Embedding    | BGE-small-zh      | 离线场景             |
    """
    
    MODELS = {
        "content_clean":  "claude-3-haiku-20240307",
        "summary":        "claude-3-sonnet-20240229",
        "classification": "claude-3-haiku-20240307",
        "ner":            "gpt-4o-mini",
        "rag":            "claude-3-sonnet-20240229",
        "embedding":      "text-embedding-3-small",
    }
```

### 7.3 异步处理队列

```
文件上传 → RabbitMQ → AI Service 消费

Queue: knowledge.process
┌──────────────────────────────────────┐
│  Message:                            │
│  {                                   │
│    "job_id": "uuid",                 │
│    "user_id": "uuid",                │
│    "file_url": "minio://...",        │
│    "file_type": "pdf",               │
│    "file_hash": "sha256...",         │
│    "notebook_id": "uuid|null"        │
│  }                                   │
└──────────────────────────────────────┘

处理状态流转:
  uploaded → parsing → ai_extracting → embedding → completed
                                       → failed (重试 3 次)
```

---

## 八、项目实施计划

### 8.1 开发阶段

```
Phase 1: 基础设施与核心管道 (3 周)
├── Week 1: 数据库表创建 + Rust 知识文档 CRUD + MinIO 上传
├── Week 2: Python AI Service 骨架 + 文件解析器集成
├── Week 3: AI 提取管道（内容整理 + 摘要 + 分类 + 分块 + 向量化）

Phase 2: 桌面端知识管理 (2 周)
├── Week 4: 知识库 UI（列表/阅读器/上传对话框/分类树）
├── Week 5: 桌面端搜索增强（混合搜索 + 片段高亮 + RAG 就绪输出）

Phase 3: MCP 服务 (1 周)
├── Week 6: MCP Server 开发 + 集成测试

Phase 4: 集成与打磨 (1 周)
├── Week 7: 端到端测试 + 性能优化 + Docker Compose 更新
```

### 8.2 技术债务与后续规划

| 项目 | 当前方案 | 生产方案 |
|------|---------|---------|
| 文档解析 | Rust 原生 + Python fallback | 统一 Rust 解析管道 |
| 向量存储 | pgvector (IVFFlat) | Milvus + pgvector 双写 |
| Embedding | text-embedding-3-small | BGE-large-zh 本地化 |
| MCP 传输 | stdio + SSE | 支持 WebSocket |
| 文件预览 | 简单的 Markdown 渲染 | PDF/Office 原生预览嵌入 |

### 8.3 新增依赖

**Rust (Cargo.toml)**:
```toml
pdf-extract = "0.7"        # PDF 文本提取
calamine = "0.26"          # Excel (.xlsx) 读取
zip = "2"                  # Office OpenXML 解析
syntect = "5"              # 代码语法高亮
```

**Python (requirements.txt)**:
```text
mcp>=1.0.0                # MCP Server SDK
fastapi>=0.115.0           # AI Service 框架
pypdf>=5.0.0               # PDF 备用解析
python-docx>=1.1.0         # DOCX 备用解析
python-pptx>=1.0.0         # PPTX 备用解析
openpyxl>=3.1.0            # XLSX 备用解析
httpx>=0.28.0              # LLM API 客户端
numpy>=2.0.0               # 向量计算
aio-pika>=9.5.0            # RabbitMQ 异步客户端
```

**Node.js (package.json - Tauri plugin)**:
```json
{
  "dependencies": {
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0"
  }
}
```

### 8.4 Docker Compose 扩展

```yaml
# infra/docker-compose.yml — 新增服务

ai-service:
  build:
    context: ../ai-service
    dockerfile: Dockerfile
  container_name: noteforge-ai
  depends_on:
    rabbitmq:
      condition: service_started
    postgres:
      condition: service_healthy
  environment:
    LLM_API_KEY: ${LLM_API_KEY}
    LLM_ENDPOINT: https://api.anthropic.com
    EMBEDDING_API_KEY: ${OPENAI_API_KEY}
    DATABASE_URL: jdbc:postgresql://postgres:5432/noteforge
    RABBITMQ_URL: amqp://guest:guest@rabbbitmq:5672
    MINIO_ENDPOINT: http://minio:9000
    MINIO_ACCESS_KEY: noteforge
    MINIO_SECRET_KEY: noteforge123
  ports:
    - "8100:8000"   # AI Service REST API
    - "8101:8101"   # MCP Server SSE
  networks:
    - noteforge-net

# 新增: RabbitMQ（原策划案有但 docker-compose 中缺失）
rabbitmq:
  image: rabbitmq:3-management-alpine
  container_name: noteforge-rabbitmq
  ports:
    - "5672:5672"
    - "15672:15672"
  networks:
    - noteforge-net
```

---

## 九、关键设计决策记录

### 9.1 为什么知识文档与笔记分离？

| 方案 | 优点 | 缺点 |
|------|------|------|
| ✅ **分离表** (knowledge_docs + notes) | 职责清晰、查询优化独立、可分别控制权限 | 需要额外联合查询 |
| ❌ 统一 notes 表 + type 字段 | 简单、搜索天然统一 | 字段膨胀、索引效率低、语义差异大 |

**结论**: 分离存储，搜索层统一。`knowledge_docs` 包含文件特有的字段（source_file_*、key_terms、entities），与 `notes` 的字段差异过大，不适合共用一张表。

### 9.2 为什么向量嵌入存在 PostgreSQL 而非单独部署 Milvus？

参照现有设计的决策：MVP 阶段 pgvector 够用，减少运维复杂度。当知识文档超过 10 万条时再引入 Milvus。

### 9.3 为什么 MCP 用 Python 而非 Rust？

- MCP 官方 SDK 优先支持 Python/TypeScript
- AI Service (Python) 已经承载了 LLM 调用逻辑，MCP 与其同属一个服务
- 减少跨语言调用开销
- 后续可考虑用 Rust 重写 MCP Server 以获得更低延迟

### 9.4 为什么保留原始文件？

- 用户可能需要下载原始文件
- AI 提取可能存在信息丢失，原始文件是最终参考
- MinIO 对象存储成本低，保留原始文件几乎没有负担

---

## 十、架构总览图

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          NoteForge 智能知识库 — 完整架构                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                           桌面端 (Tauri Desktop)                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │ 笔记模块   │  │ 知识库模块 │  │ 搜索模块      │  │ 知识图谱模块         │   │  │
│  │  │ Markdown  │  │ 文档列表  │  │ 混合搜索      │  │ GraphView (已有)    │   │  │
│  │  │ 编辑器    │  │ 文件上传  │  │ 片段高亮      │  │ + 知识文档节点       │   │  │
│  │  │ 版本管理  │  │ AI 分类   │  │ RAG 就绪输出  │  │                     │   │  │
│  │  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  └──────────────────────┘   │  │
│  │       │              │               │                                      │  │
│  │       └──────────────┴───────────────┘                                      │  │
│  │                     │ Tauri Commands                                        │  │
│  └─────────────────────┼──────────────────────────────────────────────────────┘  │
│                        │                                                         │
│  ┌─────────────────────┼──────────────────────────────────────────────────────┐  │
│  │              Rust 核心引擎 (noteforge-core)                                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │ md-engine │  │ storage  │  │ search   │  │ crypto   │  │ parser   │   │  │
│  │  │ Markdown  │  │ SQLite   │  │ Tantivy  │  │ AES+GCM  │  │ PDF/DOCX │   │  │
│  │  │ 解析/渲染  │  │ CRUD     │  │ 全文索引  │  │ 加密     │  │ PPTX/... │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                         │
│  ┌─────────────────────┼──────────────────────────────────────────────────────┐  │
│  │                     │    后端服务 (Backend)                                  │  │
│  │  ┌──────────────────┴────────────────────────────────────────────────────┐ │  │
│  │  │                  API Gateway (Nginx)                                  │ │  │
│  │  └──┬───────────┬───────────┬───────────┬───────────┬───────────────────┘ │  │
│  │     │           │           │           │           │                     │  │
│  │  ┌──▼──┐  ┌────▼───┐  ┌───▼────┐  ┌───▼────┐  ┌───▼────────┐          │  │
│  │  │note │  │ user   │  │ sync   │  │ search │  │ knowledge  │          │  │
│  │  │svc  │  │ svc    │  │ svc    │  │ svc    │  │ svc (新增)  │          │  │
│  │  │Java │  │ Java   │  │ Java   │  │ Java   │  │ Java       │          │  │
│  │  └─────┘  └────────┘  └────────┘  └────────┘  └─────┬───────┘          │  │
│  │                                                      │                  │  │
│  │  ┌───────────────────────────────────────────────────┴──────────────┐  │  │
│  │  │                Message Queue (RabbitMQ)                          │  │  │
│  │  │    knowledge.process · search.index · ai.task                    │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                         │
│  ┌─────────────────────┼──────────────────────────────────────────────────────┐  │
│  │                     │    AI 智能服务层                                       │  │
│  │  ┌──────────────────┴────────────────────────────────────────────────────┐ │  │
│  │  │              AI Service (Python FastAPI)                               │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │  │
│  │  │  │ 知识提取    │  │ 智能分类    │  │ RAG 问答   │  │ MCP Server   │   │  │
│  │  │  │ extractor  │  │ classifier │  │ pipeline   │  │ mcp/server   │   │  │
│  │  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬───────┘   │  │
│  │  │         │               │               │               │            │  │
│  │  │         └───────────────┴───────────────┴───────────────┘            │  │
│  │  │                              │ LLM API                               │  │
│  │  │                    Claude / GPT / 本地模型                           │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                         │
│  ┌─────────────────────┼──────────────────────────────────────────────────────┐  │
│  │                     │    数据存储层                                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │PostgreSQL│  │  MinIO   │  │  Redis   │  │ Tantivy  │  │ RabbitMQ │   │  │
│  │  │ +pgvector│  │ 对象存储  │  │ 缓存     │  │ 本地索引  │  │ 消息队列  │   │  │
│  │  │ 元数据   │  │ 原始文件  │  │ 队列     │  │ 全文搜索  │  │ 异步任务  │   │  │
│  │  │ 向量     │  │          │  │ Session  │  │ (客户端)  │  │          │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 附录 A: 与现有系统的集成点

| 现有模块 | 变更类型 | 说明 |
|---------|---------|------|
| `core/src/types.rs` | 新增 | 添加 `KnowledgeDocMeta`、`KnowledgeChunk` 等类型 |
| `core/src/storage.rs` | 新增 | 添加 `knowledge_docs`、`knowledge_chunks` 表的 SQLite CRUD（桌面端本地缓存） |
| `core/src/search.rs` | 增强 | 增加知识文档的索引字段和混合搜索逻辑 |
| `desktop/src-tauri/src/commands.rs` | 新增命令 | 添加 `upload_file`、`list_knowledge_docs`、`search_knowledge` 等 |
| `desktop/src/components/` | 新增目录 | 添加 `Knowledge/` 组件目录 |
| `desktop/src/stores/` | 新增 | 添加 `knowledgeStore.ts` |
| `desktop/src/App.tsx` | 修改 | 侧边栏增加"知识库"入口 |
| `backend/` | 新增模块 | 新增 `knowledge-service` 子模块 |
| `infra/docker-compose.yml` | 扩展 | 添加 RabbitMQ、AI Service |

---

*文档版本: v1.0*
*最后更新: 2026-06-30*
