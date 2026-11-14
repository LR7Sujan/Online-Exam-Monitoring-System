import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { NeonButton } from './NeonButton';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Uncaught route error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-surface dark:bg-[#12131d] p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground">
                An unexpected interface error occurred while rendering this view.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] font-mono text-left bg-background p-3 rounded-xl border border-border text-rose-400 overflow-x-auto max-h-28">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-mono rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Try Again
              </button>
              <NeonButton
                variant="primary"
                size="sm"
                onClick={this.handleReload}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reload Page
              </NeonButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
