-- NoteForge 数据库初始化脚本
-- 自动在 Docker 启动时执行 (docker-entrypoint-initdb.d/)
-- 目标 PostgreSQL 16 + pgvector
--
-- 模块划分：
--   1. 用户模块 (user-service)    — users, refresh_tokens
--   2. 笔记模块 (note-service)    — notebooks, notes, tags, note_tags, note_versions, note_links, note_embeddings
--   3. 同步模块 (note-service)    — sync_logs
--   4. 附件模块 (note-service)    — attachments
--   5. 协作模块 (未来)            — share_links

-- ============================================================
-- 0. 扩展
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;            -- pgvector: AI 向量搜索
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";       -- UUID 生成函数

-- ============================================================
-- 0. 辅助函数
-- ============================================================

-- 自动更新 updated_at 列的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. 用户模块 (user-service)
-- ============================================================

-- 1.1 users — 用户账号
-- 对应 Java: UserEntity
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(64)  PRIMARY KEY,                             -- UUID (Java 生成)
    email           VARCHAR(256) NOT NULL UNIQUE,                         -- 登录邮箱
    password_hash   VARCHAR(512) NOT NULL,                                -- bcrypt 密码哈希
    name            VARCHAR(128) NOT NULL,                                -- 显示名称
    avatar_url      VARCHAR(512),                                         -- 头像 URL
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.2 refresh_tokens — JWT 刷新令牌存储
-- 支持令牌轮换和撤销；不存明文 token，只存哈希
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              VARCHAR(64)  PRIMARY KEY,                             -- UUID
    user_id         VARCHAR(64)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(512) NOT NULL UNIQUE,                         -- 令牌哈希
    expires_at      TIMESTAMPTZ  NOT NULL,                                -- 过期时间
    revoked         BOOLEAN      NOT NULL DEFAULT FALSE,                  -- 是否已撤销
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active  ON refresh_tokens(expires_at) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup ON refresh_tokens(expires_at) WHERE revoked = FALSE;

-- ============================================================
-- 2. 笔记模块 (note-service)
-- ============================================================

-- 2.1 notebooks — 笔记本
-- 对应 Java: NotebookEntity
CREATE TABLE IF NOT EXISTS notebooks (
    id              VARCHAR(64)  PRIMARY KEY,                             -- UUID
    user_id         VARCHAR(64)  NOT NULL,                                -- 所属用户
    name            VARCHAR(256) NOT NULL DEFAULT '未命名',
    icon            VARCHAR(32)  DEFAULT '📁',
    color           VARCHAR(7)   DEFAULT '#6366f1',
    parent_id       VARCHAR(64)  REFERENCES notebooks(id) ON DELETE SET NULL,  -- 父笔记本（嵌套）
    sort_order      INT          NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebooks_user   ON notebooks(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notebooks_parent ON notebooks(parent_id);

DROP TRIGGER IF EXISTS trg_notebooks_updated_at ON notebooks;
CREATE TRIGGER trg_notebooks_updated_at
    BEFORE UPDATE ON notebooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.2 notes — 笔记
-- 对应 Java: NoteEntity
CREATE TABLE IF NOT EXISTS notes (
    id              VARCHAR(64)   PRIMARY KEY,                            -- UUID
    user_id         VARCHAR(64)   NOT NULL,
    notebook_id     VARCHAR(64)   REFERENCES notebooks(id) ON DELETE SET NULL,
    title           VARCHAR(1024) NOT NULL DEFAULT '',
    content         TEXT          NOT NULL DEFAULT '',                     -- Markdown（可能加密）
    content_plain   TEXT,                                                   -- 纯文本（供搜索）
    is_pinned       BOOLEAN       NOT NULL DEFAULT FALSE,
    is_favorite     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
    word_count      INT           NOT NULL DEFAULT 0,
    version         INT           NOT NULL DEFAULT 1,                      -- 乐观锁
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 列表与筛选索引
CREATE INDEX IF NOT EXISTS idx_notes_user      ON notes(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notes_notebook  ON notes(notebook_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notes_updated   ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_favorite  ON notes(user_id, is_favorite) WHERE NOT is_deleted AND is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_pinned    ON notes(user_id, is_pinned) WHERE NOT is_deleted AND is_pinned = TRUE;
-- 全文搜索 GIN 索引（PostgreSQL 原生，作为 Tantivy/ES 的兜底）
CREATE INDEX IF NOT EXISTS idx_notes_fts       ON notes USING GIN(
    to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content_plain, ''))
) WHERE NOT is_deleted;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.3 tags — 标签元数据
-- 对应 Java: TagEntity
CREATE TABLE IF NOT EXISTS tags (
    id              VARCHAR(64) PRIMARY KEY,                               -- UUID
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(64) NOT NULL,
    color           VARCHAR(7)  DEFAULT '#6366f1',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)                                                  -- 每个用户的标签名唯一
);

CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- 2.4 note_tags — 笔记-标签关联
-- 对应 Java: NoteEntity.@ElementCollection
-- 直接存 tag_name 避免频繁 JOIN tags 表
CREATE TABLE IF NOT EXISTS note_tags (
    note_id         VARCHAR(64) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_name        VARCHAR(64) NOT NULL,
    PRIMARY KEY (note_id, tag_name)
);

CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_name);

-- 2.5 note_versions — 笔记版本历史
-- 对应 Java: NoteVersionEntity
CREATE TABLE IF NOT EXISTS note_versions (
    id              VARCHAR(64)   PRIMARY KEY,                             -- UUID
    note_id         VARCHAR(64)   NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id         VARCHAR(64)   NOT NULL,
    version_number  INT           NOT NULL,
    title           VARCHAR(1024) NOT NULL,
    content         TEXT          NOT NULL DEFAULT '',
    content_plain   TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(note_id, version_number)                                        -- 每个笔记的版本号唯一
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note   ON note_versions(note_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_number ON note_versions(note_id, version_number DESC);

-- 2.6 note_links — 笔记双向链接（[[Wiki Link]] 解析结果）
-- 对应 Java: NoteLinkEntity
CREATE TABLE IF NOT EXISTS note_links (
    id              VARCHAR(64) PRIMARY KEY,                               -- UUID
    source_note_id  VARCHAR(64) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id  VARCHAR(64) NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id         VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_note_id, target_note_id, user_id)                        -- 防止重复链接
);

CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id, user_id);

-- 2.7 note_embeddings — 笔记向量嵌入（AI 语义搜索）
-- design doc: note_embeddings (pgvector)
-- 仅在 pgvector 扩展已安装时创建；否则静默跳过（SQL 不支持条件 DDL，
-- 因此通过 PL/pgSQL 动态执行）
DO $block$
DECLARE
    has_vector BOOLEAN;
BEGIN
    -- 检测 vector 类型是否存在（由 pgvector 扩展提供）
    SELECT EXISTS(
        SELECT 1 FROM pg_type WHERE typname = 'vector'
    ) INTO has_vector;

    IF NOT has_vector THEN
        RAISE NOTICE '[NoteForge] pgvector 扩展未安装 — 跳过 note_embeddings 表创建';
        RETURN;
    END IF;

    CREATE TABLE IF NOT EXISTS note_embeddings (
        id              VARCHAR(64)  PRIMARY KEY,
        note_id         VARCHAR(64)  NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        user_id         VARCHAR(64)  NOT NULL,
        chunk_index     INT          NOT NULL DEFAULT 0,                    -- 长文分块序号
        chunk_text      TEXT         NOT NULL,                              -- 分块原文
        embedding       VECTOR(1536),                                       -- OpenAI text-embedding-3-small
        model           VARCHAR(64)  NOT NULL DEFAULT 'text-embedding-3-small',
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE(note_id, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS idx_note_embeddings_note  ON note_embeddings(note_id);
    CREATE INDEX IF NOT EXISTS idx_note_embeddings_user  ON note_embeddings(user_id);
    -- IVFFlat 近似最近邻索引（余弦距离）
    CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector ON note_embeddings
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    COMMENT ON TABLE note_embeddings IS '笔记向量嵌入 — AI 语义搜索（pgvector）';

    RAISE NOTICE '[NoteForge] note_embeddings 表及向量索引已创建';
END
$block$;

-- ============================================================
-- 3. 同步模块 (note-service)
-- ============================================================

-- 3.1 sync_logs — 同步操作日志
-- 对应 Java: SyncLogEntity
-- 基于版本号的增量同步；snapshot 字段存操作后的完整笔记 JSON
CREATE TABLE IF NOT EXISTS sync_logs (
    id              VARCHAR(64)  PRIMARY KEY,                              -- UUID
    note_id         VARCHAR(64)  NOT NULL,
    user_id         VARCHAR(64)  NOT NULL,
    operation       VARCHAR(32)  NOT NULL,                                 -- CREATE | UPDATE | DELETE
    snapshot        TEXT,                                                   -- 完整快照（JSON）
    version         BIGINT       NOT NULL,                                 -- 全局单调递增版本号
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_version ON sync_logs(user_id, version);
CREATE INDEX IF NOT EXISTS idx_sync_logs_note         ON sync_logs(note_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created      ON sync_logs(created_at DESC);

-- ============================================================
-- 4. 附件模块 (note-service)
-- ============================================================

-- 4.1 attachments — 附件元数据
-- 对应 Java: AttachmentEntity
-- 实际文件存储于 MinIO，此表记录元数据和访问路径
CREATE TABLE IF NOT EXISTS attachments (
    id              VARCHAR(64)   PRIMARY KEY,                             -- UUID
    user_id         VARCHAR(64)   NOT NULL,                                -- 上传者
    note_id         VARCHAR(64)   REFERENCES notes(id) ON DELETE SET NULL, -- 关联笔记
    filename        VARCHAR(512)  NOT NULL,                                -- 原始文件名
    content_type    VARCHAR(128),                                          -- MIME 类型
    size            BIGINT        NOT NULL DEFAULT 0,                      -- 文件字节数
    url             VARCHAR(1024) NOT NULL,                                -- MinIO 对象 URL / 存储路径
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);

-- ============================================================
-- 5. 协作模块 (未来)
-- ============================================================

-- 5.1 share_links — 笔记分享链接
-- design doc ER 图
CREATE TABLE IF NOT EXISTS share_links (
    id              VARCHAR(64)  PRIMARY KEY,                              -- UUID
    note_id         VARCHAR(64)  NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id         VARCHAR(64)  NOT NULL,                                 -- 分享者
    token           VARCHAR(128) NOT NULL UNIQUE,                          -- 分享令牌（URL 安全）
    permission      VARCHAR(16)  NOT NULL DEFAULT 'view',                  -- view | edit
    expires_at      TIMESTAMPTZ,                                           -- NULL = 永不过期
    is_revoked      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_note  ON share_links(note_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user  ON share_links(user_id);

-- ============================================================
-- 6. 表注释（供 psql \d+ 和 pgAdmin 查看）
-- ============================================================

COMMENT ON TABLE users            IS '用户账号 — user-service 模块';
COMMENT ON TABLE refresh_tokens   IS 'JWT 刷新令牌 — 支持令牌轮换和撤销';
COMMENT ON TABLE notebooks        IS '笔记本 — 支持嵌套（parent_id）和软删除';
COMMENT ON TABLE notes            IS '笔记 — 支持固定/收藏/软删除/乐观锁版本';
COMMENT ON TABLE tags             IS '标签元数据 — 每个用户的标签名唯一';
COMMENT ON TABLE note_tags        IS '笔记-标签关联 — 直接存 tag_name 避免频繁 JOIN';
COMMENT ON TABLE note_versions    IS '笔记版本历史 — 每次保存生成一条记录';
COMMENT ON TABLE note_links       IS '笔记双向链接 — [[Wiki Link]] 解析结果';
COMMENT ON TABLE sync_logs        IS '同步操作日志 — 基于版本号的增量同步';
COMMENT ON TABLE attachments      IS '附件元数据 — 实际文件存储于 MinIO';
COMMENT ON TABLE share_links      IS '分享链接 — 支持过期和撤销';
