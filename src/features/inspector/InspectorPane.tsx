import { ActionIcon, Box, Paper, Tooltip } from '@mantine/core';
import { PanelRightOpen } from 'lucide-react';
import { AppErrorBoundary } from '../../components/AppErrorBoundary';
import { LocationDetailPanel, LocationDetailPanelProps } from '../../components/LocationDetailPanel';
import { InspectorMode } from '../../hooks/useAppModals';

type DetailPanelSharedProps = Omit<LocationDetailPanelProps, 'onCollapse'>;

interface DesktopInspectorPaneProps {
  inspectorMode: InspectorMode;
  onSetMode: (mode: InspectorMode) => void;
  detailPanelProps: DetailPanelSharedProps;
}

export function DesktopInspectorPane({
  inspectorMode,
  onSetMode,
  detailPanelProps,
}: DesktopInspectorPaneProps) {
  const hasSelection = Boolean(detailPanelProps.location);
  if (!hasSelection) return null;

  const isCollapsed = inspectorMode === 'collapsed';
  const modeClass = isCollapsed ? 'is-collapsed' : 'is-expanded';

  return (
    <Box className={`map-inspector-overlay ${modeClass}`} visibleFrom="sm">
      <Paper shadow="xl" className="location-detail-panel-root map-inspector-surface" radius="lg">
        <AppErrorBoundary title="Detail panel error" message="The detail panel crashed. You can retry or reload the app.">
          <LocationDetailPanel
            {...detailPanelProps}
            onCollapse={() => onSetMode('collapsed')}
          />
        </AppErrorBoundary>
      </Paper>
      <Box className="map-inspector-collapsed">
        <Tooltip label="Show details panel" position="left" withArrow>
          <ActionIcon
            className="location-detail-expand-handle"
            variant="filled"
            color="brand"
            size="xl"
            radius="md"
            onClick={() => onSetMode('expanded')}
            aria-label="Show details panel"
          >
            <PanelRightOpen size={18} />
          </ActionIcon>
        </Tooltip>
      </Box>
    </Box>
  );
}

interface MobileInspectorPanelProps {
  onDismiss: () => void;
  detailPanelProps: DetailPanelSharedProps;
}

export function MobileInspectorPanel({ onDismiss, detailPanelProps }: MobileInspectorPanelProps) {
  if (!detailPanelProps.location) return null;

  return (
    <Paper shadow="xl" className="location-detail-panel-mobile" radius="lg" hiddenFrom="sm">
      <AppErrorBoundary title="Detail panel error" message="The detail panel crashed. You can retry or reload the app.">
        <LocationDetailPanel {...detailPanelProps} onCollapse={onDismiss} />
      </AppErrorBoundary>
    </Paper>
  );
}
