import { SidebarContent } from '../../components/SidebarContent';
import { AppErrorBoundary } from '../../components/AppErrorBoundary';

export type PlannerPaneProps = React.ComponentProps<typeof SidebarContent>;

export function PlannerPane(props: PlannerPaneProps) {
  return (
    <AppErrorBoundary title="Sidebar error" message="The sidebar crashed. You can retry or reload the app.">
      <SidebarContent {...props} />
    </AppErrorBoundary>
  );
}
