# NoteForge 同步协议设计

## 一、离线同步架构

```
┌──────────────────┐           ┌──────────────────┐
│  客户端 A (离线)   │           │  客户端 B (在线)   │
│ ┌──────────────┐ │           │ ┌──────────────┐ │
│ │ Local DB     │ │           │ │ Local DB     │ │
│ │ + Change Log │ │           │ │ + Change Log │ │
│ └──────┬───────┘ │           │ └──────┬───────┘ │
│        │         │           │        │         │
│ ┌──────▼───────┐ │           │ ┌──────▼───────┐ │
│ │ CRDT Merge   │ │           │ │ CRDT Merge   │ │
│ └──────────────┘ │           │ └──────────────┘ │
└──────────────────┘           └──────────────────┘
        │                              │
        │     网络恢复后同步             │
        └──────────────┬───────────────┘
                       ▼
              ┌──────────────────┐
              │    Sync Server    │
              │    (Java Netty)   │
              │    CRDT + 版本     │
              └──────────────────┘
```

## 二、CRDT 数据结构

```rust
/// CRDT 操作
#[derive(Debug, Clone)]
pub struct CrdtOp {
    pub actor_id: String,         // 操作者 ID
    pub seq: u64,                 // 操作序号
    pub timestamp: u64,           // 操作时间
    pub op_type: CrdtOpType,      // 操作类型
    pub path: Vec<String>,        // 操作路径
    pub value: CrdtValue,         // 操作值
}

/// CRDT 值类型
#[derive(Debug, Clone)]
pub enum CrdtValue {
    Text(String),                 // 文本插入
    Map(HashMap<String, CrdtValue>), // 键值更新
    List(Vec<CrdtValue>),         // 列表更新
    Counter(i64),                 // 计数器
    Flag(bool),                   // 标记
    Deleted,                      // 删除标记
}
```

## 三、同步流程

```
1. 客户端连接 → 发送版本向量
2. 服务端计算差异 → 返回缺失操作
3. 客户端应用远端操作 → CRDT merge
4. 客户端推送本地新操作
5. 服务端广播给其他在线客户端
6. 定期心跳 (30s PING/PONG)
```

## 四、冲突解决

CRDT 自动保证：
- **最终一致性**：所有客户端最终状态一致
- **无冲突合并**：并发编辑自动合并
- **删除优先**：删除操作优先级高于修改
