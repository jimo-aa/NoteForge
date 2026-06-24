import { useStore } from '@/stores/context';

export function GraphView() {
  const store = useStore();
  if (!store.isGraphOpen) return null;

  const nodes = [
    { label: 'NoteForge 架构设计', x: '50%', y: '45%', center: true },
    { label: 'CRDT 同步协议设计', x: 'calc(50% - 200px)', y: '25%' },
    { label: 'Rust 内存安全入门', x: 'calc(50% + 80px)', y: '20%' },
    { label: 'Tauri vs Electron', x: 'calc(50% - 250px)', y: '55%' },
    { label: '端到端加密方案', x: 'calc(50% + 120px)', y: '55%' },
    { label: '知识图谱构建方案', x: 'calc(50% - 160px)', y: '78%' },
    { label: 'Flutter 移动端适配', x: 'calc(50% + 170px)', y: '30%' },
    { label: 'PostgreSQL 优化', x: 'calc(50% - 50px)', y: '70%' },
  ];

  return (
    <div className="graph-overlay show" onClick={() => store.setIsGraphOpen(false)}>
      <div className="graph-toolbar" onClick={e => e.stopPropagation()}>
        <h2>🕸 知识图谱</h2>
        <span className="graph-info">节点: {nodes.length} · 连接: 14</span>
        <span className="flex-1" />
        <button onClick={() => store.setIsGraphOpen(false)}>✕ 关闭</button>
      </div>
      <div className="graph-canvas" onClick={e => e.stopPropagation()}>
        {nodes.map((n, i) => (
          <div
            key={i}
            className={`graph-node${n.center ? ' center' : ''}`}
            style={{ left: n.x, top: n.y }}
            title={n.label}
          >
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
