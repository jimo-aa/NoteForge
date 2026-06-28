# NoteForge API 设计规范

## 一、通用规范

### 1.1 基础 URL

```
生产: https://api.noteforge.app/v1
开发: http://localhost:8080/v1
```

### 1.2 认证

```http
Authorization: Bearer <jwt_token>
```

### 1.3 请求格式

```json
// 成功响应
{
  "code": 0,
  "message": "success",
  "data": { ... }
}

// 错误响应
{
  "code": 40001,
  "message": "笔记不存在",
  "detail": "note_id=xxx 未找到"
}
```

### 1.4 错误码

| 范围 | 含义 |
|:----:|------|
| 0 | 成功 |
| 400xx | 请求参数错误 |
| 401xx | 认证错误 |
| 403xx | 权限不足 |
| 404xx | 资源不存在 |
| 429xx | 限流 |
| 500xx | 服务端错误 |

---

## 二、核心 API

### 2.1 笔记 API

```openapi
openapi: 3.0.0
info:
  title: NoteForge Note API
  version: v1

paths:
  /notes:
    post:
      summary: 创建笔记
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [title, content]
              properties:
                title:        { type: string, maxLength: 1024 }
                content:      { type: string }
                notebook_id:  { type: string, format: uuid }
                tags:         { type: array, items: { type: string } }
                editor_mode:  { type: string, enum: [wysiwyg, markdown] }
      responses:
        '200':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Note'

    get:
      summary: 获取笔记列表
      parameters:
        - name: notebook_id
          in: query
          schema: { type: string, format: uuid }
        - name: tag
          in: query
          schema: { type: string }
        - name: sort
          in: query
          schema: { type: string, enum: [updated_at, created_at, title] }
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: size
          in: query
          schema: { type: integer, default: 20, maximum: 100 }

  /notes/{note_id}:
    get:
      summary: 获取笔记详情
    put:
      summary: 更新笔记
    delete:
      summary: 删除笔记（软删除）

  /notes/{note_id}/version:
    get:
      summary: 获取版本历史
    post:
      summary: 创建版本快照

  /notes/{note_id}/backlinks:
    get:
      summary: 获取双向引用

  /search:
    get:
      summary: 全文搜索
      parameters:
        - name: q
          in: query
          required: true
          schema: { type: string }
        - name: mode
          in: query
          schema: { type: string, enum: [fulltext, semantic, hybrid] }
        - name: tag
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer, default: 1 }

components:
  schemas:
    Note:
      type: object
      properties:
        id:           { type: string, format: uuid }
        title:        { type: string }
        content:      { type: string }
        content_plain: { type: string }
        tags:         { type: array, items: { type: string } }
        links:        { type: array, items: { type: string } }
        notebook_id:  { type: string, format: uuid, nullable: true }
        word_count:   { type: integer }
        is_favorite:  { type: boolean }
        is_encrypted: { type: boolean }
        version:      { type: integer }
        created_at:   { type: string, format: date-time }
        updated_at:   { type: string, format: date-time }
```

### 2.2 AI API

```openapi
paths:
  /ai/complete:
    post:
      summary: AI 写作补全（流式）
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                context: { type: string }
                cursor_position: { type: integer }
                style: { type: string, enum: [continue, concise, detailed] }
      responses:
        '200':
          description: SSE 流式返回
          headers:
            Content-Type: text/event-stream

  /ai/summarize:
    post:
      summary: 生成摘要
      requestBody:
        content:
          application/json:
            schema:
              properties:
                note_id: { type: string, format: uuid }
                max_length: { type: integer, default: 200 }

  /ai/tags:
    post:
      summary: 自动生成标签
      requestBody:
        content:
          application/json:
            schema:
              properties:
                note_id: { type: string, format: uuid }

  /ai/knowledge-graph:
    get:
      summary: 获取知识图谱数据
      parameters:
        - name: note_id
          in: query
          schema: { type: string, format: uuid }

  /ai/ask:
    post:
      summary: 基于笔记库问答
      requestBody:
        content:
          application/json:
            schema:
              properties:
                question: { type: string }
                note_ids: { type: array, items: { type: string } }
```

### 2.3 同步 API

```openapi
paths:
  /sync/connect:
    get:
      summary: WebSocket 同步连接
      description: |
        升级为 WebSocket 连接，进行实时数据同步。
        同步协议基于 CRDT (Automerge)。

  /sync/state:
    get:
      summary: 获取同步状态
      responses:
        '200':
          content:
            application/json:
              schema:
                properties:
                  last_sync_at:  { type: string, format: date-time }
                  pending_changes: { type: integer }
                  conflicts:     { type: integer }

  /sync/pull:
    post:
      summary: 拉取远端变更
      requestBody:
        content:
          application/json:
            schema:
              properties:
                last_version: { type: integer }
                limit:       { type: integer, default: 100 }

  /sync/push:
    post:
      summary: 推送本地变更
      requestBody:
        content:
          application/json:
            schema:
              properties:
                changes: { type: array, items: { $ref: '#/components/schemas/Change' } }
```
