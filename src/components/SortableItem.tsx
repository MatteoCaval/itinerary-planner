import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, GitFork, MapPin, Utensils, Bed, Train, Globe } from 'lucide-react';
import { ActionIcon, Badge, Text, Group, Stack, Box, Paper } from '@mantine/core';
import { Location, CATEGORY_COLORS } from '../types';
import { LocationThumbnail } from './LocationThumbnail';

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
  const thumbnailSize = isCompact ? 30 : 42;
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
        p={isCompact ? 6 : 'xs'}
        className={`sortable-item ${isCompact ? 'sortable-item--compact' : ''} ${hierarchyClass} ${categoryClass} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isOver ? 'nesting-target' : ''}`}
        style={{ 
          ...style, 
          borderColor: isOver ? 'var(--mantine-color-blue-6)' : (isSelected ? 'var(--mantine-color-blue-filled)' : catColor),
          borderWidth: isSelected || isOver ? 2 : 1,
          borderLeftWidth: 4,
          borderLeftStyle: 'solid',
          borderLeftColor: catColor,
          outline: isOver ? '2px dashed var(--mantine-color-blue-6)' : undefined,
          outlineOffset: isOver ? -2 : undefined
        }}
        bg={isOver ? 'blue.0' : (isSelected ? 'blue.0' : undefined)}
        onClick={() => onSelect?.(id)}
        h="100%"
      >
        <Stack gap={4} h="100%">
          <Group gap={isCompact ? 6 : 'xs'} align="center" wrap="nowrap">
            <Box
              {...attributes}
              {...listeners}
              style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={isCompact ? 16 : 18} />
            </Box>

            {index !== undefined && (
              <Badge size="xs" circle color="blue">{index}</Badge>
            )}

            {!isSubLocation && (
              <LocationThumbnail
                name={location.name}
                category={location.category}
                imageUrl={location.imageUrl}
                subLocationCount={subLocationCount}
                showSubLocationCount={!isCompact}
                size={thumbnailSize}
                radius={8}
                className="timeline-card-thumb"
              />
            )}

            <Box style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: isCompact ? 2 : 4, paddingRight: isCompact ? 16 : 20 }}>
              <Text
                fw={600}
                size={isCompact ? 'xs' : 'sm'}
                truncate
                style={{ flex: 1 }}
              >
                {location.name}
              </Text>
              {duration > 1 && !isCompact && (
                <Badge variant="outline" color="gray" size="xs" style={{ fontWeight: 400 }}>
                  {(duration / 3).toFixed(1).replace('.0', '')}d
                </Badge>
              )}
              {!isCompact && (
                <Badge
                  variant="filled"
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
              style={{ position: 'absolute', top: isCompact ? 2 : 4, right: canOpenSubItinerary ? (isCompact ? 20 : 26) : (isCompact ? 2 : 4) }}
            >
              <X size={isCompact ? 12 : 14} />
            </ActionIcon>

            {canOpenSubItinerary && (
              <ActionIcon
                variant="subtle"
                color="indigo"
                size={isCompact ? 'xs' : 'sm'}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSubItinerary?.(id);
                }}
                title="Open sub-itinerary"
                style={{ position: 'absolute', top: isCompact ? 2 : 4, right: isCompact ? 2 : 4 }}
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
