import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { trackError } from '../services/telemetry';

interface AppErrorBoundaryProps {
  children: ReactNode;
  title: string;
  message: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    trackError('ui_boundary_crash', error, { componentStack: errorInfo.componentStack, title: this.props.title });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Stack h="100%" justify="center" align="center" p="xl">
          <Alert color="red" variant="light" icon={<AlertTriangle size={16} />} title={this.props.title}>
            <Text size="sm">{this.props.message}</Text>
          </Alert>
          <Group>
            <Button variant="default" onClick={this.handleRetry}>Try Again</Button>
            <Button onClick={() => window.location.reload()}>Reload App</Button>
          </Group>
        </Stack>
      );
    }

    return this.props.children;
  }
}
