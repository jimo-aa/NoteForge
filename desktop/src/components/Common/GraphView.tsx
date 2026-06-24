import { useMemo } from 'react';
import { useStore } from '@/stores/context';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  degree: number;
  center?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
}

export function GraphView() {
  const store = useStore();

  const graph = useMemo(() => {
    const titleToId = new Map(store.notes.map((note) => [note.meta.title, note.meta.id]));
    const edges: GraphEdge[] = [];
    const linksById = new Map<string, Set<string>>();

    store.notes.forEach((note) => {
      const matches = Array.from(note.content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1].trim());
      const targetIds = matches
        .map((title) => titleToId.get(title))
        .filter((id): id is string => Boolean(id));
      linksById.set(note.meta.id, new Set(targetIds));
      targetIds.forEach((to) => edges.push({ from: note.meta.id, to }));
    });

    const nodes: GraphNode[] = store.notes.map((note, index) => {
      const degree = (linksById.get(note.meta.id)?.size ?? 0) + edges.filter((edge) => edge.to === note.meta.id).length;
      const radius = 110 + degree * 18;
      const angle = (Math.PI * 2 * index) / Math.max(1, store.notes.length);
      const centerX = 50;
      const centerY = 50;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.75;
      return {
        id: note.meta.id,
        label: note.meta.title,
        x,
        y,
        degree,
        center: index === 0,
      };
    });

    const activeEdges = edges.filter((edge) => titleToId.has(store.currentNote?.meta.title ?? '') || edge.from || edge.to);
    return { nodes, edges: activeEdges };
  }, [store.currentNote?.meta.title, store.notes]);

  if (!store.isGraphOpen) return null;

  const maxDegree = Math.max(1, ...graph.nodes.map((node) => node.degree));

  return (
    <div className="graph-overlay show" onClick={() => store.setIsGraphOpen(false)}>
      <div className="graph-toolbar" onClick={(e) => e.stopPropagation()}>
        <h2>🕸 知识图谱</h2>
        <span className="graph-info">节点: {graph.nodes.length} · 连接: {graph.edges.length}</span>
        <span className="flex-1" />
        <button onClick={() => store.setIsGraphOpen(false)}>✕ 关闭</button>
      </div>
      <div className="graph-canvas" onClick={(e) => e.stopPropagation()}>
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((node) => node.id === edge.from);
          const to = graph.nodes.find((node) => node.id === edge.to);
          if (!from || !to) return null;
          return <span key={`${edge.from}-${edge.to}`} className="graph-edge" style={{ left: `${from.x}%`, top: `${from.y}%`, '--to-x': `${to.x}%`, '--to-y': `${to.y}%` } as React.CSSProperties} />;
        })}
        {graph.nodes.map((node) => (
          <button
            key={node.id}
            className={node.center ? 'graph-node center' : 'graph-node'}
            style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)', width: `${140 + (node.degree / maxDegree) * 70}px` }}
            title={node.label}
            onClick={() => store.selectNote(node.id)}
          >
            <strong>{node.label}</strong>
            <span>{node.degree} 条关联</span>
          </button>
        ))}
      </div>
    </div>
  );
}
