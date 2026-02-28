import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, GitFork, MapPin, Utensils, Bed, Train, Globe } from 'lucide-react';
import { ActionIcon, Badge, Text, Group, Stack, Box, Paper } from '@mantine/core';
import { Location, CATEGORY_COLORS } from '../types';


interface SortableItemProps {
  id: string;
  location: Location;
  index?: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onSelect?: (id: string) => void;
  onOpenSubItinerary?: (id: string) => void;
  isSelected?: boolean;
  duration?: number;
  zoomLevel: number;
  isSubLocation?: boolean;
}

export const SortableItem = React.memo(function SortableItem({
  id,
  location,
  index,
  onRemove,
  onUpdate,
  onSelect,
  onOpenSubItinerary,
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

  const category = location.category || 'sightseeing';
  const catColor = CATEGORY_COLORS[category];
  const categoryClass = `sortable-item--cat-${category}`;
  const categoryMeta: Record<
    typeof category,
    { label: string; color: string; Icon: typeof MapPin }
  > = {
    sightseeing: { label: 'Sight', color: 'blue', Icon: MapPin },
    dining: { label: 'Food', color: 'orange', Icon: Utensils },
    hotel: { label: 'Stay', color: 'indigo', Icon: Bed },
    transit: { label: 'Transit', color: 'green', Icon: Train },
    other: { label: 'Other', color: 'gray', Icon: Globe },
  };
  const { label: categoryLabel, color: categoryBadgeColor, Icon: CategoryIcon } = categoryMeta[category];
  const subLocationCount = location.subLocations?.length || 0;
  const isCompact = duration <= 1;
  const isInteractiveFocus = isOver || isSelected;

  const hierarchyClass = isSubLocation
    ? 'sortable-item--sub'
    : subLocationCount > 0
      ? 'sortable-item--parent'
      : '';
  const canOpenSubItinerary = !isSubLocation && subLocationCount > 0 && Boolean(onOpenSubItinerary);

  return (
    <Box className="sortable-item-wrapper" h="100%" style={{ position: 'relative' }}>
      <Paper
        ref={setNodeRef}

        shadow={isDragging || isResizing || isOver ? 'md' : 'sm'}
        withBorder
        p={isCompact ? 8 : 'sm'}
        className={`sortable-item ${isCompact ? 'sortable-item--compact' : ''} ${hierarchyClass} ${categoryClass} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isOver ? 'nesting-target' : ''}`}
        style={{
          ...style,
          borderColor: isOver ? 'var(--mantine-color-brand-5)' : (isSelected ? 'var(--app-accent)' : catColor),
          borderWidth: isSelected || isOver ? 2 : 1,
          borderLeftWidth: 4,
          borderLeftStyle: 'solid',
          borderLeftColor: catColor,
          outline: isOver ? '2px dashed var(--mantine-color-brand-5)' : undefined,
          outlineOffset: isOver ? -2 : undefined,
          backgroundColor: isInteractiveFocus ? 'rgba(37, 99, 235, 0.06)' : 'var(--app-surface)',
          overflow: 'hidden',
        }}
        onClick={() => onSelect?.(id)}
        h="100%"
      >
        <Stack gap={4} h="100%">
          <Group gap={isCompact ? 6 : 'xs'} align="center" wrap="nowrap">
            <Box
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center', zIndex: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={isCompact ? 16 : 18} />
            </Box>

            {index !== undefined && (
              <Badge size="xs" circle color="brand" style={{ zIndex: 10, color: 'white' }}>{index}</Badge>
            )}

            {location.imageUrl && (
              <Box
                className="timeline-card-thumb"
                style={{
                  width: isCompact ? 28 : 42,
                  height: isCompact ? 28 : 42,
                  minWidth: isCompact ? 28 : 42,
                  borderRadius: 10,
                  backgroundImage: `url(${location.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  zIndex: 10,
                }}
              />
            )}

            <Box style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: isCompact ? 2 : 4, paddingRight: isCompact ? 16 : 20, zIndex: 10 }}>
              <Text
                fw={700}
                size={isCompact ? 'xs' : 'sm'}
                truncate
                style={{ flex: 1, color: 'var(--mantine-color-text)' }}
              >
                {location.name}
              </Text>
              {duration > 1 && !isCompact && (
                <Badge variant="outline" color="gray.6" size="xs" style={{ fontWeight: 600 }}>
                  {(duration / 3).toFixed(1).replace('.0', '')}d
                </Badge>
              )}
              {!isCompact && (
                <Badge
                  variant="light"
                  color={categoryBadgeColor}
                  size="xs"
                  className="timeline-category-badge"
                  leftSection={<CategoryIcon size={10} />}
                >
                  {categoryLabel}
                </Badge>
              )}
            </Box>


            <ActionIcon
              variant="subtle"
              color="red"
              size={isCompact ? 'xs' : 'sm'}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(id);
              }}
              title="Remove location"
              style={{ position: 'absolute', top: isCompact ? 2 : 4, right: canOpenSubItinerary ? (isCompact ? 20 : 26) : (isCompact ? 2 : 4), zIndex: 10 }}
            >
              <X size={isCompact ? 12 : 14} />
            </ActionIcon>

            {canOpenSubItinerary && (
              <ActionIcon
                variant="subtle"
                color="brand"
                size={isCompact ? 'xs' : 'sm'}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubItinerary?.(id);
                }}
                title="Open sub-itinerary"
                style={{ position: 'absolute', top: isCompact ? 2 : 4, right: isCompact ? 2 : 4, zIndex: 10 }}
              >
                <GitFork size={isCompact ? 12 : 14} />
              </ActionIcon>
            )}

          </Group>

          {location.notes && !isCompact && (
            <Text
              c="dimmed"
              size="xs"
              px={4}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: duration > 1 ? 4 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.4,
                maxHeight: duration > 1 ? '5.6em' : '1.4em',
                zIndex: 10,
              }}
            >
              {location.notes}
            </Text>
          )}

          {subLocationCount > 0 && !isCompact && (
            <Box mt="auto" pt={4}>
              <Badge size="xs" variant="light" color="indigo" leftSection={<GitFork size={9} />}>
                {subLocationCount} {subLocationCount === 1 ? 'stop' : 'stops'}
              </Badge>
            </Box>
          )}
        </Stack>
      </Paper>

      {!isDragging && (
        <Box
          className="resize-handle"
          onPointerDown={handleResizeStart}
          onPointerUp={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title="Drag to change duration"
          style={{ touchAction: 'none' }} // Crucial for mobile pointer events to work without scrolling
        >
          <Box className="resize-handle-bar" />
        </Box>
      )}
    </Box>
  );
});
