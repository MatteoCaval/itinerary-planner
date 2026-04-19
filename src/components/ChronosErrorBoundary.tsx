import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackError } from '@/services/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ChronosErrorBoundary extends Component<Props, State> {
  private retryBtnRef = React.createRef<HTMLButtonElement>();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      trackError('error_boundary', error, { componentStack: info.componentStack ?? '' });
    } catch {
      // telemetry must never throw inside the boundary
    }
  }

  componentDidUpdate(_prev: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.retryBtnRef.current?.focus();
    }
  }

  render() {
    if (this.state.hasError) {
      const safeMessage = String(this.state.error?.message ?? '').slice(0, 400);
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="h-screen flex items-center justify-center bg-muted p-8"
        >
          <div className="max-w-md w-full bg-white rounded-2xl border border-destructive/30 shadow-xl p-8 text-center space-y-4">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{safeMessage}</p>
            </div>
            <div className="flex gap-3">
              <Button
                ref={this.retryBtnRef}
                variant="outline"
                className="flex-1"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try Again
              </Button>
              <Button className="flex-1" onClick={() => window.location.reload()}>
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
