# NoteForge MVP 后端架构设计

> 版本: v0.1 · 2026-06 · 对应 MVP 清单 Week 3-4

---

## 一、设计目标

| 维度 | MVP 要求 | 取舍 |
|------|---------|------|
| 功能 | 笔记 CRUD · 用户认证 · 基础同步 | 无 AI、图谱、协作 |
| 规模 | 单机部署, 100 并发 | 无 K8s、无网关、无 MQ |
| 速度 | 4 周交付 | 拆 note-service + user-service |
| 数据 | PostgreSQL + Redis + MinIO | 无 ES、无 Milvus |

---

## 二、整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                         Nginx (反向代理)                      │
│               /api/v1/notes/* → note-service:8081            │
│               /api/v1/users/*  → user-service:8082           │
│               /ws/sync/*       → note-service:8081           │
└──────────────────────┬───────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│   note-service   │    │   user-service   │
│   Spring Boot    │    │   Spring Boot    │
│   :8081          │    │   :8082          │
├──────────────────┤    ├──────────────────┤
│ NoteController   │    │ AuthController   │
│ SyncController   │    │ UserController   │
│ TagController    │    │                  │
│ NotebookCtrl     │    │                  │
│ ──────────────   │    │ ──────────────   │
│ NoteService      │    │ AuthService      │
│ SyncService      │    │ UserService      │
│ ──────────────   │    │ ──────────────   │
│ NoteRepository   │    │ UserRepository   │
│ SyncLogRepo      │    │                  │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
      ┌─────────────────────────────┐
      │       PostgreSQL 16         │
      │  (pgvector, uuid-ossp)      │
      │  notes / users / sync_logs  │
      └─────────────┬───────────────┘
                    │
         ┌─────────┴──────────┐
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │  Redis   │        │  MinIO   │
   │ 缓存/队列 │        │ 附件存储 │
   └──────────┘        └──────────┘
```

### 2.1 MVP 与完整架构的差异

| 完整架构 | MVP 简化 | 原因 |
|---------|---------|------|
| API Gateway | Nginx 简单路由 | MVP 只有 2 个服务 |
| RabbitMQ | Redis Pub/Sub 替代 | 减少运维复杂度 |
| K8s | Docker Compose | 单机部署就够了 |
| ES 全文搜索 | PostgreSQL `to_tsvector` | mv 级别搜索够用 |
| Milvus 向量库 | 不用 | AI 功能 Phase 3 才上 |
| OpenTelemetry | 日志文件 + Spring Actuator | MVP 不设可观测性设施 |

---

## 三、服务拆分 (Multi-Module Gradle)

```
backend/
├── settings.gradle
├── build.gradle                 # 根项目通用配置
├── note-service/
│   ├── build.gradle             # 已有，补充依赖
│   └── src/main/java/com/noteforge/note/
│       ├── NoteServiceApplication.java
│       ├── config/
│       │   ├── WebSocketConfig.java
│       │   ├── SecurityConfig.java
│       │   └── RedisConfig.java
│       ├── controller/
│       │   ├── NoteController.java
│       │   ├── NotebookController.java
│       │   ├── TagController.java
│       │   └── SyncController.java
│       ├── service/
│       │   ├── NoteService.java
│       │   ├── NotebookService.java
│       │   ├── TagService.java
│       │   └── SyncService.java
│       ├── entity/
│       │   ├── NoteEntity.java
│       │   ├── NotebookEntity.java
│       │   ├── TagEntity.java
│       │   └── SyncLogEntity.java
│       ├── repository/
│       │   ├── NoteRepository.java
│       │   ├── NotebookRepository.java
│       │   ├── TagRepository.java
│       │   └── SyncLogRepository.java
│       ├── dto/
│       │   ├── NoteCreateRequest.java
│       │   ├── NoteUpdateRequest.java
│       │   ├── NoteResponse.java
│       │   ├── SyncPullRequest.java
│       │   └── SyncPushRequest.java
│       └── exception/
│           ├── GlobalExceptionHandler.java
│           └── ResourceNotFoundException.java
├── user-service/
│   ├── build.gradle
│   └── src/main/java/com/noteforge/user/
│       ├── UserServiceApplication.java
│       ├── config/
│       │   └── SecurityConfig.java
│       ├── controller/
│       │   ├── AuthController.java
│       │   └── UserController.java
│       ├── service/
│       │   ├── AuthService.java
│       │   └── UserService.java
│       ├── entity/
│       │   └── UserEntity.java
│       ├── repository/
│       │   └── UserRepository.java
│       ├── dto/
│       │   ├── LoginRequest.java
│       │   ├── RegisterRequest.java
│       │   └── UserResponse.java
│       └── security/
│           ├── JwtTokenProvider.java
│           ├── JwtAuthFilter.java
│           └── UserDetailsServiceImpl.java
└── common/                       # 可选，MVP 先冗余
    └── src/main/java/com/noteforge/common/
        ├── response/
        │   ├── ApiResponse.java
        │   └── PageResponse.java
        └── util/
            └── StringUtils.java
```

### 3.1 依赖说明

note-service/build.gradle 需要补充的依赖:

```gradle
dependencies {
    // Spring Boot
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.springframework.boot:spring-boot-starter-websocket'

    // Database
    runtimeOnly 'org.postgresql:postgresql'

    // Redis
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'

    // JWT
    implementation 'io.jsonwebtoken:jjwt-api:0.12.5'
    runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.5'
    runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.5'

    // Utils
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.5.0'

    // MinIO
    implementation 'io.minio:minio:8.5.10'

    // Test
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
    testImplementation 'com.h2database:h2'  // 测试用内存库
}
```

---

## 四、API 路由规划

### 4.1 note-service (:8081)

```
POST   /api/v1/notes                 → createNote
GET    /api/v1/notes                 → listNotes    (userId, notebookId, tag, page, size)
GET    /api/v1/notes/{id}            → getNote
PUT    /api/v1/notes/{id}            → updateNote   (title, content, tags, notebookId, isPinned, isFavorite)
DELETE /api/v1/notes/{id}            → deleteNote   (软删除)

POST   /api/v1/notebooks             → createNotebook
GET    /api/v1/notebooks             → listNotebooks (userId)
PUT    /api/v1/notebooks/{id}        → renameNotebook
DELETE /api/v1/notebooks/{id}        → deleteNotebook

POST   /api/v1/tags                  → createTag
GET    /api/v1/tags                  → listTags     (userId)
DELETE /api/v1/tags/{id}             → deleteTag

GET    /api/v1/notes/search          → searchNotes  (q, userId, page, size) — PG 全文检索

WS     /ws/sync                      → SyncWebSocket (身份认证后实时同步)
```

### 4.2 user-service (:8082)

```
POST   /api/v1/auth/register         → register  (email, password, name)
POST   /api/v1/auth/login            → login     (email, password) → JWT
POST   /api/v1/auth/refresh          → refresh   (refreshToken) → JWT
GET    /api/v1/users/me              → getMe     (当前用户信息)
PUT    /api/v1/users/me              → updateMe  (name, avatar)
```

### 4.3 Nginx 路由规则

```nginx
upstream note-svc { server 127.0.0.1:8081; }
upstream user-svc { server 127.0.0.1:8082; }

server {
    listen 80;
    server_name api.noteforge.local;

    # note-service
    location /api/v1/notes { proxy_pass http://note-svc; }
    location /api/v1/notebooks { proxy_pass http://note-svc; }
    location /api/v1/tags { proxy_pass http://note-svc; }
    location /ws/sync {
        proxy_pass http://note-svc;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # user-service
    location /api/v1/auth { proxy_pass http://user-svc; }
    location /api/v1/users { proxy_pass http://user-svc; }
}
```

---

## 五、数据模型

### 5.1 NoteEntity (已有 → 补充)

```java
@Entity
@Table(name = "notes")
public class NoteEntity {
    @Id private String id;                         // UUID

    @Column(nullable = false)
    private String userId;                         // 所属用户

    private String notebookId;                     // 所属笔记本 (null=未分类)

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(columnDefinition = "TEXT")
    private String contentPlain;                   // 纯文本，用于搜索

    @ElementCollection
    @CollectionTable(name = "note_tags",
        joinColumns = @JoinColumn(name = "note_id"))
    @Column(name = "tag_name")
    private List<String> tags;                     // 标签名列表

    private boolean isPinned;
    private boolean isFavorite;
    private boolean isDeleted;
    private int wordCount;
    private int version;                           // 乐观锁版本

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

### 5.2 新增实体

```java
// NotebookEntity
@Entity @Table(name = "notebooks")
public class NotebookEntity {
    @Id private String id;
    @Column(nullable = false) private String userId;
    @Column(nullable = false) private String name;
    private String icon;       // 默认 "📁"
    private String color;      // 默认 "#6366f1"
    private String parentId;   // 父笔记本，支持层级
    private int sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

// TagEntity
@Entity @Table(name = "tags")
public class TagEntity {
    @Id private String id;
    @Column(nullable = false) private String userId;
    @Column(nullable = false, unique = true) private String name;
    private String color;
}

// SyncLogEntity
@Entity @Table(name = "sync_logs")
public class SyncLogEntity {
    @Id private String id;
    @Column(nullable = false) private String noteId;
    @Column(nullable = false) private String userId;
    @Column(nullable = false) private String operation; // CREATE|UPDATE|DELETE
    @Column(columnDefinition = "TEXT") private String snapshot; // 变更后的 JSON
    private long version;         // 单调递增版本号
    private LocalDateTime createdAt;
}
```

### 5.3 索引设计

```sql
-- notes
CREATE INDEX idx_notes_user ON notes(user_id, updated_at DESC);
CREATE INDEX idx_notes_notebook ON notes(user_id, notebook_id);
CREATE INDEX idx_notes_favorite ON notes(user_id, is_favorite) WHERE NOT is_deleted;
CREATE INDEX idx_notes_fts ON notes USING GIN(to_tsvector('simple', title || ' ' || content_plain));

-- notebooks
CREATE INDEX idx_notebooks_user ON notebooks(user_id);

-- tags
CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, name);

-- note_tags
CREATE INDEX idx_note_tags_note ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag ON note_tags(tag_name);

-- sync_logs
CREATE INDEX idx_sync_logs_user ON sync_logs(user_id, version);
CREATE INDEX idx_sync_logs_note ON sync_logs(note_id);
```

---

## 六、认证与安全

### 6.1 JWT 策略

```
Access Token:  15 分钟过期, 放在 Authorization header
Refresh Token: 7 天过期, 放在 httpOnly cookie

Payload:
{
  "sub": "userId",
  "email": "user@example.com",
  "iat": 1718000000,
  "exp": 1718000900
}
```

### 6.2 服务间认证

```
note-service 信任 user-service —— MVP 阶段两个服务共享同个 JWT secret。
每个请求经 JwtAuthFilter 校验后注入 SecurityContext。
```

### 6.3 密码策略

```java
// 使用 BCrypt (Spring Security 内置)
PasswordEncoder encoder = new BCryptPasswordEncoder(12);
String hash = encoder.encode(rawPassword);    // 存储
boolean match = encoder.matches(rawPassword, hash); // 校验
```

---

## 七、同步机制 (MVP 基础版)

### 7.1 流程

```
┌──────────┐          ┌──────────────┐          ┌──────────┐
│  Desktop  │          │  SyncService  │          │    DB    │
│  (Client) │          │  (Server)     │          │          │
└────┬─────┘          └──────┬───────┘          └────┬─────┘
     │                       │                       │
     │  1. 连接 /ws/sync     │                       │
     │──────────────────────>│                       │
     │  2. 发送 lastVersion  │                       │
     │──────────────────────>│                       │
     │                       │  3. 查询增量变更      │
     │                       │──────────────────────>│
     │                       │  4. 变更列表          │
     │                       │<──────────────────────│
     │  5. 返回变更 JSON     │                       │
     │<──────────────────────│                       │
     │  6. 本地合并 + 冲突   │                       │
     │  处理，推送本地变更    │                       │
     │──────────────────────>│                       │
     │                       │  7. 写入 sync_logs    │
     │                       │──────────────────────>│
```

### 7.2 冲突处理策略 (MVP)

| 场景 | 策略 |
|------|------|
| 同一字段不同修改 | **Last-Write-Wins** — 以最新时间戳为准 |
| 不同字段同时修改 | **自动合并** — 各自字段互不影响 |
| 服务端已删除 vs 客户端修改 | **删除优先** — 返回 409 Conflict |

MVP 不做 CRDT 全量合并，使用简单的版本号 + 时间戳 + 字段级合并。

---

## 八、缓存策略

| 缓存对象 | 存储 | TTL | 失效条件 |
|---------|------|:---:|---------|
| 笔记列表 (userId) | Redis | 60s | 创建/更新/删除笔记 |
| 笔记本列表 (userId) | Redis | 120s | 创建/更新/删除笔记本 |
| JWT 黑名单 | Redis | 同 Access Token 剩余时间 | 主动登出时写入 |
| 用户信息 | Redis | 300s | 更新个人资料 |

```java
// 缓存注解示例
@Cacheable(value = "notes:list", key = "#userId", unless = "#result == null")
public List<NoteResponse> listNotes(String userId) { ... }

@CacheEvict(value = "notes:list", key = "#userId")
public NoteResponse createNote(String userId, NoteCreateRequest req) { ... }
```

---

## 九、错误处理规范

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(404).body(ApiResponse.error(40401, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(ApiResponse.error(40001, msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnknown(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(500).body(ApiResponse.error(50000, "服务器内部错误"));
    }
}
```

---

## 十、开发指南

### 10.1 本地启动

```bash
# 1. 启动基础设施
docker compose -f infra/docker-compose.yml up -d

# 2. 启动 user-service
cd backend/user-service
./gradlew bootRun

# 3. 启动 note-service
cd backend/note-service
./gradlew bootRun

# 4. 验证
curl http://localhost:8082/api/v1/auth/health
curl http://localhost:8081/api/v1/notes/health
```

### 10.2 配置文件结构

```
note-service/src/main/resources/
├── application.yml           # 通用配置
├── application-dev.yml       # 开发环境 (H2 + 本地 Redis)
├── application-prod.yml      # 生产环境 (PostgreSQL + 云 Redis)
└── application-test.yml      # 测试环境 (H2 内存库)
```

```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/noteforge
    username: noteforge
    password: noteforge123
  jpa:
    hibernate:
      ddl-auto: update     # 开发阶段自动建表
    show-sql: true
  data:
    redis:
      host: localhost
      port: 6379

minio:
  endpoint: http://localhost:9000
  access-key: noteforge
  secret-key: noteforge123
  bucket: noteforge-attachments

jwt:
  secret: dev-secret-key-not-for-production
  access-token-expiration: 900000     # 15min
  refresh-token-expiration: 604800000 # 7天
```

### 10.3 测试策略

| 层级 | 工具 | 覆盖内容 |
|------|------|---------|
| 单元测试 | JUnit 5 + Mockito | Service 层逻辑 |
| 集成测试 | SpringBootTest + H2 | Repository + Controller |
| API 测试 | REST Assured / WebTestClient | 完整请求响应链路 |
| 同步测试 | WebSocket Test | 多客户端并发同步 |

```bash
# 运行所有测试
cd backend && ./gradlew test

# 运行单个服务测试
cd backend/note-service && ./gradlew test
```

### 10.4 MVP 交付检查清单

- [ ] user-service: 注册/登录/刷新 JWT
- [ ] note-service: 笔记 CRUD + 笔记本 + 标签
- [ ] note-service: PG 全文搜索
- [ ] note-service: WebSocket 基础同步
- [ ] note-service: MinIO 附件上传
- [ ] Redis 缓存 (笔记本列表/笔记列表)
- [ ] 统一错误处理 + 响应格式
- [ ] Nginx 反向代理配置
- [ ] 集成测试覆盖核心 API
- [ ] Docker Compose 一键启动

---

## 十一、与桌面端的数据对齐

桌面端 (Tauri + Rust) 和后端 (Java) 共享相同的数据模型，通过 JSON 序列化对齐：

| Rust (core) | Java (backend) | DB 列 |
|-------------|---------------|-------|
| `Note` | `NoteEntity` | `notes` 表 |
| `NoteMeta` | (部分字段) | `title, tags, notebook_id` |
| `Notebook` | `NotebookEntity` | `notebooks` 表 |
| `generate_id()` | `UUID.randomUUID()` | 同 UUID v4 |
| `now_ms()` | `LocalDateTime.now()` | 不同精度, 同步时归一化为毫秒 |

> 同步协议中时间戳统一使用 **毫秒级 Unix Timestamp (i64)**，避免时区和精度问题。

---

## 十二、落地顺序建议

为了避免一次性铺太多基础设施，建议按下面顺序实现：

1. **先打通 user-service**
   - 注册、登录、刷新 Token
   - JWT 校验与 `GET /api/v1/users/me`
   - 统一响应格式与异常处理

2. **再完成 note-service 核心 CRUD**
   - 笔记、笔记本、标签的增删改查
   - 软删除、分页、排序、收藏/置顶
   - PostgreSQL 索引与基础缓存

3. **补齐搜索与同步**
   - `to_tsvector` 全文检索
   - WebSocket 同步协议最小闭环
   - `sync_logs` 版本推进与冲突处理

4. **最后接入附件与运维配置**
   - MinIO 上传下载
   - Nginx 反向代理
   - Docker Compose 一键启动与集成测试

### 12.1 MVP 验收标准

当以下条件全部满足时，可视为后端 MVP 完成：

- 用户可完成注册、登录、刷新令牌
- 笔记、笔记本、标签可正常 CRUD
- 笔记可按关键词搜索
- 桌面端可通过 WebSocket 拉取增量变更
- 附件可上传到 MinIO 并回显访问地址
- 所有接口返回统一的错误结构
- 本地可通过 Docker Compose 完整启动

### 12.2 当前文档结论

这个后端方案的目标不是一次性实现“完整云端协作平台”，而是先把 **认证、笔记数据、搜索、同步、附件** 这五条主链路跑通。

MVP 阶段优先保证：

- 数据模型和桌面端对齐
- 接口边界清晰、可扩展
- 运行和调试成本低
- 后续可以平滑演进到更完整的多端协作架构
