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

// Simple extractor for common entity patterns in Chinese/English text.
// Returns entities grouped by type (person, tech, place, concept).
function extractEntities(text: string): string[] {
  const entities = new Set<string>();
  // English: capitalized multi-word phrases (potential named entities)
  const enEntities = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g);
  enEntities?.forEach(e => { if (e.split(' ').length <= 3) entities.add(e); });
  // Chinese: quoted terms "..." or 「...」
  const cnQuoted = text.match(/[""「」]((?:[^"「」]){2,20})[""「」]/g);
  cnQuoted?.forEach(e => entities.add(e.replace(/[""「」]/g, '').trim()));
  // Technical terms: @ mentions, #tags, CamelCase terms
  const techTerms = text.match(/#[\w\u4e00-\u9fff-]+/g);
  techTerms?.forEach(e => entities.add(e.slice(1)));
  // URLs and references
  const refs = text.match(/\[\[([^\]]+)\]\]/g);
  refs?.forEach(e => entities.add(e.slice(2, -2).trim()));
  return Array.from(entities).slice(0, 10);
}

const CLUSTER_COLORS = [
  '#6a63ff', '#65d9ff', '#50e3c2', '#ff6b6b',
  '#ffa36b', '#ffd76b', '#b06bff', '#ff6bd6',
  '#6bffb8', '#6bb8ff', '#ff8a6b', '#d46bff',
] as const;

function getClusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length] ?? '#6a63ff';
}

export function GraphView() {
  const store = useStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [clusterMode, setClusterMode] = useState<'notebook' | 'tag'>('notebook');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [activeEdge, setActiveEdge] = useState<GraphEdge | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showIsolated, setShowIsolated] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [entityMode, setEntityMode] = useState(false);
  const [entityResults, setEntityResults] = useState<Map<string, string[]>>(new Map());

  // Build entity map: for each note, extract entities from content
  useEffect(() => {
    if (!entityMode) return;
    const map = new Map<string, string[]>();
    for (const note of store.notes) {
      const entities = extractEntities(note.content);
      if (entities.length > 0) map.set(note.meta.id, entities);
    }
    setEntityResults(map);
  }, [entityMode, store.notes]);

  const graphKey = useMemo(() => {
    return store.notes.map((n) => `${n.meta.id}:${n.meta.updatedAt}`).join('|');
  }, [store.notes]);

  const graph = useMemo(() => {
    const titleToId = new Map(store.notes.map((note) => [note.meta.title, note.meta.id]));
    const edges: GraphEdge[] = [];
    const incoming = new Map<string, Set<string>>();
    const outgoing = new Map<string, Set<string>>();

    for (const note of store.notes) {
      const refs = Array.from(note.content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1]?.trim() ?? '');
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
  }, [clusterMode, positions, graphKey]);

  const clusters = useMemo(() => {
    const set = new Set(graph.nodes.map((n) => n.cluster));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [graph.nodes]);

  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    clusters.forEach((c, i) => map.set(c, getClusterColor(i)));
    return map;
  }, [clusters]);

  const isolatedNodeIds = useMemo(() => {
    const withEdges = new Set<string>();
    for (const edge of graph.edges) {
      withEdges.add(edge.from);
      withEdges.add(edge.to);
    }
    return new Set(graph.nodes.filter((n) => !withEdges.has(n.id)).map((n) => n.id));
  }, [graph]);

  const filteredGraph = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let visibleNodes = graph.nodes;
    if (q) {
      visibleNodes = visibleNodes.filter((n) => n.label.toLowerCase().includes(q));
    }
    if (!showIsolated) {
      visibleNodes = visibleNodes.filter((n) => !isolatedNodeIds.has(n.id));
    }
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [graph, searchQuery, showIsolated, isolatedNodeIds]);

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
        <div className="graph-cluster-switch">
          <button className={clusterMode === 'notebook' ? 'active' : ''} onClick={() => { setClusterMode('notebook'); setPositions({}); }}>按笔记本</button>
          <button className={clusterMode === 'tag' ? 'active' : ''} onClick={() => { setClusterMode('tag'); setPositions({}); }}>按标签</button>
        </div>
        <input
          className="graph-search-input"
          type="text"
          placeholder="搜索节点..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setFocusedId(null); }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="graph-zoom-group">
          <button className="graph-btn-icon" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} title="缩小">−</button>
          <span className="graph-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="graph-btn-icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} title="放大">+</button>
          <button className="graph-btn-icon" onClick={() => setZoom(1)} title="重置缩放">⟲</button>
        </div>
        <button
          className={showIsolated ? 'graph-toggle active' : 'graph-toggle'}
          onClick={() => setShowIsolated((v) => !v)}
          title="显示/隐藏孤立节点"
        >
          {showIsolated ? '🏷' : '🏷̶'}
        </button>
        <button
          className={entityMode ? 'graph-toggle active' : 'graph-toggle'}
          onClick={() => setEntityMode((v) => !v)}
          title="实体提取模式：从笔记内容中提取命名实体"
        >
          🔤
        </button>
        <button
          className={showLegend ? 'graph-toggle active' : 'graph-toggle'}
          onClick={() => setShowLegend((v) => !v)}
          title="显示/隐藏图例"
        >
          ⊜
        </button>
        <button
          className="graph-btn-icon"
          onClick={() => setPositions({})}
          title="重置布局"
        >
          ⟳
        </button>
        <span className="graph-info">
          {filteredGraph.nodes.length}/{graph.nodes.length} 节点 · {filteredGraph.edges.length} 连接
        </span>
        <span className="flex-1" />
        <button onClick={closeGraph}>✕ 关闭</button>
      </div>

      <div className="graph-canvas" ref={canvasRef} onClick={(e) => e.stopPropagation()}>
        <div
          className="graph-zoom-layer"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <svg className="graph-links" viewBox="0 0 100 100" preserveAspectRatio="none">
            {filteredGraph.edges.map((edge) => {
              const from = filteredGraph.nodes.find((node) => node.id === edge.from);
              const to = filteredGraph.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const isActive = !focusedId || neighborhood.has(from.id) || neighborhood.has(to.id);
              const color = clusterColorMap.get(from.cluster) ?? '#6a63ff';
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={isActive ? 'graph-link active' : 'graph-link dimmed'}
                  style={isActive ? { stroke: color } : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveEdge(edge);
                  }}
                />
              );
            })}
          </svg>

          {filteredGraph.nodes.map((node) => {
            const isCurrent = node.id === currentId;
            const isNeighbor = neighborhood.has(node.id);
            const isFocused = !focusedId || isCurrent || isNeighbor;
            const color = clusterColorMap.get(node.cluster) ?? '#6a63ff';
            return (
              <button
                key={node.id}
                className={['graph-node', isCurrent ? 'current' : '', isFocused ? 'focused' : 'dimmed'].join(' ')}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  width: `${140 + (node.degree / maxDegree) * 70}px`,
                  backgroundColor: isCurrent ? undefined : `${color}22`,
                  borderColor: isCurrent ? undefined : `${color}55`,
                }}
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
                {entityMode && entityResults.get(node.id) && entityResults.get(node.id)!.length > 0 && (
                  <span className="graph-node-entities">{entityResults.get(node.id)!.slice(0, 3).join(' · ')}</span>
                )}
              </button>
            );
          })}
        </div>

        {clusters.length > 0 && showLegend && (
          <div className="graph-legend" onClick={(e) => e.stopPropagation()}>
            <div className="graph-legend-header">
              <span>图例</span>
              <button className="graph-btn-icon small" onClick={() => setShowLegend(false)}>✕</button>
            </div>
            <div className="graph-legend-items">
              {clusters.slice(0, 15).map((c) => (
                <div key={c} className="graph-legend-item">
                  <span className="graph-legend-dot" style={{ backgroundColor: clusterColorMap.get(c) }} />
                  <span className="graph-legend-label">{c}</span>
                </div>
              ))}
              {clusters.length > 15 && <div className="graph-legend-more">+{clusters.length - 15} 更多</div>}
            </div>
          </div>
        )}
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
