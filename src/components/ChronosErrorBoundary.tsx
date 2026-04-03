import { Component, type ErrorInfo, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ChronosErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChronosErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center bg-muted p-8">
          <div className="max-w-md w-full bg-white rounded-2xl border border-destructive/30 shadow-xl p-8 text-center space-y-4">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {this.state.error.message}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => this.setState({ error: null })}
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
