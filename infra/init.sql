-- NoteForge 数据库初始化脚本
-- 自动在 Docker 启动时执行

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 笔记表
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

-- 笔记本表
CREATE TABLE IF NOT EXISTS notebooks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(256) NOT NULL DEFAULT '未命名',
    icon            VARCHAR(16) DEFAULT '📁',
    color           VARCHAR(7) DEFAULT '#6366f1',
    parent_id       UUID REFERENCES notebooks(id),
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(64) NOT NULL,
    name            VARCHAR(64) NOT NULL,
    color           VARCHAR(7) DEFAULT '#6366f1',
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
