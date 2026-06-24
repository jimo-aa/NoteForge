import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '@/stores/context';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  degree: number;
  cluster: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface DragState {
  id: string;
  offsetX: number;
  offsetY: number;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function GraphView() {
  const store = useStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [clusterMode, setClusterMode] = useState<'notebook' | 'tag'>('notebook');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeEdge, setActiveEdge] = useState<GraphEdge | null>(null);

  const graph = useMemo(() => {
    const titleToId = new Map(store.notes.map((note) => [note.meta.title, note.meta.id]));
    const edges: GraphEdge[] = [];
    const incoming = new Map<string, Set<string>>();
    const outgoing = new Map<string, Set<string>>();

    for (const note of store.notes) {
      const refs = Array.from(note.content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1].trim());
      const targets = refs.map((title) => titleToId.get(title)).filter((id): id is string => Boolean(id));
      outgoing.set(note.meta.id, new Set(targets));
      for (const to of targets) {
        edges.push({ from: note.meta.id, to });
        if (!incoming.has(to)) incoming.set(to, new Set());
        incoming.get(to)!.add(note.meta.id);
      }
    }

    const clusterBuckets = new Map<string, GraphNode[]>();
    for (const note of store.notes) {
      const cluster = clusterMode === 'notebook' ? (note.meta.notebookId || '未分类') : (note.meta.tags[0] || '无标签');
      const degree = (outgoing.get(note.meta.id)?.size ?? 0) + (incoming.get(note.meta.id)?.size ?? 0);
      const list = clusterBuckets.get(cluster) ?? [];
      list.push({ id: note.meta.id, label: note.meta.title, x: 0, y: 0, degree, cluster });
      clusterBuckets.set(cluster, list);
    }

    const clusters = Array.from(clusterBuckets.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const clusterIndex = new Map(clusters.map((name, index) => [name, index]));

    const nodes = store.notes.map((note) => {
      const cluster = clusterMode === 'notebook' ? (note.meta.notebookId || '未分类') : (note.meta.tags[0] || '无标签');
      const members = clusterBuckets.get(cluster) ?? [];
      const indexInCluster = members.findIndex((item) => item.id === note.meta.id);
      const degree = (outgoing.get(note.meta.id)?.size ?? 0) + (incoming.get(note.meta.id)?.size ?? 0);
      const clusterPos = clusterIndex.get(cluster) ?? 0;
      const baseX = 18 + (clusterPos % 3) * 28;
      const baseY = 22 + Math.floor(clusterPos / 3) * 26;
      const radius = 8 + members.length * 1.3;
      const angle = members.length <= 1 ? 0 : (Math.PI * 2 * indexInCluster) / members.length;
      const stored = positions[note.meta.id];
      return {
        id: note.meta.id,
        label: note.meta.title,
        x: stored?.x ?? baseX + Math.cos(angle) * radius,
        y: stored?.y ?? baseY + Math.sin(angle) * radius * 0.75,
        degree,
        cluster,
      };
    });

    return { nodes, edges };
  }, [clusterMode, positions, store.notes]);

  const currentId = store.currentNote?.meta.id ?? null;
  const neighborhood = useMemo(() => {
    const set = new Set<string>();
    if (!currentId) return set;
    set.add(currentId);
    for (const edge of graph.edges) {
      if (edge.from === currentId) set.add(edge.to);
      if (edge.to === currentId) set.add(edge.from);
    }
    return set;
  }, [currentId, graph.edges]);

  useEffect(() => {
    setFocusedId(currentId);
  }, [currentId]);

  useEffect(() => {
    if (!dragState) return;
    const move = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nextX = ((event.clientX - rect.left - dragState.offsetX) / rect.width) * 100;
      const nextY = ((event.clientY - rect.top - dragState.offsetY) / rect.height) * 100;
      setPositions((prev) => ({
        ...prev,
        [dragState.id]: { x: Math.max(4, Math.min(96, nextX)), y: Math.max(4, Math.min(96, nextY)) },
      }));
    };
    const up = () => setDragState(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragState]);

  const startDrag = (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!canvas || !node) return;
    const rect = canvas.getBoundingClientRect();
    setDragState({
      id: nodeId,
      offsetX: event.clientX - rect.left - (node.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (node.y / 100) * rect.height,
    });
    setFocusedId(nodeId);
  };

  const closeGraph = () => store.setIsGraphOpen(false);

  if (!store.isGraphOpen) return null;

  const maxDegree = Math.max(1, ...graph.nodes.map((node) => node.degree));
  const activeCount = focusedId ? neighborhood.size : graph.nodes.length;

  const activeEdgeNote = activeEdge
    ? (() => {
        const from = store.notes.find((item) => item.meta.id === activeEdge.from);
        const to = store.notes.find((item) => item.meta.id === activeEdge.to);
        if (!from || !to) return null;
        const pattern = new RegExp(`\\[\\[${escapeRegExp(to.meta.title)}\\]\\]`);
        return { from, to, snippet: from.content.match(pattern)?.[0] ?? '未找到匹配引用' };
      })()
    : null;

  return (
    <div className="graph-overlay show" onClick={closeGraph}>
      <div className="graph-toolbar" onClick={(e) => e.stopPropagation()}>
        <h2>🕸 知识图谱</h2>
        <span className="graph-info">节点: {graph.nodes.length} · 连接: {graph.edges.length} · 聚焦: {activeCount}</span>
        <div className="graph-cluster-switch">
          <button className={clusterMode === 'notebook' ? 'active' : ''} onClick={() => setClusterMode('notebook')}>按笔记本</button>
          <button className={clusterMode === 'tag' ? 'active' : ''} onClick={() => setClusterMode('tag')}>按标签</button>
        </div>
        <span className="flex-1" />
        <button onClick={closeGraph}>✕ 关闭</button>
      </div>

      <div className="graph-canvas" ref={canvasRef} onClick={(e) => e.stopPropagation()}>
        <svg className="graph-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((node) => node.id === edge.from);
            const to = graph.nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const isActive = !focusedId || neighborhood.has(from.id) || neighborhood.has(to.id);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={isActive ? 'graph-link active' : 'graph-link dimmed'}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveEdge(edge);
                }}
              />
            );
          })}
        </svg>

        {graph.nodes.map((node) => {
          const isCurrent = node.id === currentId;
          const isNeighbor = neighborhood.has(node.id);
          const isFocused = !focusedId || isCurrent || isNeighbor;
          return (
            <button
              key={node.id}
              className={['graph-node', isCurrent ? 'current' : '', isFocused ? 'focused' : 'dimmed'].join(' ')}
              style={{ left: `${node.x}%`, top: `${node.y}%`, width: `${140 + (node.degree / maxDegree) * 70}px` }}
              title={node.label}
              onMouseDown={(event) => startDrag(event, node.id)}
              onClick={(event) => {
                event.stopPropagation();
                store.selectNote(node.id);
                setFocusedId(node.id);
                setActiveEdge(null);
              }}
            >
              <strong>{node.label}</strong>
              <span>{node.cluster}</span>
              <span>{node.degree} 条关联</span>
            </button>
          );
        })}
      </div>

      {activeEdgeNote && (
        <div className="graph-detail" onClick={(e) => e.stopPropagation()}>
          <h3>引用关系</h3>
          <p><strong>{activeEdgeNote.from.meta.title}</strong> 引用了 <strong>{activeEdgeNote.to.meta.title}</strong></p>
          <p className="drawer-hint">引用片段：{activeEdgeNote.snippet}</p>
          <div className="graph-detail-actions">
            <button onClick={() => store.selectNote(activeEdgeNote.from.meta.id)}>跳转来源</button>
            <button onClick={() => store.selectNote(activeEdgeNote.to.meta.id)}>跳转目标</button>
            <button onClick={() => setActiveEdge(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
