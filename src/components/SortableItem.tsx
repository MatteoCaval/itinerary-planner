import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { ActionIcon, Badge, Text, Group, Stack, Box, Paper } from '@mantine/core';
import { Location, CATEGORY_COLORS } from '../types';

interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  duration?: number;
  zoomLevel: number;
  isSubLocation?: boolean;
}

export function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  onSelect,
  isSelected = false,
  duration = 1,
  zoomLevel,
  isSubLocation = false
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%',
  };

  const [isResizing, setIsResizing] = useState(false);

  // Resize logic
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startDuration = duration;
    const rowHeight = 80 * zoomLevel;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const rowDelta = Math.round(deltaY / rowHeight);
      const newDuration = Math.max(1, startDuration + rowDelta);

      if (newDuration !== duration) {
        onUpdate(id, { duration: newDuration });
      }
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const catColor = CATEGORY_COLORS[location.category || 'sightseeing'];
  const subLocationCount = location.subLocations?.length || 0;
  const hierarchyClass = isSubLocation
    ? 'sortable-item--sub'
    : subLocationCount > 0
      ? 'sortable-item--parent'
      : '';

  return (
    <Box className="sortable-item-wrapper" h="100%" style={{ position: 'relative' }}>
      <Paper
        ref={setNodeRef}

        shadow={isDragging || isResizing || isOver ? 'md' : 'sm'}
        withBorder
        p="xs"
        className={`sortable-item ${hierarchyClass} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isOver ? 'nesting-target' : ''}`}
        style={{ 
          ...style, 
          borderColor: isOver ? 'var(--mantine-color-blue-6)' : (isSelected ? 'var(--mantine-color-blue-filled)' : catColor),
          borderWidth: isSelected || isOver ? 2 : 1,
          borderLeft: `4px solid ${catColor}`,
          borderStyle: isOver ? 'dashed' : 'solid'
        }}
        bg={isOver ? 'blue.0' : (isSelected ? 'blue.0' : 'white')}
        onClick={() => onSelect?.(id)}
        h="100%"
      >
        <Stack gap={4} h="100%">
          <Group gap="xs" align="center" wrap="nowrap">
            <Box
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={18} />
            </Box>

            {index !== undefined && (
              <Badge size="xs" circle color="blue">{index}</Badge>
            )}

            <Box style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '4px', paddingRight: 20 }}>
              <Text
                fw={600}
                size="sm"
                truncate
                style={{ flex: 1 }}
              >
                {location.name}
              </Text>
              {duration > 1 && (
                <Badge variant="outline" color="gray" size="xs" style={{ fontWeight: 400 }}>
                  {(duration / 3).toFixed(1).replace('.0', '')}d
                </Badge>
              )}
            </Box>


            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(id);
              }}
              title="Remove location"
              style={{ position: 'absolute', top: 4, right: 4 }}
            >
              <X size={14} />
            </ActionIcon>

          </Group>

          {location.notes && (
            <Text
              c="dimmed"
              size="xs"
              px={4}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: duration > 1 ? 4 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.3,
                maxHeight: duration > 1 ? '5em' : '1.3em'
              }}
            >
              {location.notes}
            </Text>
          )}

          <Box mt="auto" pt={4}>
            {/* Route info detached */}
          </Box>
        </Stack>
      </Paper>

      {!isDragging && (
        <Box
          className="resize-handle"
          onPointerDown={handleResizeStart}
          title="Drag to change duration"
          style={{ touchAction: 'none' }} // Crucial for mobile pointer events to work without scrolling
        >
          <Box className="resize-handle-bar" />
        </Box>
      )}
    </Box>
  );
}
