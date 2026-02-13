import React from 'react';
import { Box, Group, Paper, Text, Tooltip } from '@mantine/core';
import { Route, TRANSPORT_COLORS, TRANSPORT_LABELS } from '../../types';

interface RouteConnectorProps {
  route: Route | null;
  distance: string;
  row: number;
  col: number;
  onEdit: () => void;
}

export const RouteConnector = React.memo(function RouteConnector({
  route,
  distance,
  row,
  col,
  onEdit,
}: RouteConnectorProps) {
  const transportLabel = route ? TRANSPORT_LABELS[route.transportType] : null;
  const transportColor = route
    ? TRANSPORT_COLORS[route.transportType]
    : '#0d6efd';

  return (
    <Box
      style={{
        gridColumn: `${3 + col} / span 1`,
        gridRow: `${row} / span 1`,
        zIndex: 10,
        pointerEvents: 'none',
        height: 0,
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Tooltip label="Edit Connection">
        <Paper
          className={`route-connector-pill ${route ? 'route-connector-existing' : 'route-connector-empty'}`}
          shadow="sm"
          withBorder
          bg={!route ? 'blue.0' : 'white'}
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            padding: '4px 12px',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            borderStyle: route ? 'solid' : 'dashed',
            borderWidth: 2,
            position: 'absolute',
            top: 0,
            borderColor: !route
              ? 'var(--mantine-color-blue-3)'
              : 'var(--mantine-color-gray-3)',
            borderRadius: 999,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Group gap="xs">
            {route ? (
              <>
                <Text size="xs" fw={700} c={transportColor}>
                  {transportLabel}
                </Text>
                <Box
                  style={{
                    width: 1,
                    height: 12,
                    backgroundColor: 'var(--mantine-color-gray-3)',
                  }}
                />
                <Text size="xs" c="dimmed" fw={500}>
                  {route.duration || `${distance}km`}
                </Text>
              </>
            ) : (
              <>
                <Text size="sm" fw={700} c="blue" lh={1}>
                  +
                </Text>
                <Text size="xs" fw={500}>
                  Set travel{' '}
                  <Text span size="xs" c="dimmed">
                    ({distance}km)
                  </Text>
                </Text>
              </>
            )}
          </Group>
        </Paper>
      </Tooltip>
    </Box>
  );
});
