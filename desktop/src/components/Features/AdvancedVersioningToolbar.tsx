import styles from './AdvancedVersioningToolbar.module.css';

interface AdvancedVersioningToolbarProps {
  onOpenVersioning: () => void;
  onExport: (format: 'markdown' | 'html' | 'json') => void;
  onBackup: () => void;
  onCreateMilestone: () => void;
}

export function AdvancedVersioningToolbar({
  onOpenVersioning,
  onExport,
  onBackup,
  onCreateMilestone
}: AdvancedVersioningToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <button 
          className={styles.btn}
          title="版本对比与管理 (Ctrl+Shift+V)"
          onClick={onOpenVersioning}
        >
          <span className={styles.icon}>📊</span>
          <span className={styles.label}>版本控制</span>
        </button>
        
        <button 
          className={styles.btn}
          title="创建里程碑"
          onClick={onCreateMilestone}
        >
          <span className={styles.icon}>🎯</span>
          <span className={styles.label}>里程碑</span>
        </button>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.group}>
        <div className={styles.dropdown}>
          <button 
            className={styles.btn}
            title="导出笔记"
          >
            <span className={styles.icon}>📦</span>
            <span className={styles.label}>导出</span>
            <span className={styles.arrow}>▼</span>
          </button>
          <div className={styles.menu}>
            <button onClick={() => onExport('markdown')}>
              <span>📝</span> Markdown
            </button>
            <button onClick={() => onExport('html')}>
              <span>🌐</span> HTML
            </button>
            <button onClick={() => onExport('json')}>
              <span>⚙️</span> JSON
            </button>
          </div>
        </div>

        <button 
          className={styles.btn}
          title="备份笔记"
          onClick={onBackup}
        >
          <span className={styles.icon}>💾</span>
          <span className={styles.label}>备份</span>
        </button>
      </div>
    </div>
  );
}
