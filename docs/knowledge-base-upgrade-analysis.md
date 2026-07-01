# NoteForge 智能知识库 — 升级空间分析

> 基于现有知识库设计，从 **知识管理全生命周期** 出发，系统性地分析可升级方向。

---

## 一、分析框架

知识库管理系统的成熟度可分为六个维度，每个维度有若干关键能力。以下以此框架逐项评估 NoteForge 当前设计的覆盖情况：

```
知识库成熟度模型
├── ❶ 知识生产      — 创建、导入、捕获、结构化
├── ❷ 知识组织      — 分类、关联、图谱、元数据
├── ❸ 知识质量      — 审核、版本、去重、过期管理
├── ❹ 知识发现      — 搜索、推荐、导航、问答
├── ❺ 知识消费      — 阅读、协作、分享、嵌入
└── ❻ 知识治理      — 权限、合规、审计、分析
```

---

## 二、逐项分析

### 2.1 知识生产 — 当前覆盖: 50%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 文件导入 (PDF/DOCX/PPTX/XLSX) | ✅ 已设计 | — | — |
| 代码文件导入 | ✅ 已设计 | — | — |
| AI 自动提取与分类 | ✅ 已设计 | — | — |
| **Web 剪藏** | ❌ 未覆盖 | 无浏览器扩展，无法从网页直接捕获内容 | P1 |
| **手写/图片 OCR** | ❌ 未覆盖 | 无图片文字识别，白板/手写笔记无法导入 | P2 |
| **邮件导入** | ❌ 未覆盖 | 无法将邮件归档为知识文档 | P3 |
| **IM 消息导入** | ❌ 未覆盖 | 无法从飞书/钉钉/企业微信导入对话知识 | P3 |
| **批量导入 (ZIP)** | ❌ 未覆盖 | 不支持批量上传和目录结构保持 | P2 |
| **知识模板** | ❌ 未覆盖 | 无预定义模板（技术方案/会议纪要/周报等） | P1 |
| **草稿与版本草稿** | ✅ 笔记有 | 知识文档缺乏独立的多版本草稿能力 | P2 |

#### 升级建议

**Web 剪藏 (P1)**: 开发浏览器扩展（Chrome/Firefox/Edge），核心功能:
- 一键抓取网页正文 → 自动转为知识文档
- 支持选择区域截图
- 自动提取元数据（作者、发布日期、原文链接）
- 支持标注和高亮后导入

```typescript
// Web Clipper 架构
browser-extension/
├── manifest.json
├── content/
│   ├── extractor.ts          // 正文提取 (Readability)
│   ├── screenshot.ts         // 截图
│   └── highlighter.ts        // 标注
├── popup/
│   ├── App.tsx               // 快速剪藏弹窗
│   └── categories.ts         // 分类选择
└── background/
    ├── sync.ts               // 与 NoteForge API 同步
    └── scheduler.ts          // 定时抓取 (RSS)
```

**知识模板 (P1)**: 预置 + 用户自定义模板系统:
```
模板类型:
├── 技术方案
│   ├── 背景与目标
│   ├── 技术选型对比
│   ├── 架构设计
│   └── 风险评估
├── 会议纪要
│   ├── 时间/参会人
│   ├── 议题与结论
│   └── Action Items
├── 项目周报
├── API 设计文档
├── 故障复盘 (Postmortem)
└── 用户自定义模板
```

---

### 2.2 知识组织 — 当前覆盖: 35%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 笔记本/标签分类 | ✅ 已有 | — | — |
| AI 自动分类 | ✅ 已设计 | — | — |
| 双向链接 [[Wiki Link]] | ✅ 已有 | — | — |
| 知识图谱 (基础) | ✅ 已有 GraphView | 仅基于 Wiki Link，无实体级关联 | P1 |
| **多级分类体系** | ❌ 未覆盖 | 仅一级分类，不支持子分类/多级标签 | P1 |
| **自定义元数据** | ❌ 未覆盖 | 无法为知识文档添加自定义字段 | P1 |
| **本体与关系类型** | ❌ 未覆盖 | 无预定义/自定义关系类型（依赖/继承/引用） | P2 |
| **知识目录 (TOC)** | ✅ 阅读器有 | 文档内目录已支持 | — |
| **企业知识分类法** | ❌ 未覆盖 | 无企业级 Taxonomy 管理 | P3 |
| **标签命名空间** | ❌ 未覆盖 | 不支持分层标签 (tech/rust/async) | P2 |

#### 升级建议

**自定义元数据 (P1)**: 允许用户/管理员为知识文档定义自定义字段:

```typescript
interface CustomField {
  id: string;
  name: string;           // 字段名，如"项目名称"
  type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'user' | 'url';
  options?: string[];     // select/multi_select 的可选值
  required: boolean;
}

// 使用场景
// 技术文档: 项目名称、版本号、负责人、状态
// 故障复盘: 严重程度(P0-P4)、影响范围、根因类型
// 会议纪要: 项目名、会议类型、参会人
```

**多级标签 (P1)**: 支持 `/` 分隔的层级标签:
```
tech/rust/async
tech/rust/embedded
tech/python/fastapi
design/ui/color
design/ux/research
management/project/agile
```

**实体级知识图谱 (P1)**: 从文档内容中提取实体并建立关联，超越单纯 Wiki Link:
```typescript
// 增强的知识图谱
interface KnowledgeEntity {
  id: string;
  name: string;                    // 实体名: "PostgreSQL"
  type: EntityType;                // 技术/产品/概念/人物/组织
  aliases: string[];              // 别名: ["Postgres", "pg"]
  docIds: string[];               // 关联文档
  relatedEntities: {
    entityId: string;
    relationType: RelationType;   // depends_on / implements / alternative_to / ...
    strength: number;             // 关联强度
  }[];
}

enum RelationType {
  DEPENDS_ON,        // A 依赖 B
  IMPLEMENTS,        // A 实现了 B
  ALTERNATIVE_TO,    // A 是 B 的替代方案
  PART_OF,           // A 是 B 的组成部分
  RELATED_TO,        // 弱关联
  PRECEDES,          // A 先于 B
  REFERENCES,        // A 引用了 B
}
```

---

### 2.3 知识质量 — 当前覆盖: 10%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 笔记版本历史 | ✅ 已有 (Git + 后端) | 仅限笔记，知识文档无版本管理 | P1 |
| **知识文档版本管理** | ❌ 未覆盖 | 知识文档无独立的版本管理和 diff 对比 | P1 |
| **审核工作流** | ❌ 未覆盖 | 无 Draft → Review → Published → Archived 流程 | P1 |
| **质量评分** | ❌ 未覆盖 | 无法评估知识文档的质量和完整性 | P2 |
| **重复检测** | ❌ 未覆盖 | 相同文件上传无智能合并，只做了哈希去重 | P2 |
| **过期检测** | ❌ 未覆盖 | 无法标记和提醒过期的知识文档 | P1 |
| **知识完整性检查** | ❌ 未覆盖 | 无法发现"孤儿文档"和知识盲区 | P2 |
| **AI 质量改进建议** | ❌ 未覆盖 | AI 不主动提出文档改进建议 | P2 |
| **引用与溯源** | ❌ 部分覆盖 | 有原始文件链接，但无知识引用链 | P2 |

#### 升级建议

**知识文档生命周期 (P1)**:
```
                  ┌──────────────┐
                  │   草稿 Draft  │
                  └──────┬───────┘
                         │ 提交审核
                         ▼
                  ┌──────────────┐
                  │  审核 Review  │←── 审核人评论/驳回
                  └──────┬───────┘
                         │ 批准
                         ▼
                  ┌──────────────┐
                  │  已发布 Published │──→ 可搜索、可引用
                  └──────┬───────┘
                         │ 标记过期
                         ▼
                  ┌──────────────┐
                  │  已归档 Archived │──→ 仅可查阅，不影响搜索
                  └──────────────┘
```

**过期检测策略 (P1)**:
```typescript
interface ExpirationPolicy {
  // 自动检测规则
  rules: {
    type: 'time_based' | 'version_based' | 'dependency_changed';
    // time_based: 超过 N 天未更新
    // version_based: 关联技术有新版本
    // dependency_changed: 依赖的文档已更新
    threshold: number;    // 天数或版本差
    action: 'warn' | 'archive' | 'notify';  
  }[];
  
  // 提醒机制
  notifications: {
    channel: 'in_app' | 'email' | 'notification';
    beforeExpiry: number;   // 提前 N 天提醒
  };
}
```

**知识质量评分模型 (P2)**:
```
评分维度:           权重:
├── 内容完整性       30%    — 是否有摘要、目录、关键术语
├── 结构清晰度       20%    — 标题层级是否合理、是否有图表
├── 信息时效性       20%    — 创建/更新时间
├── 引用质量         15%    — 引用其他文档数量和质量
├── 阅读反馈         15%    — 阅读次数、收藏数、评分
```

---

### 2.4 知识发现 — 当前覆盖: 40%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 全文搜索 | ✅ 已有 (Tantivy) | — | — |
| 语义搜索 | ✅ 已设计 (pgvector) | — | — |
| 混合搜索 | ✅ 已设计 (RRF) | — | — |
| 搜索结果高亮 | ✅ 已有 | — | — |
| **分面搜索 (Faceted)** | ❌ 未覆盖 | 无法按分类/标签/类型/日期等多维度筛选 | P1 |
| **保存搜索** | ❌ 未覆盖 | 无法保存常用搜索条件 | P2 |
| **搜索建议** | ❌ 未覆盖 | 输入时无自动补全和建议 | P2 |
| **知识推荐** | ❌ 未覆盖 | 无"相似知识""常一起查看"推荐 | P1 |
| **知识导航** | ❌ 未覆盖 | 无面包屑导航、上下篇导航 | P2 |
| **搜索语法** | ❌ 未覆盖 | 不支持 `tag:rust` `type:pdf` `after:2026-01-01` | P2 |
| **搜索分析** | ❌ 未覆盖 | 无搜索热词、零结果查询分析 | P3 |

#### 升级建议

**分面搜索 (P1)**: 在搜索结果页左侧/顶部展示筛选维度:
```
搜索结果: "数据库设计"  (42 条结果)
─────────────────────────────────
📂 分类:  全部(42)  技术文档(18)  代码库(8)  数据报表(6)
📎 类型:  全部(42)  PDF(15)  Markdown(12)  代码(8)  Excel(5)
🏷 标签:  架构(20)  数据库(15)  PostgreSQL(10)  设计(8)
📅 日期:  本周(5)  本月(12)  近三月(20)  更早(10)
```

**知识推荐 (P1)** — 三种推荐引擎:

```python
# 1. 基于内容的推荐 (文档相似度)
def content_based_recommend(doc_id: str, top_k: int = 5):
    doc_embedding = get_embedding(doc_id)
    similar = vector_search(doc_embedding, exclude=[doc_id], limit=top_k)
    return similar

# 2. 协同过滤推荐 (用户行为)
def collaborative_recommend(user_id: str, top_k: int = 5):
    # "看了这个文档的人也看了..."
    view_history = get_user_view_history(user_id)
    related_docs = find_co_viewed_docs(view_history)
    return related_docs

# 3. 知识图谱推荐 (关联路径)
def graph_recommend(doc_id: str, top_k: int = 5):
    # 通过实体关联路径推荐
    entities = get_doc_entities(doc_id)
    related_docs = find_docs_by_entities(entities)
    return related_docs
```

**搜索语法 (P2)**:
```
# 支持的搜索表达式
tag:rust                          # 按标签筛选
type:pdf                          # 按文件类型
category:"技术文档"               # 按分类
after:2026-01-01                  # 按日期范围
before:2026-06-30
author:alice                      # 按上传者
title:"系统架构"                  # 标题搜索
content:"AES-256"                 # 内容搜索
tag:A +tag:B                      # 多标签 AND (默认 OR)

# 组合
tag:rust type:pdf after:2026-01-01
```

---

### 2.5 知识消费 — 当前覆盖: 25%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 知识文档阅读器 | ✅ 已设计 | — | — |
| Markdown 渲染 | ✅ 已有 | — | — |
| MCP 服务 | ✅ 已设计 | — | — |
| **文档内评论与标注** | ❌ 未覆盖 | 无法在知识文档上做批注和讨论 | P1 |
| **知识问答 (RAG)** | ✅ 已设计 | — | — |
| **知识分享 (链接)** | ❌ 未覆盖 | 无法生成分享链接对外分享知识 | P1 |
| **发布为网站** | ❌ 未覆盖 | 无法将知识库发布为静态网站 | P2 |
| **离线阅读** | ✅ 已有 (桌面端) | — | — |
| **移动端阅读** | ❌ 未覆盖 | Flutter 端尚无知识模块 | P2 |
| **导出格式** | ❌ 部分覆盖 | 笔记有导出，知识文档无批量导出 | P2 |
| **阅读进度追踪** | ❌ 未覆盖 | 无法追踪已读/未读/阅读进度 | P3 |
| **全文朗读 (TTS)** | ❌ 未覆盖 | 不支持文字转语音 | P3 |

#### 升级建议

**文档内评论与标注 (P1)**:
```typescript
interface Annotation {
  id: string;
  docId: string;
  userId: string;
  type: 'comment' | 'highlight' | 'suggestion';
  
  // 位置：通过文本锚点定位
  anchor: {
    chunkIndex: number;        // 所在知识块
    startOffset: number;       // 块内起始偏移
    endOffset: number;         // 块内结束偏移
    text: string;              // 选中的文本
  };
  
  content: string;             // 评论/建议内容
  resolved: boolean;           // 是否已解决
  createdAt: number;
  updatedAt: number;
}
```

**知识分享 (P1)** — 多种分享方式：
```
分享链接:
┌─────────────────────────────────────┐
│  NoteForge 知识分享                   │
│                                      │
│  📄 系统架构设计方案 v2.3             │
│                                      │
│  摘要: 本文描述了系统整体架构...      │
│                                      │
│  分享设置:                           │
│  ● 公开 (任何人可查看)               │
│  ○ 仅团队 (需登录)                   │
│  ○ 密码保护 ●●●●●                   │
│  ○ 有效期: 7 天后过期                │
│                                      │
│  链接: https://kb.noteforge.app/s/xxx│
│                                      │
│  嵌入: <iframe src="...">            │
└─────────────────────────────────────┘
```

**发布为知识库网站 (P2)**: 将指定笔记本/分类发布为静态站点，类似 GitBook:
```
用户选择需要发布的笔记本
       │
       ▼
┌──────────────────────┐
│  站点配置             │
│  ├── 站点名称/Logo    │
│  ├── 主题选择         │
│  ├── 自定义域名       │
│  └── 搜索引擎索引     │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  生成静态站           │
│  ├── 提取 Markdown    │
│  ├── 构建目录树       │
│  ├── 生成搜索索引     │
│  └── 部署到 CDN       │
└──────────────────────┘
```

---

### 2.6 知识治理 — 当前覆盖: 5%

| 能力 | 当前状态 | 差距 | 优先级 |
|------|---------|------|:------:|
| 用户认证 (JWT) | ✅ 已有 | — | — |
| 基础权限 (用户级) | ✅ 已有 | 仅有用户隔离 | P1 |
| **RBAC 权限模型** | ❌ 未覆盖 | 无角色/权限体系 | P1 |
| **知识库级权限** | ❌ 未覆盖 | 无法控制不同知识库的访问权限 | P1 |
| **操作审计日志** | ❌ 未覆盖 | 无人查看了什么、改了什么都不可追溯 | P2 |
| **合规性支持** | ❌ 未覆盖 | 无 GDPR/数据保留策略 | P3 |
| **存储配额管理** | ❌ 未覆盖 | 无用户/团队存储上限管理 | P2 |
| **数据导出/迁移** | ❌ 未覆盖 | 无法完整导出知识库数据 | P2 |
| **SSO 集成** | ❌ 未覆盖 | 不支持 OIDC/SAML 企业登录 | P3 |
| **水印与防泄露** | ❌ 未覆盖 | 分享页面无动态水印 | P3 |

#### 升级建议

**RBAC 权限模型 (P1)**:
```typescript
// 权限模型设计
interface Role {
  id: string;
  name: 'admin' | 'editor' | 'contributor' | 'viewer';
  permissions: Permission[];
}

enum Permission {
  KNOWLEDGE_CREATE,      // 创建知识文档
  KNOWLEDGE_READ,        // 读取
  KNOWLEDGE_UPDATE,      // 编辑
  KNOWLEDGE_DELETE,      // 删除
  KNOWLEDGE_PUBLISH,     // 发布/审核
  KNOWLEDGE_SHARE,       // 分享
  CATEGORY_MANAGE,       // 管理分类
  USER_MANAGE,           // 管理用户
  SYSTEM_CONFIG,         // 系统配置
}

// 权限作用域
interface PermissionScope {
  role: Role;
  scope: 'global' | 'knowledge_base' | 'folder' | 'document';
  scopeId?: string;        // 作用域 ID
  inherit: boolean;        // 是否向下继承
}
```

**操作审计日志 (P2)**:
```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'share' | 'export' | 'publish';
  resourceType: 'knowledge_doc' | 'note' | 'notebook' | 'category' | 'template';
  resourceId: string;
  resourceName: string;
  detail: string;                   // 变更详情 JSON
  ipAddress: string;
  userAgent: string;
}

// 审计日志查询
// 谁在什么时间改了什么 → 完整的可追溯链
```

---

## 三、AI 能力深度升级

### 3.1 当前 AI 能力 vs 可升级方向

| 当前设计 | 可升级方向 | 价值 |
|---------|-----------|:----:|
| AI 内容提取与清洗 | **知识差异分析** — 对比两份文档，自动生成变更摘要 | 版本升级时快速了解变化 |
| AI 自动分类 | **知识盲区检测** — 分析知识库覆盖度，发现缺失知识 | 帮助团队补充短板 |
| AI 摘要生成 | **多维度摘要** — 面向不同角色的摘要（TL;DR / 技术细节 / 决策背景） | 提高信息获取效率 |
| 实体识别 (NER) | **关系抽取** — 不仅识别实体，还提取实体间关系 | 丰富知识图谱 |
| RAG 问答 | **主动知识推荐** — 根据用户正在阅读的内容，主动推送相关信息 | 知识发现 |
| — | **知识测验生成** — 基于知识文档自动生成测验题 | 学习巩固 |
| — | **跨语言知识对齐** — 自动将中文知识翻译为英文/日文 | 国际化团队 |

### 3.2 AI Agent 能力

引入 **知识库 AI Agent**，具备主动行为能力：

```python
class KnowledgeAgent:
    """
    知识库 AI Agent 能力矩阵
    """
    
    # 1. 知识维护 Agent
    async def health_check(self) -> HealthReport:
        """定期巡检知识库健康状况"""
        stale_docs = self.find_stale_docs(threshold_days=180)
        orphans = self.find_orphan_docs()
        quality_scores = self.evaluate_quality()
        duplicates = self.find_potential_duplicates()
        return HealthReport(
            stale_docs=stale_docs,
            orphan_docs=orphans,
            quality_scores=quality_scores,
            duplicates=duplicates,
        )
    
    # 2. 知识链接 Agent
    async def suggest_links(self, doc_id: str) -> list[LinkSuggestion]:
        """自动发现文档间的潜在关联"""
        doc = self.get_doc(doc_id)
        candidates = self.semantic_search(doc.content, top_k=20)
        return [
            LinkSuggestion(target=c.id, confidence=score, reason=reason)
            for c, score, reason in candidates
        ]
    
    # 3. 知识补全 Agent
    async def suggest_completion(self, doc_id: str) -> list[CompletionSuggestion]:
        """分析文档缺少的关键信息并建议补充"""
        doc = self.get_doc(doc_id)
        gaps = self.analyze_gaps(doc)
        return [
            CompletionSuggestion(
                section=gap.field,
                suggestion=gap.suggestion,
                example=gap.example,
            )
            for gap in gaps
        ]
    
    # 4. 问答增强 Agent
    async def generate_qa_pairs(self, doc_id: str) -> list[QAPair]:
        """基于知识文档生成问答对，用于 RAG 评估"""
        doc = self.get_doc(doc_id)
        return self.llm.extract_qa_pairs(doc.content)
```

---

## 四、搜索能力深度升级

### 4.1 当前搜索 vs 目标状态

| 能力 | 当前 | 目标 |
|------|:----:|:----:|
| 中文分词 | ✅ jieba-rs | ✅ |
| 拼音搜索 | ❌ | ⭐ 支持拼音首字母/全拼 |
| 错别字纠正 | ❌ | ⭐ "数据裤" → "数据库" |
| 同义词扩展 | ❌ | ⭐ "PostgreSQL" ↔ "Postgres" ↔ "pg" |
| 搜索建议 | ❌ | ⭐ 输入"数" → 建议"数据库设计" |
| 搜索语法 | ❌ | ⭐ `tag:rust type:pdf` |
| 「搜索中搜索」 | ❌ | ⭐ 在结果中进一步筛选 |
| 搜索结果聚类 | ❌ | ⭐ 结果自动按主题分组 |
| 个性化排序 | ❌ | ⭐ 根据用户偏好调整排序 |
| 多语种混合搜索 | ❌ | ⭐ 中英日韩混合查询 |

### 4.2 搜索增强架构

```python
# ai-service/search/enhanced_search.py

class EnhancedSearchEngine:
    """
    增强搜索管道：
    查询 → 预处理 → 多路召回 → 融合 → 重排序 → 后处理
    """
    
    async def search(self, query: str, opts: SearchOptions) -> SearchResponse:
        # 1. 查询预处理
        corrected = self.spell_correct(query)          # 错别字纠正
        expanded = self.synonym_expand(corrected)       # 同义词扩展
        parsed = self.parse_query_syntax(expanded)      # 搜索语法解析
        pinyin = self.pinyin_fallback(parsed.query)     # 拼音搜索
        
        # 2. 多路并行召回
        semantic_results = await self.vector_search(parsed)
        fulltext_results = await self.fulltext_search(parsed)
        pinyin_results = await self.pinyin_search(pinyin)
        
        # 3. RRF 融合
        fused = self.rrf_fusion([
            semantic_results,
            fulltext_results,
            pinyin_results,
        ])
        
        # 4. 重排序 (Cross-encoder)
        reranked = await self.cross_encoder_rerank(
            query, fused[:50]
        )
        
        # 5. 后处理
        clustered = self.cluster_results(reranked)
        highlighted = self.highlight_matches(clustered, query)
        
        return highlighted
```

---

## 五、规模化与性能

### 5.1 性能瓶颈预测

| 规模 | 瓶颈点 | 解决方案 | 优先级 |
|------|--------|---------|:------:|
| 1K 文档 | 无 | — | — |
| 10K 文档 | 向量搜索延迟 | pgvector IVFFlat → HNSW 索引 | P2 |
| 100K 文档 | 全文搜索延迟 | Tantivy → Elasticsearch | P2 |
| 500K 文档 | AI 处理吞吐 | 队列 Worker 水平扩展 | P2 |
| 1M+ 文档 | 存储与成本 | 冷热分层、对象存储分级 | P3 |

### 5.2 缓存策略升级

```yaml
# 多级缓存策略

一级缓存 (内存):
  - 热门知识文档: LRU 缓存, 100 个, TTL 5min
  - 搜索热门词 Top-100: 预热缓存, 每 10min 刷新
  
二级缓存 (Redis):
  - 知识文档详情: TTL 10min
  - 搜索结果页: TTL 2min (带查询 hash key)
  - 分类统计: TTL 5min
  - 用户搜索历史: TTL 24h
  
三级缓存 (CDN):
  - 知识分享页: CDN 边缘缓存
  - 静态资源: 长期缓存
```

---

## 六、集成与生态

### 6.1 外部集成能力

| 集成类型 | 方案 | 优先级 |
|---------|------|:------:|
| **第三方存储** | 接入 Google Drive / OneDrive / Dropbox 同步读取文件 | P2 |
| **Slack 集成** | Slack 指令搜索知识库、自动记录决策到知识库 | P2 |
| **飞书/钉钉集成** | 类似 Slack，面向国内用户 | P3 |
| **Git 集成** | 知识文档与代码仓库关联，自动读取 README/ADR | P2 |
| **Jira/Linear 集成** | 知识文档关联 Issue/Ticket | P3 |
| **Confluence 迁移** | 批量导入 Confluence 空间 | P2 |
| **Notion 导入** | 已有策划，缺少实现 | P2 |
| **OpenAPI 导出** | 将 API 文档导出为 OpenAPI 规范 | P2 |

### 6.2 插件系统

```typescript
// 插件 API 设计 (Phase 4+)
interface KnowledgePlugin {
  id: string;
  name: string;
  version: string;
  
  // 生命周期
  onActivate?: () => void;
  onDeactivate?: () => void;
  
  // 扩展点
  hooks?: {
    // 文档处理
    beforeIndex?: (doc: KnowledgeDoc) => Promise<KnowledgeDoc>;
    afterExtract?: (doc: KnowledgeDoc) => Promise<KnowledgeDoc>;
    
    // 搜索
    beforeSearch?: (query: string) => Promise<string>;
    afterSearch?: (results: SearchResult[]) => Promise<SearchResult[]>;
    
    // 渲染
    renderCustom?: (doc: KnowledgeDoc) => string;
  };
  
  // UI 扩展
  ui?: {
    sidebarPanels?: PanelDefinition[];
    editorToolbar?: ToolbarItem[];
    settingsPanels?: SettingsPanel[];
  };
}
```

---

## 七、升级路线图

### 7.1 优先级矩阵

```
                      高影响
                        │
                        │
      P2: 知识推荐      │  P1: RBAC 权限
      P2: 搜索语法      │  P1: 文档评论与标注
      P2: 自定义元数据   │  P1: Web 剪藏
      P2: 多级标签      │  P1: 知识模板
                        │  P1: 审核工作流
                        │  P1: 知识分享
                        │  P1: 分面搜索
                        │  P1: 过期检测
                        │  P1: 实体级知识图谱
                        │
─────── 低努力 ─────────┼──────── 高努力 ──────
                        │
      P3: 阅读进度追踪   │  P2: 批量导入
      P3: SSO 集成      │  P2: 审计日志
      P3: TTS 朗读      │  P2: 插件系统
      P3: 多语种混合搜索  │  P2: 移动端知识模块
      P3: 水印          │  P2: 发布为网站
                        │  P2: AI 知识测验
                        │  P3: IM 导入
                        │
                        │
                      低影响
```

### 7.2 分阶段实施建议

```
Phase A (当前迭代 — 2 周): 夯实基础
├── RBAC 权限模型 (核心，依赖后续功能)
├── 知识文档版本管理 (版本是基础能力)
├── 分面搜索 (搜索体验提升显著)
└── 自定义元数据 (结构化基础)

Phase B (2 周): 协作与分享
├── 文档内评论与标注
├── 知识分享 (链接)
├── 审核工作流
└── 多级标签

Phase C (2 周): 智能增强
├── 实体级知识图谱
├── 知识推荐
├── 过期检测
└── Web 剪藏

Phase D (2 周): 深度 AI
├── 知识差异分析
├── AI Agent (健康巡检/链接建议/补全建议)
├── 知识测验生成
└── 增强搜索 (拼音/纠错/同义词)

Phase E (1 周): 扩展集成
├── 知识模板
├── 批量导入 (ZIP/ZIP with structure)
├── 导出 (PDF/Markdown/HTML)
└── 搜索结果聚类
```

---

## 八、与竞品的差距分析

| 能力 | NoteForge (当前) | Notion | Confluence | Obsidian | 目标 |
|------|:----------------:|:------:|:----------:|:--------:|:----:|
| 文件导入 | ⚠️ 设计中 | ✅ | ✅ | ⚠️ 插件 | ✅ |
| Web 剪藏 | ❌ | ✅ 扩展 | ❌ | ✅ 插件 | ✅ |
| 知识图谱 | ⚠️ 基础 | ❌ | ❌ | ✅ 插件 | ✅ (增强) |
| 审核工作流 | ❌ | ❌ | ✅ | ❌ | ✅ |
| RBAC | ❌ | ✅ 团队版 | ✅ | ❌ | ✅ |
| 评论/标注 | ❌ | ✅ | ✅ | ❌ | ✅ |
| 发布为网站 | ❌ | ✅ | ❌ | ✅ 插件 | ✅ |
| 分面搜索 | ❌ | ✅ 数据库 | ✅ | ⚠️ 插件 | ✅ |
| MCP 服务 | ⚠️ 设计中 | ❌ | ❌ | ❌ | ✅ (差异化) |
| 离线优先 | ✅ | ❌ | ❌ | ✅ | ✅ |
| AI 原生 | ⚠️ 部分 | ⚠️ 部分 | ⚠️ 部分 | ❌ | ✅ (差异化) |
| 端到端加密 | ⚠️ 设计 | ❌ | ❌ | ❌ | ✅ (差异化) |

> **核心差异化方向**: MCP 服务 + AI 原生 + 离线优先 — 竞品在这三个维度的交集是空白。

---

## 九、技术债务与架构风险

| 风险 | 描述 | 缓解措施 | 紧迫度 |
|------|------|---------|:------:|
| 分词器单点 | jieba-rs 维护不活跃 | 评估 pinyin 或更换为 tantivy-jieba | 低 |
| 向量索引膨胀 | pgvector IVFFLat 在 10 万+ 行后召回率下降 | 监控召回率，规划 Milvus 迁移 | 中 |
| AI 处理队列单点 | RabbitMQ 单节点故障会导致导入积压 | 配置 RabbitMQ 镜像队列 | 中 |
| LLM API 依赖 | AI 提取依赖外部 API，离线场景无法工作 | 规划本地小模型 (Phi-3/BGE) 兜底 | 中 |
| 权限模型后加 | 如果先做功能后加权限，改造量大 | 尽快构建权限模型骨架 | 高 |
| MCP 安全 | 开放 MCP 服务可能导致知识泄露 | API Key 认证 + IP 白名单 + 请求审计 | 高 |

---

## 十、总结

### 核心发现

1. **当前设计覆盖约 30% 的知识库关键能力**，基础架构（导入管道、搜索、MCP）已搭建，但治理、协作、智能推荐等较高阶能力仍有较大空间。

2. **6 个 P1 优先级最高的升级项**:
   - **RBAC 权限模型** — 缺少它，后续所有团队协作功能无法安全上线
   - **实体级知识图谱** — 将知识关联从文档级提升到实体级，质变
   - **Web 剪藏** — 最高频的知识捕获场景
   - **分面搜索** — 搜索体验的显著提升
   - **文档评论与标注** — 协作的最小可行能力
   - **审核工作流与过期检测** — 保证知识库质量不退化

3. **差异化优势方向**: MCP 服务 + AI 原生 + 离线优先是竞品难以快速跟进的组合，应作为长期重点投入。

4. **最大的技术债务**: 权限模型需要尽早设计骨架，否则后续功能会累积大规模改造工作。

---

*文档版本: v1.0*
*最后更新: 2026-06-30*
