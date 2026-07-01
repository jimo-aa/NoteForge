# NoteForge 项目 README

> **全平台智能笔记系统** — 比 Notion 快，比 Obsidian 智能

---

## 📖 项目简介

**NoteForge** 是一个"AI 原生"的全平台智能笔记系统，集成了桌面端、Web端、移动端三大平台，拥有 Rust 高性能核心引擎和 AI 驱动的智能体验。

### 核心理念

```
💡 本地优先 + 全平台同步 + AI 原生 + 端到端加密
```

### 技术栈

| 端 | 技术 |
|:---|:-----|
| 🖥️ 桌面端 | Tauri 2.x + React 19 + Rust Core |
| 🌐 Web 端 | Next.js 15 + React 19 + PWA |
| 📱 移动端 | Flutter 3.x (iOS/Android) |
| ⚙️ 后端 | Java 21 + Spring Boot 3.x 微服务 |
| 🦀 核心引擎 | Rust (Markdown/搜索/加密/CRDT) |
| 🗄️ 数据层 | PostgreSQL/Redis/ES/MinIO/Milvus |

---

## 📂 目录结构

```
NoteForge/
├── README.md                          ← 本文件
├── NoteForge-策划案.md                ← 完整项目策划案 (32KB)
│
├── docs/
│   ├── architecture.md                ← 架构设计详解
│   ├── api-design.md                  ← API 设计文档
│   ├── database-schema.md             ← 数据库设计
│   ├── rust-engine.md                 ← Rust 核心引擎设计
│   ├── ai-features.md                 ← AI 功能设计
│   ├── sync-protocol.md               ← 同步协议设计
│   └── deployment.md                  ← 部署方案
│
├── assets/
│   ├── architecture.png               ← 架构图 (待制作)
│   └── screenshots/                   ← 界面截图 (待制作)
│
└── (后续各端代码在此展开)
```

---

## 🚀 快速导航

| 文档 | 说明 |
|------|------|
| [完整策划案](./NoteForge-策划案.md) | 项目全景：定位/架构/功能/计划 |
| [架构设计](./docs/architecture.md) | 系统分层设计、技术选型理由 |
| [API 设计](./docs/api-design.md) | RESTful API 规范 |
| [数据库设计](./docs/database-schema.md) | 完整 DDL、索引、ES Mapping |
| [Rust 引擎](./docs/rust-engine.md) | 核心引擎 API、依赖、设计 |
| [AI 功能](./docs/ai-features.md) | AI 写作/搜索/知识图谱 |
| [同步协议](./docs/sync-protocol.md) | CRDT 离线同步 |
| [部署方案](./docs/deployment.md) | Docker/K8s 部署 |

---

## 🔧 开发计划

```
Phase 1: MVP (4周)      
├── Rust 核心引擎
├── Tauri 桌面端
├── Java 后端基础
└── 基础同步

Phase 2: 完整客户端 (4周)  ← 现在
├── React Web 端
├── Flutter 移动端
├── 端到端加密
└── 全文搜索

Phase 3: AI 智能 (3周)
├── AI 写作助手
├── 自动标签 + 智能搜索
└── 知识图谱

Phase 4: 协作与发布 (3周)
├── 实时协作编辑
├── 分享 + 权限
└── 性能优化 + 发布
```
