import React from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { Coffee, Sun, Moon } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { DaySection } from '../../types';

interface DroppableCellProps {
  id: string;
  section: DaySection;
  row: number;
  isEvenDay: boolean;
  zoomLevel: number;
  onClick?: () => void;
  isBlocked?: boolean;
  children?: React.ReactNode;
}

const DroppableCellInner = React.memo(function DroppableCell({
  id,
  section,
  row,
  isEvenDay,
  zoomLevel,
  onClick,
  isBlocked,
  children,
}: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: isBlocked });

  let icon;
  let color;
  switch (section) {
    case 'morning':
      icon = <Coffee size={14} />;
      color = '#b45309';
      break;
    case 'afternoon':
      icon = <Sun size={14} />;
      color = '#b45309';
      break;
    case 'evening':
      icon = <Moon size={14} />;
      color = '#4338ca';
      break;
  }

  const sectionVisuals: Record<DaySection, { tint: string; rail: string; iconBg: string }> = {
    morning: {
      tint: 'rgba(245, 158, 11, 0.04)',
      rail: 'rgba(251, 191, 36, 0.13)',
      iconBg: 'rgba(251, 191, 36, 0.16)',
    },
    afternoon: {
      tint: 'rgba(234, 179, 8, 0.05)',
      rail: 'rgba(234, 179, 8, 0.13)',
      iconBg: 'rgba(234, 179, 8, 0.16)',
    },
    evening: {
      tint: 'rgba(99, 102, 241, 0.05)',
      rail: 'rgba(129, 140, 248, 0.14)',
      iconBg: 'rgba(129, 140, 248, 0.18)',
    },
  };
  const slotVisual = sectionVisuals[section];
  const baseBg = isBlocked
    ? 'var(--mantine-color-gray-2)'
    : isEvenDay
      ? 'var(--mantine-color-gray-0)'
      : 'white';
  const cellBg = isBlocked ? baseBg : slotVisual.tint;

  return (
    <Box
      ref={setNodeRef}
      onClick={!isBlocked ? onClick : undefined}
      onKeyDown={(event) => {
        if (isBlocked || !onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      tabIndex={isBlocked ? -1 : 0}
      role="button"
      aria-disabled={isBlocked}
      aria-label={`Add activity to ${section}`}
      className={`timeline-cell-focus timeline-slot timeline-slot-${section}`}
      style={{
        gridColumn: '2 / -1',
        gridRow: `${row} / span 1`,
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        minHeight: `${80 * zoomLevel}px`,
        zIndex: 0,
        cursor: isBlocked ? 'not-allowed' : 'pointer',
        backgroundColor: isOver ? 'rgba(59, 130, 246, 0.1)' : cellBg,
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color 0.2s ease',
        opacity: isBlocked ? 0.6 : 1,
      }}
    >
      <Box
        className="timeline-slot-rail"
        style={{
          width: 44,
          minWidth: 44,
          height: '100%',
          pointerEvents: 'none',
          borderRight: '1px solid var(--mantine-color-gray-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isBlocked ? 'rgba(0,0,0,0.05)' : slotVisual.rail,
        }}
      >
        <Box
          style={{
            width: 24,
            height: 24,
            borderRadius: '999px',
            backgroundColor: isBlocked ? 'rgba(0,0,0,0.08)' : slotVisual.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stack gap={1} align="center" c={isBlocked ? 'gray' : color}>
            {icon}
          </Stack>
        </Box>
      </Box>
      {isBlocked && (
        <Box px="md">
          <Text size="xs" c="dimmed" fs="italic">
            Outside destination timeframe
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
});

export { DroppableCellInner as DroppableCell };
