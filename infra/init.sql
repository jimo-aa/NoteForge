-- ============================================================
-- NoteForge — 数据库初始化脚本
-- 基于 backend/ JPA 实体生成（Hibernate 6 + PostgreSQL）
-- 命名策略: CamelCaseToUnderscoresNamingStrategy
-- 8 个 JPA 实体 + 1 个 collection table + 补充索引/触发器
-- ============================================================

-- ============================================================
-- 0. 扩展
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;            -- pgvector: AI 向量搜索
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID 生成函数

-- ============================================================
-- 1. 触发器函数: 自动更新 updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.updated_at IS NOT DISTINCT FROM NEW.updated_at THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. 表定义 —— 精确匹配 JPA 实体
-- ============================================================

-- ============================================================
-- 2.1 users — 用户
-- 对应: UserEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(255),
    created_at      TIMESTAMP(6) NOT NULL,
    updated_at      TIMESTAMP(6) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  users    IS '用户';
COMMENT ON COLUMN users.email IS '登录邮箱（唯一）';
COMMENT ON COLUMN users.password_hash IS 'bcrypt 密码哈希';
COMMENT ON COLUMN users.name IS '显示名称';
COMMENT ON COLUMN users.avatar_url IS '头像 URL';

-- ============================================================
-- 2.2 notebooks — 笔记本（文件夹/嵌套）
-- 对应: NotebookEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS notebooks (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    icon            VARCHAR(255),
    color           VARCHAR(255),
    parent_id       VARCHAR(255),
    sort_order      INTEGER NOT NULL,
    is_deleted      BOOLEAN NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL,
    updated_at      TIMESTAMP(6) NOT NULL
);

-- 兼容：已有 notebooks 表缺少 is_deleted 列
DO $migrate$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notebooks' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE notebooks ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE '[NoteForge] notebooks: 已添加 is_deleted 列';
    END IF;
END
$migrate$;

CREATE INDEX IF NOT EXISTS idx_notebooks_user   ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_parent ON notebooks(parent_id);

DROP TRIGGER IF EXISTS trg_notebooks_updated_at ON notebooks;
CREATE TRIGGER trg_notebooks_updated_at
    BEFORE UPDATE ON notebooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  notebooks             IS '笔记本（文件夹）';
COMMENT ON COLUMN notebooks.user_id     IS '所属用户';
COMMENT ON COLUMN notebooks.name        IS '笔记本名称';
COMMENT ON COLUMN notebooks.icon        IS '图标（emoji）';
COMMENT ON COLUMN notebooks.color       IS '主题色（hex）';
COMMENT ON COLUMN notebooks.parent_id   IS '父笔记本（嵌套结构）';
COMMENT ON COLUMN notebooks.sort_order  IS '排序顺序';
COMMENT ON COLUMN notebooks.is_deleted  IS '软删除标记';

-- ============================================================
-- 2.3 notes — 笔记
-- 对应: NoteEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    notebook_id     VARCHAR(255),
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    content_plain   TEXT,
    is_pinned       BOOLEAN NOT NULL,
    is_favorite     BOOLEAN NOT NULL,
    is_deleted      BOOLEAN NOT NULL,
    word_count      INTEGER NOT NULL,
    version         INTEGER NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL,
    updated_at      TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user       ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_notebook   ON notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated    ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_favorite   ON notes(user_id, is_favorite) WHERE is_favorite;
CREATE INDEX IF NOT EXISTS idx_notes_pinned     ON notes(user_id, is_pinned) WHERE is_pinned;
CREATE INDEX IF NOT EXISTS idx_notes_fts        ON notes USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_plain, '')));

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  notes               IS '笔记';
COMMENT ON COLUMN notes.user_id       IS '所属用户';
COMMENT ON COLUMN notes.notebook_id   IS '所属笔记本';
COMMENT ON COLUMN notes.title         IS '标题';
COMMENT ON COLUMN notes.content       IS '富文本内容（HTML/Markdown）';
COMMENT ON COLUMN notes.content_plain IS '纯文本内容（用于搜索）';
COMMENT ON COLUMN notes.is_pinned     IS '置顶标记';
COMMENT ON COLUMN notes.is_favorite   IS '收藏标记';
COMMENT ON COLUMN notes.is_deleted    IS '软删除标记';
COMMENT ON COLUMN notes.word_count    IS '字数统计';
COMMENT ON COLUMN notes.version       IS '版本号（每次更新递增）';

-- ============================================================
-- 2.4 note_tags — 笔记-标签关联集合（JPA @ElementCollection）
-- 对应: NoteEntity.tags
-- ============================================================
CREATE TABLE IF NOT EXISTS note_tags (
    note_id     VARCHAR(255) NOT NULL,
    tag_name    VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag  ON note_tags(tag_name);

COMMENT ON TABLE  note_tags IS '笔记-标签关联（JPA @ElementCollection）';
COMMENT ON COLUMN note_tags.note_id  IS '笔记 ID';
COMMENT ON COLUMN note_tags.tag_name IS '标签名称';

-- ============================================================
-- 2.5 note_versions — 笔记版本历史
-- 对应: NoteVersionEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS note_versions (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    note_id         VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    version_number  INTEGER NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    content_plain   TEXT,
    created_at      TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note   ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_number ON note_versions(note_id, version_number);

COMMENT ON TABLE  note_versions               IS '笔记版本历史';
COMMENT ON COLUMN note_versions.note_id        IS '笔记 ID';
COMMENT ON COLUMN note_versions.user_id        IS '操作用户';
COMMENT ON COLUMN note_versions.version_number IS '版本号';
COMMENT ON COLUMN note_versions.title          IS '当前标题';
COMMENT ON COLUMN note_versions.content        IS '当前内容';

-- ============================================================
-- 2.6 note_links — 笔记内链（Wiki 链接）
-- 对应: NoteLinkEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS note_links (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    source_note_id  VARCHAR(255) NOT NULL,
    target_note_id  VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);

COMMENT ON TABLE  note_links                 IS '笔记 Wiki 内链';
COMMENT ON COLUMN note_links.source_note_id   IS '源笔记';
COMMENT ON COLUMN note_links.target_note_id   IS '目标笔记';
COMMENT ON COLUMN note_links.user_id          IS '所属用户';

-- ============================================================
-- 2.7 tags — 标签
-- 对应: TagEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    color           VARCHAR(255),
    created_at      TIMESTAMP(6) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

COMMENT ON TABLE  tags          IS '标签';
COMMENT ON COLUMN tags.user_id  IS '所属用户';
COMMENT ON COLUMN tags.name     IS '标签名称（唯一）';
COMMENT ON COLUMN tags.color    IS '标签颜色';

-- ============================================================
-- 2.8 sync_logs — 同步日志
-- 对应: SyncLogEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    note_id         VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    operation       VARCHAR(255) NOT NULL,
    snapshot        TEXT,
    version         BIGINT NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_version ON sync_logs(user_id, version);
CREATE INDEX IF NOT EXISTS idx_sync_logs_note         ON sync_logs(note_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created      ON sync_logs(created_at);

COMMENT ON TABLE  sync_logs              IS '同步日志（记录笔记变更）';
COMMENT ON COLUMN sync_logs.note_id       IS '变更笔记';
COMMENT ON COLUMN sync_logs.user_id       IS '操作用户';
COMMENT ON COLUMN sync_logs.operation     IS '操作类型（CREATE/UPDATE/DELETE）';
COMMENT ON COLUMN sync_logs.snapshot      IS '变更快照（JSON）';
COMMENT ON COLUMN sync_logs.version       IS '版本时间戳（毫秒）';

-- ============================================================
-- 2.9 attachments — 附件
-- 对应: AttachmentEntity
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    note_id         VARCHAR(255),
    filename        VARCHAR(255) NOT NULL,
    content_type    VARCHAR(255),
    size            BIGINT NOT NULL,
    url             VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);

COMMENT ON TABLE  attachments               IS '附件';
COMMENT ON COLUMN attachments.user_id        IS '上传用户';
COMMENT ON COLUMN attachments.note_id        IS '所属笔记';
COMMENT ON COLUMN attachments.filename       IS '原始文件名';
COMMENT ON COLUMN attachments.content_type   IS 'MIME 类型';
COMMENT ON COLUMN attachments.size           IS '文件大小（字节）';
COMMENT ON COLUMN attachments.url            IS '存储路径 / MinIO 地址';

-- ============================================================
-- 2.10 audit_logs — 操作审计日志
-- 对应: AuditLogEntity (P2 #23)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              VARCHAR(64)   PRIMARY KEY,                             -- UUID
    user_id         VARCHAR(64)   NOT NULL,                                -- 操作人
    action          VARCHAR(64)   NOT NULL,                                -- CREATE | DELETE | EXPORT | PERMISSION_CHANGE 等
    resource_type   VARCHAR(64)   NOT NULL,                                -- NOTE | NOTEBOOK | TAG | ENCRYPTION 等
    resource_id     VARCHAR(256),                                          -- 被操作资源 ID
    detail          TEXT,                                                   -- 操作详情
    ip_address      VARCHAR(64)   NOT NULL DEFAULT 'unknown',              -- 客户端 IP
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource  ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs(created_at DESC);

COMMENT ON TABLE  audit_logs                IS '操作审计日志';
COMMENT ON COLUMN audit_logs.user_id        IS '操作人';
COMMENT ON COLUMN audit_logs.action         IS '操作类型';
COMMENT ON COLUMN audit_logs.resource_type  IS '资源类型';
COMMENT ON COLUMN audit_logs.resource_id    IS '被操作资源 ID';
COMMENT ON COLUMN audit_logs.detail         IS '操作详情';
COMMENT ON COLUMN audit_logs.ip_address     IS '客户端 IP';

-- ============================================================
-- 3. 补充说明
-- ============================================================
-- 此脚本精确匹配 JPA Hibernate 6 生成的 DDL。
-- 后端启动时 spring.jpa.hibernate.ddl-auto=update 不会变更表结构。
-- 额外添加：
--   - pgvector 扩展（AI 向量搜索）
--   - 性能索引（JPA 只建 PK 和 UNIQUE 索引）
--   - update_updated_at_column() 触发器（JPA @PreUpdate 的 DB 级备份）
-- ============================================================
