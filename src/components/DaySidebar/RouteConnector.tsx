import React from 'react';
import { Box, Group, Paper, Text, Tooltip } from '@mantine/core';
import { Route, TRANSPORT_COLORS, TRANSPORT_LABELS } from '../../types';

interface RouteConnectorProps {
  route: Route | null;
  distance: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  orientation?: 'vertical' | 'horizontal';
  onEdit: () => void;
}

export const RouteConnector = React.memo(function RouteConnector({
  route,
  distance,
  row,
  col,
  rowSpan = 1,
  colSpan = 1,
  orientation = 'vertical',
  onEdit,
}: RouteConnectorProps) {
  const isHorizontal = orientation === 'horizontal';
  const transportColor = route
    ? TRANSPORT_COLORS[route.transportType]
    : '#0d6efd';
  const transportIcon = route
    ? TRANSPORT_LABELS[route.transportType].split(' ')[0]
    : '+';
  const tooltipLabel = route
    ? 'Edit connection'
    : `Set route (${distance}km)`;

  return (
    <Box
      style={{
        gridColumn: `${3 + col} / span ${colSpan}`,
        gridRow: `${row} / span ${rowSpan}`,
        zIndex: 10,
        pointerEvents: 'none',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isHorizontal ? 'center' : 'flex-start',
        height: isHorizontal ? '100%' : 0,
      }}
    >
      <Tooltip label={tooltipLabel}>
        <Paper
          className={`route-connector-pill ${isHorizontal ? 'route-connector-pill-inline' : ''} ${route ? 'route-connector-existing' : 'route-connector-empty'}`}
          shadow="sm"
          withBorder
          bg={!route ? 'blue.0' : 'white'}
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            padding: '3px 8px',
            transform: isHorizontal ? 'none' : 'translateY(-50%)',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            borderStyle: route ? 'solid' : 'dashed',
            borderWidth: 2,
            position: isHorizontal ? 'relative' : 'absolute',
            top: isHorizontal ? undefined : 0,
            borderColor: !route
              ? 'var(--mantine-color-blue-3)'
              : 'var(--mantine-color-gray-3)',
            borderRadius: 999,
            minWidth: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={700} c={route ? transportColor : 'blue'} lh={1}>
              {transportIcon}
            </Text>
            <Text size="10px" fw={600} c="dimmed" lh={1}>
              {distance}km
            </Text>
          </Group>
        </Paper>
      </Tooltip>
    </Box>
  );
});
