import { Box, Group, Text } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import { Location } from '../../types';
import { SortableItem } from '../SortableItem';
import { UNASSIGNED_ZONE_ID } from '../../constants/daySection';

interface UnassignedZoneProps {
  locations: Location[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onSelect?: (id: string | null) => void;
  selectedLocationId?: string | null;
  isSubLocation?: boolean;
  onOpenSubItinerary?: (id: string) => void;
}

export function UnassignedZone({
  locations,
  onRemove,
  onUpdate,
  onSelect,
  selectedLocationId,
  isSubLocation = false,
  onOpenSubItinerary,
}: UnassignedZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: UNASSIGNED_ZONE_ID });
  return (
    <Box
      ref={setNodeRef}
      style={{
        minHeight: 100,
        backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : 'transparent',
        transition: 'background-color 0.2s ease',
        borderRadius: '8px',
        border: '2px dashed var(--mantine-color-gray-3)',
      }}
    >
      <Group gap="xs" p="xs" w="100%" wrap="wrap">
        {locations.map((loc) => (
          <Box key={loc.id} style={{ width: '100%' }}>
            <SortableItem
              id={loc.id}
              location={loc}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onSelect={(id) => onSelect?.(id)}
              onOpenSubItinerary={onOpenSubItinerary}
              isSelected={selectedLocationId === loc.id}
              duration={loc.duration}
              zoomLevel={1.0}
              isSubLocation={isSubLocation}
            />
          </Box>
        ))}
        {locations.length === 0 && (
          <Text c="dimmed" size="xs" w="100%" ta="center">
            Drop places here to unassign them
          </Text>
        )}
      </Group>
    </Box>
  );
}
