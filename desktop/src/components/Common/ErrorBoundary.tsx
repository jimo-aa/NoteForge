import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    try {
      window.localStorage.setItem('noteforge:crash:last', JSON.stringify({
        crashedAt: Date.now(),
        error: error.message,
        stack: info.componentStack,
      }));
    } catch { /* localStorage may be full or blocked */ }
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    try { window.localStorage.setItem('noteforge:crash:recovered', JSON.stringify({ recoveredAt: Date.now() })); } catch { /* ignore */ }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <strong>应用出错了</strong>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.handleReload()}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
