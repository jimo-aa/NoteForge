# NoteForge — 全平台智能笔记系统

## 项目策划案 v1.0

---

## 一、项目概述

### 1.1 项目定位

**NoteForge** 是一个"AI 原生"的全平台智能笔记系统，定位介于 Notion 和 Obsidian 之间——既有 Notion 的协作和数据库能力，又有 Obsidian 的本地优先和双向链接，再加上 AI 原生的智能写作、知识图谱和语义搜索。

### 1.2 核心差异

```
┌───────────────────────────────────────────────────┐
│               笔记 App 市场格局                       │
├──────────────┬──────────────┬────────────────────┤
│   Obsidian    │    Notion     │   NoteForge 🆕     │
│               │               │                    │
│  ✅ 本地优先   │  ✅ 协作强大   │  ✅ 本地优先        │
│  ✅ 双向链接   │  ✅ 数据库     │  ✅ 全平台          │
│  ✅ 插件生态   │  ✅ 模板丰富   │  ✅ AI 原生         │
│  ❌ 同步付费   │  ❌ 纯云端     │  ✅ 端到端加密      │
│  ❌ 移动端弱   │  ❌ 离线弱     │  ✅ 离线优先        │
│  ❌ 无 AI      │  ❌ AI 半残   │  ✅ 知识图谱        │
└──────────────┴──────────────┴────────────────────┘
```

### 1.3 目标用户

| 用户画像 | 痛点 | NoteForge 解决方案 |
|---------|------|-------------------|
| 🧑‍💻 **开发者** | 笔记散落各处、技术文档管理 | Markdown 原生 + Git 集成 + 代码块高亮 |
| 🎓 **学生/研究员** | 知识管理混乱、难以回顾 | AI 知识图谱 + 自动摘要 + 间隔复习 |
| 📝 **创作者** | 写作生产力低 | AI 写作助手 + 素材库 + 多端同步 |
| 🏢 **团队** | 知识库难维护 | 实时协作 + 结构化数据库 + 权限管理 |

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NoteForge Architecture                        │
└─────────────────────────────────────────────────────────────────────┘

┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐
│  Desktop   │  │    Web    │  │  Mobile   │  │   Extension       │
│  (Tauri)   │  │  (React)  │  │ (Flutter) │  │  (Chrome/VS Code) │
│  Rust Core │  │  PWA      │  │  iOS/And  │  │                   │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────────┬──────────┘
      │              │              │                  │
      └──────────────┴──────────────┴──────────────────┘
                      │  HTTPS / WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway (Kong / Nginx)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Note    │ │  User    │ │  Sync    │ │  Search  │ │  AI      │ │
│  │  Service │ │  Service │ │  Service │ │  Service │ │  Service │ │
│  │  (Java)  │ │  (Java)  │ │  (Java)  │ │  (Java)  │ │ (Python) │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       │            │            │            │            │       │
│       └────────────┴────────────┴────────────┴────────────┘       │
│                              │                                      │
│                    Message Queue (RabbitMQ)                         │
│                              │                                      │
├──────────────────────────────┴──────────────────────────────────────┤
│                         Data Layer                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │PostgreSQL │  │  Redis   │  │ MinIO    │  │Elastic   │           │
│  │+pgvector  │  │          │  │ 对象存储  │  │ Search   │           │
│  │ 主数据库   │  │ 缓存/队列 │  │ 文件附件  │  │ 全文搜索  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │  Milvus  │  │  Prom    │  │  Loki    │                         │
│  │  向量库   │  │  +Grafana│  │  日志    │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈选型

| 层级 | 技术 | 选型理由 |
|------|------|---------|
| **桌面端** | **Tauri 2.x + React 19** | Rust 内核性能好、体积小（< 5MB）、安全，React 生态丰富 |
| **Web 端** | **React 19 + Next.js 15** | SSR + PWA，首屏快，SEO 友好 |
| **移动端** | **Flutter 3.x** | 一套代码 iOS/Android，Skia 渲染性能好 |
| **桌面核心引擎** | **Rust** | Markdown 解析、全文索引、加密、本地数据库 |
| **后端微服务** | **Java 21 + Spring Boot 3.x** | 成熟稳定、生态完善、虚拟线程 |
| **API 网关** | **Kong / Spring Cloud Gateway** | 统一鉴权、限流、路由 |
| **主数据库** | **PostgreSQL 16 + pgvector** | 关系+向量一体，替代多个数据库 |
| **缓存** | **Redis 7** | 缓存、Session、实时协作、限流 |
| **搜索引擎** | **Elasticsearch 8** | 全文搜索、语义搜索、高亮 |
| **对象存储** | **MinIO** | S3 兼容，自托管，图片/附件 |
| **消息队列** | **RabbitMQ** | 异步任务：索引构建、AI 处理 |
| **向量数据库** | **Milvus / pgvector** | 知识检索、语义相似度 |
| **监控** | **Prometheus + Grafana + Loki** | 指标/日志/链路追踪 |
| **容器化** | **Docker + Kubernetes** | 弹性伸缩、灰度发布 |
| **CI/CD** | **GitHub Actions + ArgoCD** | 自动化构建部署 |

### 2.3 核心数据流

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  用户输入  │────▶│  Rust 内核    │────▶│  本地存储        │
│  笔记内容  │     │  Markdown    │     │  SQLite (离线)   │
│  (任意端)  │     │  解析/渲染    │     │  加密            │
└──────────┘     └──────┬───────┘     └──────────────────┘
                        │ 同步触发
                        ▼
               ┌────────────────┐
               │  Sync Service   │
               │  冲突解决(CRDT) │
               │  增量同步       │
               └────┬─────┬─────┘
                    │     │
                    ▼     ▼
          ┌──────────┐ ┌──────────┐
          │PostgreSQL│ │  MinIO   │
          │ 笔记数据  │ │ 附件/图片 │
          └────┬─────┘ └──────────┘
               │ 异步事件
               ▼
          ┌──────────┐     ┌──────────┐
          │RabbitMQ  │────▶│  AI      │
          │          │     │  Service │
          └──────────┘     │·摘要/标签 │
                           │·向量化   │
          ┌──────────┐     │·知识图谱 │
          │Elastic   │◀────│·问答     │
          │ Search   │     └──────────┘
          │ 索引      │
          └──────────┘
```

---

## 三、功能设计

### 3.1 功能全景

```
NoteForge 功能矩阵
├── 📝 笔记核心
│   ├── Markdown 编辑器 (所见即所得 + 源码模式)
│   ├── 双向链接 [[Wiki Link]]
│   ├── 块引用 / 嵌入
│   ├── 看板 / 日历 / 表格视图
│   ├── 画布模式 (Canvas)
│   └── 模板系统
│
├── 🤖 AI 智能
│   ├── AI 写作助手 (自动补全/续写/改写)
│   ├── 自动标签与分类
│   ├── 自动摘要
│   ├── 语义搜索 (非关键词匹配)
│   ├── 知识图谱 (自动发现笔记关联)
│   ├── 问答助理 (基于你的笔记库)
│   └── 间隔复习 (主动推荐回顾旧笔记)
│
├── 🔗 协作
│   ├── 实时协同编辑 (CRDT)
│   ├── 评论 / 提及 @
│   ├── 分享（链接 / 只读 / 编辑）
│   ├── 权限管理
│   └── 发布为网站
│
├── 🔐 同步
│   ├── 端到端加密
│   ├── 增量同步
│   ├── 冲突自动解决
│   ├── 离线优先 (本地全量数据)
│   └── P2P 局域网同步 (可选)
│
├── 📦 扩展
│   ├── REST API (第三方集成)
│   ├── Webhook 触发器
│   ├── 社区插件系统
│   ├── 导入: Notion / Obsidian / Evernote / Markdown
│   └── 导出: Markdown / PDF / Word / HTML
│
└── ⚙️ 管理
    ├── 标签 / 收藏夹 / 回收站
    ├── 版本历史 (Git-like)
    ├── 全文搜索
    ├── 统计看板
    └── 键盘快捷键
```

### 3.2 AI 功能详解

#### 3.2.1 AI 写作助手架构

```
用户正在输入...
    │
    ▼
┌────────────────────────────────────┐
│  Rust 内核：实时解析当前段落上下文    │
│  提取前 2000 tokens 作为 prompt     │
└──────────────┬─────────────────────┘
               │ 300ms debounce
               ▼
┌────────────────────────────────────┐
│  AI Service (Python FastAPI)       │
│  ├── 短请求 (续写/补全) → 流式 SSE │
│  ├── 中请求 (改写/扩写) → RabbitMQ │
│  └── 长请求 (摘要/标签) → 异步回调  │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  LLM Router                         │
│  ├── 快速补全 → 本地小模型 (Phi-3) │
│  ├── 智能写作 → Claude / GPT-4o    │
│  ├── 标签分类 → 微调模型            │
│  └── 知识问答 → RAG (向量检索+LLM)  │
└────────────────────────────────────┘
```

#### 3.2.2 知识图谱自动构建

```
你的笔记库
    │
    ▼
┌────────────────────────────────────┐
│ 1. 解析双向链接 [[...]]            │
│ 2. 实体提取 (NER: 人名/项目/概念)   │
│ 3. TF-IDF 关键词提取               │
│ 4. LLM 关系分类 (is_a / part_of   │
│    / related_to / ...)             │
│ 5. 向量相似度聚类 (Milvus)         │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  知识图谱存储                       │
│  ├── Neo4j / PostgreSQL + graph   │
│  ├── 节点: 笔记 / 概念 / 标签      │
│  ├── 边: 引用 / 包含 / 相关        │
│  └── 权重: 关联强度                │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  展示 (React Flow / D3.js)         │
│  交互式图谱，可缩放/筛选/搜索       │
└────────────────────────────────────┘
```

### 3.3 同步与离线架构

```
┌─────────────────────────────────────────────────────┐
│  离线优先同步架构                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📱 客户端 (Tauri / Flutter)                         │
│  ┌──────────────────────────────────────┐           │
│  │  Local DB (SQLite + Crypto)          │           │
│  │  ├── 笔记全文加密存储                 │           │
│  │  ├── 变更日志 (Change Log)            │           │
│  │  └── 冲突版本 (Conflict Versions)    │           │
│  │                                        │           │
│  │  Sync Engine                          │           │
│  │  ├── CRDT (Conflict-free Replicated   │           │
│  │  │       Data Types)                  │           │
│  │  ├── 增量同步 (只传 diff)              │           │
│  │  └── 离线队列 (网络恢复自动提交)       │           │
│  └──────────────────────────────────────┘           │
│                      │                               │
│         HTTPS / WebSocket Secure                     │
│                      ▼                               │
│  ☁️ 云端                                            │
│  ┌──────────────────────────────────────┐           │
│  │  Sync Service (Java)                 │           │
│  │  ├── 版本向量 (Version Vector)       │           │
│  │  ├── 冲突检测与合并                   │           │
│  │  └── 推送通知 (WebSocket)            │           │
│  └──────────────────────────────────────┘           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 四、数据库设计

### 4.1 PostgreSQL 核心表

```sql
-- ============================================================
-- 用户模块
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(128),
    avatar_url      VARCHAR(512),
    bio             TEXT,
    preferences     JSONB DEFAULT '{}',      -- 用户偏好设置
    subscription    VARCHAR(32) DEFAULT 'free', -- free / pro / team
    encrypted_key   BYTEA,                    -- 端到端加密密钥
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- 笔记模块
-- ============================================================

CREATE TABLE notebooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES notebooks(id) ON DELETE CASCADE,
    title           VARCHAR(512) NOT NULL DEFAULT '未命名笔记本',
    icon            VARCHAR(64),
    cover_color     VARCHAR(7) DEFAULT '#ffffff',
    sort_order      INT DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notebooks_user ON notebooks(user_id) WHERE NOT is_deleted;

CREATE TABLE notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notebook_id     UUID REFERENCES notebooks(id) ON DELETE SET NULL,
    title           VARCHAR(1024) NOT NULL DEFAULT '',
    content         TEXT NOT NULL DEFAULT '',        -- Markdown 内容
    content_plain   TEXT,                            -- 纯文本（用于搜索）
    content_encrypted BOOLEAN DEFAULT FALSE,          -- 是否加密
    is_pinned       BOOLEAN DEFAULT FALSE,
    is_favorite     BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    view_count      INT DEFAULT 0,
    word_count      INT DEFAULT 0,
    version         INT DEFAULT 1,                   -- 乐观锁
    editor_mode     VARCHAR(16) DEFAULT 'wysiwyg',    -- wysiwyg / markdown
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON notes(user_id) WHERE NOT is_deleted;
CREATE INDEX idx_notes_notebook ON notes(notebook_id) WHERE NOT is_deleted;
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX idx_notes_favorite ON notes(user_id, is_favorite) WHERE is_favorite;

-- 全文搜索（配合 Elasticsearch，这是PostgreSQL兜底方案）
CREATE INDEX idx_notes_fts ON notes USING GIN(
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_plain, ''))
);

-- ============================================================
-- 标签与分类
-- ============================================================

CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(64) NOT NULL,
    color           VARCHAR(7) DEFAULT '#6366f1',
    parent_id       UUID REFERENCES tags(id) ON DELETE CASCADE,
    is_auto         BOOLEAN DEFAULT FALSE,    -- AI 自动生成的标签
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE note_tags (
    note_id         UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id          UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);

-- ============================================================
-- 双向链接
-- ============================================================

CREATE TABLE note_links (
    id              BIGSERIAL PRIMARY KEY,
    source_note_id  UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id  UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    link_type       VARCHAR(16) DEFAULT 'wiki',  -- wiki / reference / embed
    context         TEXT,                          -- 链接上下文
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_note_id, target_note_id, link_type)
);

CREATE INDEX idx_note_links_source ON note_links(source_note_id);
CREATE INDEX idx_note_links_target ON note_links(target_note_id);

-- ============================================================
-- 版本历史
-- ============================================================

CREATE TABLE note_versions (
    id              BIGSERIAL PRIMARY KEY,
    note_id         UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    title           VARCHAR(1024),
    content         TEXT NOT NULL,
    change_summary  VARCHAR(255),          -- 变更摘要（AI 生成）
    checksum        VARCHAR(64),           -- SHA-256 校验
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, version)
);

CREATE INDEX idx_note_versions_note ON note_versions(note_id, version DESC);

-- ============================================================
-- 向量嵌入（pgvector）
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE note_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    note_id         UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL DEFAULT 0,      -- 长文本分块
    chunk_text      TEXT NOT NULL,
    embedding       VECTOR(1536),                -- OpenAI ada-002 维度
    model           VARCHAR(64) DEFAULT 'text-embedding-3-small',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_note_embeddings_note ON note_embeddings(note_id);
CREATE INDEX idx_note_embeddings_vec ON note_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.2 Redis 缓存设计

```yaml
# Redis Key 设计

# Session & Token
sess:{token}                → { user_id, expire }    # 登录 Session
rate:api:{user_id}          → counter                # API 限流

# 缓存
cache:note:{note_id}        → JSON(note)              # 笔记详情缓存 (TTL: 5min)
cache:user:{user_id}        → JSON(user)              # 用户信息 (TTL: 10min)
cache:notebook:{id}         → JSON(notebook)           # 笔记本 (TTL: 5min)

# 实时协作
collab:{note_id}:doc        → CRDT Document           # 协作文档状态
collab:{note_id}:users      → Set(user_ids)           # 当前编辑者
collab:{note_id}:cursor_{uid} → { line, col }         # 光标位置

# 队列
queue:ai:{task_type}        → List(task_json)         # AI 处理任务队列
queue:search:index          → List(note_id)           # 搜索索引更新队列
queue:email                 → List(email_json)        # 邮件发送队列

# 计数器
counter:note:views:{note_id}  → INT                  # 阅读计数
counter:user:storage:{uid}    → INT                   # 已用存储空间

# 限流
rate:ai:user:{user_id}:daily  → INT (TTL: 86400)     # AI 调用每日限额
```

### 4.3 Elasticsearch 索引

```json
{
  "index": "notes",
  "mappings": {
    "properties": {
      "id":           { "type": "keyword" },
      "user_id":      { "type": "keyword" },
      "title":        { "type": "text", "analyzer": "ik_smart_analyzer" },
      "content":      { "type": "text", "analyzer": "ik_max_word_analyzer" },
      "tags":         { "type": "keyword" },
      "notebook":     { "type": "keyword" },
      "is_deleted":   { "type": "boolean" },
      "created_at":   { "type": "date" },
      "updated_at":   { "type": "date" },
      "word_count":   { "type": "integer" },
      
      "embeddings":   { 
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine"
      }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "ik_smart_analyzer": { "type": "custom", "tokenizer": "ik_smart" },
        "ik_max_word_analyzer": { "type": "custom", "tokenizer": "ik_max_word" }
      }
    }
  }
}
```

---

## 五、Rust 桌面核心引擎设计

### 5.1 引擎架构

```
┌─────────────────────────────────────────────────────────┐
│              NoteForge Rust Core Engine                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Markdown 引擎                                    │    │
│  │  ├── md-ast: 自定义 Markdown AST (比 pulldown    │    │
│  │  │           更丰富的语义)                         │    │
│  │  ├── md-render: 增量渲染（只更新变化部分）          │    │
│  │  └── md-ext: 扩展语法 ([[link]], #tag, 数学公式) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  搜索索引 (全文搜索)                               │    │
│  │  ├── tantivy: 本地全文搜索引擎                     │    │
│  │  ├── 增量索引：监听 fs 变化自动更新                  │    │
│  │  └── 中文分词：结巴分词 Rust 移植                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  加密引擎                                         │    │
│  │  ├── AES-256-GCM: 笔记内容加密                     │    │
│  │  ├── XChaCha20-Poly1305: 元数据加密                 │    │
│  │  └── Argon2id: 密钥派生                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  同步引擎                                         │    │
│  │  ├── CRDT 实现 (Automerge-compatible)              │    │
│  │  ├── 差异计算 (基于 Myers diff)                     │    │
│  │  └── 冲突自动合并                                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  本地存储 (SQLite)                                │    │
│  │  ├── 笔记全文 + 元数据                             │    │
│  │  ├── 版本历史                                      │    │
│  │  └── 附件元数据                                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Cargo 依赖

```toml
[package]
name = "noteforge-core"
version = "0.1.0"
edition = "2021"

[dependencies]
# Markdown 解析
pulldown-cmark = "0.11"        # Markdown → AST
comrak = "0.28"                # 兼容 GFM 的渲染

# 全文搜索
tantivy = "0.22"               # 本地全文搜索引擎
jieba-rs = "0.7"               # 中文分词
unicode-segmentation = "1"     # Unicode 文本处理

# 加密
aes-gcm = "0.10"              # AES-256-GCM 加密
chacha20poly1305 = "0.10"     # XChaCha20-Poly1305
argon2 = "0.5"                # 密钥派生

# 序列化
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"

# 数据库
rusqlite = { version = "0.31", features = ["bundled"] }

# 同步 / CRDT
automerge = "0.5"             # CRDT 实现
similar = "2"                 # 文本差异对比

# 网络
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio-tungstenite = "0.23"    # WebSocket 同步

# 异步
tokio = { version = "1", features = ["full"] }
futures = "0.3"

# 文件监控
notify = "7"                  # 文件系统变化监听

# 日志
tracing = "0.1"
tracing-subscriber = "0.3"
```

### 5.3 核心 API

```rust
// ============================================================
// NoteForge Core Engine — Rust API 设计
// ============================================================

/// 笔记元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub links: Vec<String>,           // [[双向链接]]
    pub created_at: u64,
    pub updated_at: u64,
    pub word_count: u32,
    pub is_encrypted: bool,
    pub checksum: String,             // SHA-256
}

/// Markdown AST 节点
#[derive(Debug)]
pub enum MarkdownNode {
    Heading { level: u8, children: Vec<MarkdownNode> },
    Paragraph(Vec<MarkdownNode>),
    Link { url: String, text: String, is_wiki: bool },
    CodeBlock { language: Option<String>, code: String },
    MathBlock { formula: String },
    Table { headers: Vec<String>, rows: Vec<Vec<MarkdownNode>> },
    Todo { checked: bool, text: String },
    Image { url: String, alt: String },
    Callout { kind: String, content: Vec<MarkdownNode> },
    Text(String),
    Bold(String),
    Italic(String),
    Strikethrough(String),
}

/// 笔记引擎核心
pub struct NoteEngine {
    db: LocalDatabase,            // SQLite 本地存储
    search: SearchIndex,          // Tantivy 全文索引
    crypto: CryptoEngine,         // 加密引擎
    sync: SyncEngine,             // 同步引擎
}

impl NoteEngine {
    /// 创建/打开笔记本
    pub fn open(path: &str, passphrase: Option<&str>) -> Result<Self>;

    /// 创建笔记
    pub fn create_note(&mut self, title: &str, content: &str) -> Result<NoteMeta>;

    /// 读取笔记
    pub fn get_note(&self, id: &str) -> Result<Note>;

    /// 更新笔记（增量），返回 diff
    pub fn update_note(&mut self, id: &str, content: &str) -> Result<DiffResult>;

    /// 删除笔记（软删除）
    pub fn delete_note(&mut self, id: &str) -> Result<()>;

    /// 全文搜索
    pub fn search(&self, query: &str, options: SearchOptions) -> Result<Vec<SearchResult>>;

    /// 获取双向链接
    pub fn get_backlinks(&self, id: &str) -> Result<Vec<LinkInfo>>;

    /// 解析 Markdown 为 AST
    pub fn parse_markdown(&self, content: &str) -> Result<MarkdownDocument>;

    /// 渲染为 HTML
    pub fn render_html(&self, ast: &MarkdownDocument) -> Result<String>;

    /// 导出
    pub fn export(&self, id: &str, format: ExportFormat) -> Result<Vec<u8>>;

    /// 同步到云端
    pub fn sync_to_cloud(&mut self) -> Result<SyncStatus>;

    /// 加密笔记
    pub fn encrypt_note(&mut self, id: &str) -> Result<()>;

    /// 解密笔记
    pub fn decrypt_note(&self, id: &str) -> Result<String>;

    /// 获取知识图谱数据
    pub fn get_knowledge_graph(&self) -> Result<GraphData>;
}
```

---

## 六、后端微服务设计

### 6.1 服务拆分

| 服务 | 技术栈 | 职责 |
|------|--------|------|
| **api-gateway** | Spring Cloud Gateway | 路由、鉴权、限流、日志 |
| **user-service** | Spring Boot 3 + Security | 注册登录、OAuth、权限 |
| **note-service** | Spring Boot 3 + JPA | 笔记 CRUD、标签、笔记本 |
| **sync-service** | Spring Boot 3 + Netty | WebSocket 实时同步、CRDT |
| **search-service** | Spring Boot 3 + ES Client | 全文搜索、语义搜索、索引管理 |
| **ai-service** | Python FastAPI | LLM 调用、向量化、知识图谱 |
| **file-service** | Spring Boot 3 + MinIO SDK | 文件上传/下载、图片处理 |
| **collab-service** | Spring Boot 3 + RSocket | 实时协作编辑 |
| **notification-service** | Spring Boot 3 | 推送、邮件、Webhook |
| **analytics-service** | Spring Boot 3 | 统计、埋点、报表 |

### 6.2 Java/Kotlin 后端核心

```kotlin
// NoteService.kt — Spring Boot 3 + Kotlin

@Service
class NoteService(
    private val noteRepository: NoteRepository,
    private val tagRepository: TagRepository,
    private val linkRepository: NoteLinkRepository,
    private val eventPublisher: ApplicationEventPublisher,
    private val redisTemplate: RedisTemplate<String, Any>,
    private val rabbitTemplate: RabbitTemplate,
) {
    
    /**
     * 创建笔记（同步触发 AI 分析、索引构建）
     */
    @Transactional
    fun createNote(
        userId: UUID,
        request: CreateNoteRequest
    ): NoteResponse {
        val note = Note(
            userId = userId,
            notebookId = request.notebookId,
            title = request.title,
            content = request.content,
            contentPlain = HtmlUtils.stripHtml(renderMarkdown(request.content)),
            wordCount = countWords(request.content),
        )
        
        val saved = noteRepository.save(note)
        
        // 异步处理
        eventPublisher.publishEvent(NoteCreatedEvent(saved.id))
        
        // 清除缓存
        redisTemplate.delete("cache:user:$userId:recent")
        
        return saved.toResponse()
    }
    
    /**
     * 全文本搜索（Elasticsearch）
     */
    fun searchNotes(
        userId: UUID,
        query: String,
        page: Int,
        size: Int
    ): SearchResponse {
        val searchQuery = nativeSearchQuery {
            must {
                queryStringQuery(query)
                    .fields(listOf("title^3", "content", "tags^2"))
            }
            filter { termQuery("user_id", userId.toString()) }
            filter { termQuery("is_deleted", false) }
        }
        
        val searchHits = elasticsearchOperations.search(searchQuery, NoteDocument::class.java)
        
        return SearchResponse(
            total = searchHits.totalHits,
            results = searchHits.map { it.content.toSearchResult() }
        )
    }
    
    /**
     * 语义搜索（向量相似度）
     */
    fun semanticSearch(
        userId: UUID,
        query: String,
        limit: Int = 10
    ): List<SearchResult> {
        // 1. 获取查询向量
        val queryVector = aiServiceClient.getEmbedding(query)
        
        // 2. pgvector 相似度检索
        val results = noteRepository.findSimilarByUserId(
            userId = userId,
            queryVector = PGvector(queryVector),
            limit = limit
        )
        
        // 3. 缓存结果
        return results.map { it.toSearchResult() }
    }
}
```

### 6.3 Spring Boot 配置

```yaml
# application.yml
spring:
  application:
    name: note-service
  
  datasource:
    url: jdbc:postgresql://localhost:5432/noteforge
    username: noteforge
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 20
  
  redis:
    host: localhost
    port: 6379
    lettuce:
      pool:
        max-active: 16
  
  elasticsearch:
    uris: http://localhost:9200
  
  rabbitmq:
    host: localhost
    port: 5672
  
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true

minio:
  endpoint: http://localhost:9000
  access-key: ${MINIO_ACCESS_KEY}
  secret-key: ${MINIO_SECRET_KEY}
  bucket: noteforge-files

note-forge:
  ai:
    llm-endpoint: http://ai-service:8000
    embedding-model: text-embedding-3-small
    daily-limit:
      free: 50
      pro: 500
  sync:
    max-batch-size: 100
    conflict-strategy: crdt
```

---

## 七、开发计划

### 7.1 里程碑

```
Phase 1: MVP (4周)
├── Week 1: Rust 核心引擎 (Markdown 解析 + 本地存储)
├── Week 2: Tauri 桌面端 + 基础编辑器 UI
├── Week 3: Java 后端 (用户 + 笔记 API)
├── Week 4: PostgreSQL + MinIO + 基础同步

Phase 2: 完整客户端 (4周)
├── Week 5: React Web 端
├── Week 6: Flutter 移动端
├── Week 7: 端到端加密 + 离线模式
├── Week 8: 全文搜索 (Elasticsearch)

Phase 3: AI 智能 (3周)
├── Week 9: AI 写作助手
├── Week 10: 自动标签 + 智能搜索
├── Week 11: 知识图谱

Phase 4: 协作与发布 (3周)
├── Week 12: 实时协作 (CRDT)
├── Week 13: 分享 + 权限
├── Week 14: 性能优化 + 发布
```

### 7.2 团队配置

| 角色 | 人数 | 技能 |
|------|:---:|------|
| Rust 工程师 | 1 | Tauri、系统编程、Markdown |
| 前端工程师 | 1-2 | React、TypeScript、Tauri 前端 |
| Flutter 工程师 | 1 | 跨平台移动开发 |
| 后端工程师 | 1-2 | Java/Kotlin、Spring Boot、PostgreSQL |
| AI 工程师 | 1 | LLM、RAG、NLP |
| DevOps | 1 | Docker、K8s、CI/CD |

> **一人团队**：可按 Phase 1→2→3 顺序逐步开发，
> Rust 核心引擎 + Tauri 桌面端留给主力，后端用 Supabase/BaaS 快速验证

---

## 八、基础设施

### 8.1 Docker Compose（本地开发）

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: noteforge
      POSTGRES_USER: noteforge
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  elasticsearch:
    image: elasticsearch:8.12
    environment:
      discovery.type: single-node
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
      xpack.security.enabled: "false"
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"

  milvus:
    image: milvusdb/milvus:v2.4.0
    ports:
      - "19530:19530"
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    depends_on:
      - etcd
      - minio

  etcd:
    image: quay.io/coreos/etcd:v3.5
    environment:
      ETCD_NAME: node1
      ETCD_DATA_DIR: /etcd-data
      ETCD_LISTEN_CLIENT_URLS: http://0.0.0.0:2379
      ETCD_ADVERTISE_CLIENT_URLS: http://etcd:2379

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"

volumes:
  pgdata:
  esdata:
  miniodata:
```

### 8.2 Kubernetes 部署（生产）

```yaml
# k8s/note-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: note-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: note-service
  template:
    metadata:
      labels:
        app: note-service
    spec:
      containers:
      - name: note-service
        image: noteforge/note-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: note-service
spec:
  selector:
    app: note-service
  ports:
  - port: 8080
```

---

## 九、技术挑战与解决方案

| 挑战 | 方案 |
|------|------|
| **离线优先的冲突同步** | CRDT (Conflict-free Replicated Data Types)，基于 Automerge |
| **端到端加密 vs 全文搜索** | 元数据非加密（可搜索），内容加密。搜索时先解密再索引 |
| **Markdown 所见即所得** | ProseMirror / TipTap 编辑器 + Rust 后端的 ProseMirror ↔ Markdown 转换 |
| **大规模笔记的搜索性能** | ES 集群分片 + Rust 本地 Tantivy 兜底（离线时） |
| **AI 成本控制** | 本地小模型(Phi-3)处理简单任务，云端大模型处理复杂任务 |
| **实时协作的冲突** | CRDT + OT 混合方案，或直接用 Yjs/Automerge WASM |

---

## 十、总结

### NoteForge 核心竞争力

```
🎯 一句话定位：
  一个"AI 原生"的全平台笔记系统
  比 Notion 更快（Rust 核心）、比 Obsidian 更智能（AI 原生）

🏆 技术展示：
  · 桌面端：Tauri + Rust 高性能核心引擎
  · Web 端：React 19 + Next.js SSR
  · 移动端：Flutter 跨平台
  · 后端：Java 21 + Spring Boot 3 微服务
  · 数据：PostgreSQL + Elasticsearch + Redis + MinIO + Milvus
  · 智能：LLM + RAG + 知识图谱 + 语义搜索

🔥 为什么值得做：
  · 覆盖所有主流技术栈，是最好的面试作品
  · 笔记 App 是永恒需求，持续迭代潜力大
  · AI 原生是 2025-2026 最大趋势
  · 开源后 GitHub Star 潜力大
```

---

*文档版本: v1.0*
*最后更新: 2026-06-23*
