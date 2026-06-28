# NoteForge 数据库设计

## 一、ER 图（文字描述）

```
users ────< notebooks ────< notes ────< note_versions
  │                          │
  │                          ├────< note_tags >──── tags
  │                          │
  │                          ├────< note_links >──── (self-ref)
  │                          │
  │                          └──── note_embeddings (pgvector)
  │
  ├────< collab_sessions
  ├────< share_links
  └────< subscriptions
```

## 二、完整 DDL

参见主策划案第 4 章 `NoteForge-策划案.md`。

## 三、索引策略

| 表 | 索引 | 类型 | 说明 |
|----|------|:----:|------|
| notes | user_id + updated_at | B-tree | 列表查询 |
| notes | user_id + is_favorite | Partial | 收藏筛选 |
| notes | to_tsvector(title\|\|content) | GIN | 全文搜索兜底 |
| tags | user_id + name | Unique | 标签名称唯一 |
| note_links | source/target | B-tree | 双向链接查询 |
| note_embeddings | embedding | IVFFlat | 向量相似度检索 |
| note_versions | note_id + version | B-tree | 版本历史 |
| users | email | Unique | 登录 |

## 四、连接池配置

```yaml
# 应用层 HikariCP 配置（每个服务实例）
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000
      connection-timeout: 10000
      max-lifetime: 600000
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 50
```

## 五、分区策略（生产环境）

```sql
-- 按用户 ID 哈希分区（16 个分区）
CREATE TABLE notes (
    ...
) PARTITION BY HASH (user_id);

CREATE TABLE notes_p0 PARTITION OF notes FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE notes_p1 PARTITION OF notes FOR VALUES WITH (MODULUS 16, REMAINDER 1);
-- ... p2 ~ p15
```
