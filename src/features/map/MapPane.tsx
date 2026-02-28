import MapDisplay from '../../components/MapDisplay';
import { AppErrorBoundary } from '../../components/AppErrorBoundary';

export type MapPaneProps = React.ComponentProps<typeof MapDisplay>;

export function MapPane(props: MapPaneProps) {
  return (
    <AppErrorBoundary title="Map rendering error" message="The map view crashed. You can retry or reload the app.">
      <MapDisplay {...props} />
    </AppErrorBoundary>
  );
}
