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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <strong>应用出错了</strong>
          <p>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
