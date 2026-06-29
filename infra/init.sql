-- NoteForge 数据库初始化脚本
-- 自动在 Docker 启动时执行

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- 用户表
-- ===========================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(256) NOT NULL UNIQUE,
    password_hash   VARCHAR(512) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    avatar_url      VARCHAR(512),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ===========================
-- 笔记本表
-- ===========================
CREATE TABLE IF NOT EXISTS notebooks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL DEFAULT '未命名',
    icon            VARCHAR(16) DEFAULT '📁',
    color           VARCHAR(7) DEFAULT '#6366f1',
    parent_id       UUID REFERENCES notebooks(id),
    sort_order      INT DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notebooks_user ON notebooks(user_id) WHERE NOT is_deleted;

-- ===========================
-- 笔记表
-- ===========================
CREATE TABLE IF NOT EXISTS notes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    notebook_id     VARCHAR(64),
    title           VARCHAR(1024) NOT NULL DEFAULT '',
    content         TEXT NOT NULL DEFAULT '',
    content_plain   TEXT,
    is_pinned       BOOLEAN DEFAULT FALSE,
    is_favorite     BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    word_count      INT DEFAULT 0,
    version         INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_favorite ON notes(user_id, is_favorite) WHERE NOT is_deleted AND is_favorite;
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id, is_pinned) WHERE NOT is_deleted AND is_pinned;

-- ===========================
-- 标签表
-- ===========================
CREATE TABLE IF NOT EXISTS tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(64) NOT NULL,
    color           VARCHAR(7) DEFAULT '#6366f1',
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_name VARCHAR(64) NOT NULL,
    PRIMARY KEY (note_id, tag_name)
);

-- ===========================
-- 笔记版本历史表
-- ===========================
CREATE TABLE IF NOT EXISTS note_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id         UUID NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    version_number  INT NOT NULL,
    title           VARCHAR(1024) NOT NULL,
    content         TEXT NOT NULL DEFAULT '',
    content_plain   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_number ON note_versions(note_id, version_number DESC);

-- ===========================
-- 笔记双向链接表
-- ===========================
CREATE TABLE IF NOT EXISTS note_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id  UUID NOT NULL,
    target_note_id  UUID NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id, user_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id, user_id);

-- ===========================
-- 同步日志表
-- ===========================
CREATE TABLE IF NOT EXISTS sync_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id         UUID NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    operation       VARCHAR(32) NOT NULL,
    snapshot        TEXT,
    version         BIGINT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_version ON sync_logs(user_id, version);
CREATE INDEX IF NOT EXISTS idx_sync_logs_note ON sync_logs(note_id);

-- ===========================
-- 附件表
-- ===========================
CREATE TABLE IF NOT EXISTS attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    note_id         UUID,
    filename        VARCHAR(512) NOT NULL,
    content_type    VARCHAR(128),
    size            BIGINT DEFAULT 0,
    url             VARCHAR(1024) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id);
