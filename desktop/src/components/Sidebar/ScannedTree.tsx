// NoteForge — Scanned Directory Tree Component
// Matches the primary tree (storage → notebooks → notes) styling pattern:
// - Directories → storage-tree-toggle (with inline paddingLeft for indentation)
// - Files → sidebar-note (with inline paddingLeft for indentation)

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/stores/context';
import { tauriInvoke } from '@/utils/invoke';
import { Icon } from '@/components/Common/Icon';

// ── Types ──

export interface ScannedFileTree {
  name: string;
  path: string;
  isDir: boolean;
  children: ScannedFileTree[];
  title: string;
  modifiedAt: number;
}

interface ScannedTreeProps {
  rootPath: string;
}

// ── Leaf node: a single .md file ──

const FileNode = memo(function FileNode({ node, depth }: { node: ScannedFileTree; depth: number }) {
  const { t } = useTranslation();
  const store = useStore();
  const isActive = store.externalFile?.path === node.path;

  const handleClick = useCallback(() => {
    void store.openExternalFile(node.path);
  }, [store, node.path]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    store.setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      noteId: null,
      notebookId: null,
      kind: 'note',
    });
  }, [store]);

  return (
    <button
      className={`sidebar-note${isActive ? ' active' : ''}`}
      style={{ padding: '8px 10px' }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={node.path}
    >
      <div className="sidebar-note-title">
        <span style={{ fontSize: 12, flexShrink: 0, marginLeft: (1 + depth) * 24 }}>
          <Icon type="note" size={14} />
        </span>
        <strong style={{ fontSize: 13 }}>{node.title || node.name}</strong>
      </div>
      <p style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)' }}>{node.path.split(/[/\\]/).pop()}</p>
      <div className="sidebar-note-meta" style={{ fontSize: 11 }}>
        <span className="scanned-file-badge">{t('sidebar.fileNote')}</span>
      </div>
    </button>
  );
});

// ── Directory node: expandable folder ──
// Uses storage-tree-toggle + inline paddingLeft, matching primary tree pattern.

function DirNode({
  node,
  depth,
  expandedDirs,
  onToggle,
}: {
  node: ScannedFileTree;
  depth: number;
  expandedDirs: Set<string>;
  onToggle: (path: string) => void;
}) {
  const expanded = expandedDirs.has(node.path);

  const handleToggle = useCallback(() => {
    onToggle(node.path);
  }, [onToggle, node.path]);

  return (
    <div>
      <button
        className="storage-tree-toggle"
        onClick={handleToggle}
      >
        <span className="storage-tree-arrow" style={{ marginLeft: (1 + depth) * 24 }}>
          <Icon type={expanded ? 'chevron-down' : 'chevron-right'} size={8} />
        </span>
        <Icon type={expanded ? 'folder-open' : 'folder'} size={13} />
        <span className="storage-tree-name" style={{ fontSize: 11 }}>{node.name}</span>
        <span className="storage-tree-count">{node.children.length}</span>
      </button>
      {expanded && (
        <div>
          {node.children.map((child) => (
            <ScannedTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recursive node ──

const ScannedTreeNode = memo(function ScannedTreeNode({
  node,
  depth,
  expandedDirs,
  onToggle,
}: {
  node: ScannedFileTree;
  depth: number;
  expandedDirs: Set<string>;
  onToggle: (path: string) => void;
}) {
  if (node.isDir) {
    return <DirNode node={node} depth={depth} expandedDirs={expandedDirs} onToggle={onToggle} />;
  }
  return <FileNode node={node} depth={depth} />;
});

// ── Root tree component ──

export function ScannedTree({ rootPath }: ScannedTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<ScannedFileTree[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rootExpanded, setRootExpanded] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const result = await tauriInvoke<ScannedFileTree[]>('scan_dir_recursive', { dirPath: rootPath });
        if (!cancelled) {
          setTree(result ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [rootPath]);

  const rootName = useMemo(
    () => rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath,
    [rootPath],
  );

  const handleRootToggle = useCallback(() => {
    setRootExpanded((prev) => !prev);
  }, []);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const expandedSet = useMemo(
    () => new Set(Object.keys(expandedDirs).filter((k) => expandedDirs[k])),
    [expandedDirs],
  );

  const fileCount = useMemo(() => (tree ? countFiles(tree) : 0), [tree]);

  return (
    <div className="storage-tree-root" style={{ marginBottom: 4 }}>
      <button className="storage-tree-toggle" onClick={handleRootToggle}>
        <span className="storage-tree-arrow">
          <Icon type={rootExpanded ? 'chevron-down' : 'chevron-right'} size={10} />
        </span>
        <Icon type="folder-open" size={14} />
        <span className="storage-tree-name">{rootName}</span>
        {!loading && <span className="storage-tree-count">{fileCount}</span>}
      </button>

      {rootExpanded && (
        <div>
          {loading && (
            <div className="scanned-tree-loading">{t('common.loading')}…</div>
          )}
          {error && (
            <div className="scanned-tree-error">{t('sidebar.scanError')}</div>
          )}
          {!loading && !error && tree && tree.length === 0 && (
            <div className="scanned-tree-empty">{t('sidebar.noMdFiles')}</div>
          )}
          {!loading && !error && tree && tree.length > 0 && (
            <div>
              {tree.map((child) => (
                <ScannedTreeNode
                  key={child.path}
                  node={child}
                  depth={0}
                  expandedDirs={expandedSet}
                  onToggle={handleToggleDir}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function countFiles(nodes: ScannedFileTree[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isDir) {
      count += countFiles(node.children);
    } else {
      count++;
    }
  }
  return count;
}
