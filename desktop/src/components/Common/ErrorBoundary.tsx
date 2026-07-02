import { Component, type ErrorInfo, type ReactNode } from 'react';
import { tauriInvoke } from '@/utils/invoke';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; crashCount: number; showDetails: boolean; }

const CRASH_KEY = 'noteforge:crash:last';
const CRASH_COUNT_KEY = 'noteforge:crash:count';

/** Write crash data to persistent file storage via Tauri backend. Fire-and-forget. */
function persistCrashLog(crashData: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify({ ...crashData, persistedAt: Date.now() });
    void tauriInvoke<string>('write_crash_log', { crashData: payload });
  } catch { /* best-effort */ }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, crashCount: 0, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    const crashData = {
      crashedAt: Date.now(),
      error: error.message,
      stack: info.componentStack,
      url: window.location.href,
      type: 'errorBoundary',
    };
    try {
      window.localStorage.setItem(CRASH_KEY, JSON.stringify(crashData));
      // Persist to file via Tauri backend
      persistCrashLog(crashData);
      // Track consecutive crash count
      const prevCount = parseInt(window.sessionStorage.getItem(CRASH_COUNT_KEY) || '0', 10);
      const newCount = prevCount + 1;
      window.sessionStorage.setItem(CRASH_COUNT_KEY, String(newCount));
      this.setState({ crashCount: newCount });
    } catch { /* localStorage may be full or blocked */ }
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    try {
      window.localStorage.setItem('noteforge:crash:recovered', JSON.stringify({ recoveredAt: Date.now() }));
    } catch { /* ignore */ }
    window.location.reload();
  }

  handleResetApp() {
    try {
      // Clear all noteforge localStorage keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('noteforge:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      window.sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.reload();
  }

  handleExportLog() {
    try {
      const raw = window.localStorage.getItem(CRASH_KEY);
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noteforge-crash-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  toggleDetails() {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  }

  render() {
    if (this.state.hasError) {
      const isSevere = this.state.crashCount >= 3;
      return (
        <div className="error-boundary-overlay">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">{isSevere ? '⚠️' : '💥'}</div>
            <h2 className="error-boundary-title">
              {isSevere ? '应用多次崩溃' : '应用出错了'}
            </h2>
            <p className="error-boundary-message">
              {isSevere
                ? '应用连续崩溃多次。您可以尝试重置应用或重新加载。'
                : this.state.error?.message || '发生了意外错误'}
            </p>
            {this.state.error?.stack && (
              <>
                <button
                  className="error-boundary-details-toggle"
                  onClick={() => this.toggleDetails()}
                >
                  {this.state.showDetails ? '隐藏详情' : '显示错误详情'}
                </button>
                {this.state.showDetails && (
                  <pre className="error-boundary-stack">{this.state.error.stack}</pre>
                )}
              </>
            )}
            <div className="error-boundary-actions">
              <button className="error-boundary-btn error-boundary-btn--primary" onClick={() => this.handleReload()}>
                重新加载
              </button>
              {isSevere && (
                <button className="error-boundary-btn error-boundary-btn--danger" onClick={() => this.handleResetApp()}>
                  重置应用
                </button>
              )}
              <button className="error-boundary-btn error-boundary-btn--ghost" onClick={() => this.handleExportLog()}>
                导出错误日志
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
