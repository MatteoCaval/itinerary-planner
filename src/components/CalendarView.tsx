import { SimpleGrid, Paper, Text, Box, Stack } from '@mantine/core';
import { Day, Location, LocationCategory } from '../types';
import { getSectionIndex } from '../constants/daySection';

interface CalendarViewProps {
  days: Day[];
  locations: Location[];
  onSelectLocation: (id: string) => void;
}

const CATEGORY_COLORS: Record<LocationCategory, string> = {
  sightseeing: 'blue',
  dining: 'orange',
  hotel: 'grape',
  transit: 'teal',
  other: 'gray'
};

export function CalendarView({ days, locations, onSelectLocation }: CalendarViewProps) {
  if (days.length === 0) return <Text c="dimmed" ta="center" py="xl">No dates selected</Text>;

  const months: { [key: string]: Day[] } = {};
  days.forEach(day => {
    const d = new Date(day.date);
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!months[key]) months[key] = [];
    months[key].push(day);
  });

  // Map day ID to index for quick lookups
  const dayIndexMap = new Map<string, number>();
  days.forEach((d, i) => dayIndexMap.set(d.id, i));

  const getLocationsForDay = (dayId: string) => {
    const currentDayIndex = dayIndexMap.get(dayId);
    if (currentDayIndex === undefined) return [];

    return locations.filter(loc => {
      if (!loc.startDayId) return false;
      const startDayIndex = dayIndexMap.get(loc.startDayId);
      if (startDayIndex === undefined) return false;

      const startSlotIndex = getSectionIndex(loc.startSlot);
      const absStartSlot = startDayIndex * 3 + startSlotIndex;
      const absEndSlot = absStartSlot + (loc.duration || 1) - 1;

      const dayStartSlot = currentDayIndex * 3;
      const dayEndSlot = dayStartSlot + 2;

      // Check intersection
      return Math.max(absStartSlot, dayStartSlot) <= Math.min(absEndSlot, dayEndSlot);
    });
  };

  return (
    <Box p="md" h="100%" style={{ overflowY: 'auto' }}>
      {Object.entries(months).map(([monthName, monthDays]) => (
        <Box key={monthName} mb="xl">
          <Paper p="xs" bg="gray.0" mb="sm" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <Text fw={700} c="dimmed" tt="uppercase">{monthName}</Text>
          </Paper>

          <SimpleGrid cols={7} spacing="xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} ta="center" size="xs" fw={700} c="dimmed">{d}</Text>
            ))}

            {Array.from({ length: new Date(monthDays[0].date).getDay() }).map((_, i) => (
              <Box key={`pad-${i}`} bg="gray.1" style={{ borderRadius: 4, opacity: 0.5 }} />
            ))}

            {monthDays.map(day => {
              const dayLocs = getLocationsForDay(day.id);

              return (
                <Paper key={day.id} withBorder p={4} style={{ minHeight: 80, display: 'flex', flexDirection: 'column' }}>
                  <Text ta="right" size="xs" c="dimmed" mb={4}>
                    {new Date(day.date).getDate()}
                  </Text>
                  <Stack gap={2}>
                    {dayLocs.map(loc => (
                      <Box
                        key={loc.id}
                        px={4}
                        py={2}
                        style={{
                          fontSize: 10,
                          backgroundColor: `var(--mantine-color-${CATEGORY_COLORS[loc.category || 'sightseeing']}-1)`,
                          color: `var(--mantine-color-${CATEGORY_COLORS[loc.category || 'sightseeing']}-7)`,
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        onClick={() => onSelectLocation(loc.id)}
                        title={loc.name}
                      >
                        {loc.name}
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  );
}