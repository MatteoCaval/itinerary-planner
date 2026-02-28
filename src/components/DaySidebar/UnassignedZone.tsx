import { Box, Group, Text, Stack } from '@mantine/core';
import { useDroppable } from '@dnd-kit/core';
import { MapPin } from 'lucide-react';
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
        minHeight: 80,
        backgroundColor: isOver ? 'var(--mantine-color-brand-0)' : 'transparent',
        borderColor: isOver ? 'var(--mantine-color-brand-4)' : 'var(--app-border)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        borderRadius: '10px',
        border: '1.5px dashed var(--app-border)',
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
          <Stack align="center" gap={6} w="100%" py="sm">
            <MapPin size={18} style={{ color: 'var(--app-border-strong)', opacity: 0.6 }} />
            <Text c="dimmed" size="xs" ta="center">
              Drag stops here to plan them later
            </Text>
          </Stack>
        )}
      </Group>
    </Box>
  );
}
