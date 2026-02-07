import { useMemo } from 'react';
import { Paper, Group, Stack, Text, RingProgress, Box, SimpleGrid, Badge, Divider, Tooltip } from '@mantine/core';
import { Wallet, Hotel, Utensils, Footprints, MapPin, PieChart, LucideIcon } from 'lucide-react';
import { Day, Location, Route } from '../types';

interface TripDashboardProps {
  days: Day[];
  locations: Location[];
  routes: Route[];
}

export function TripDashboard({ days, locations, routes }: TripDashboardProps) {
  const stats = useMemo(() => {
    let totalLocationCost = 0;
    let totalAccommodationCost = 0;
    let totalRouteCost = 0;

    const categoryBreakdown: Record<string, number> = {
      sightseeing: 0,
      dining: 0,
      hotel: 0,
      transit: 0,
      other: 0,
    };

    // Recursive function to sum location costs
    const processLocations = (locs: Location[]) => {
      locs.forEach(loc => {
        const cost = Number(loc.cost) || 0;
        totalLocationCost += cost;
        const cat = loc.category || 'other';
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + cost;
        
        if (loc.subLocations) {
          processLocations(loc.subLocations);
        }
      });
    };

    processLocations(locations);

    // Sum accommodation costs
    days.forEach(day => {
      if (day.accommodation?.cost) {
        const cost = Number(day.accommodation.cost);
        totalAccommodationCost += cost;
        categoryBreakdown['hotel'] += cost;
      }
    });

    // Sum route costs
    routes.forEach(route => {
      if (route.cost) {
        const cost = Number(route.cost);
        totalRouteCost += cost;
        categoryBreakdown['transit'] += cost;
      }
    });

    const total = totalLocationCost + totalAccommodationCost + totalRouteCost;

    return {
      total,
      totalLocationCost,
      totalAccommodationCost,
      totalRouteCost,
      categoryBreakdown,
      dailyAverage: days.length > 0 ? total / days.length : 0
    };
  }, [days, locations, routes]);

  if (stats.total === 0 && locations.length === 0) return null;

  const CATEGORY_COLORS: Record<string, string> = {
    sightseeing: 'blue',
    dining: 'orange',
    hotel: 'indigo',
    transit: 'green',
    other: 'gray',
  };

  const CATEGORY_ICONS: Record<string, LucideIcon> = {
    sightseeing: MapPin,
    dining: Utensils,
    hotel: Hotel,
    transit: Footprints,
    other: Wallet,
  };

  return (
    <Paper withBorder p="md" shadow="sm" radius="md" bg="gray.0">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Wallet size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={700} size="lg">Trip Budget Overview</Text>
        </Group>
        <Badge variant="filled" color="blue" size="lg" p="md">
          Total: €{stats.total.toFixed(2)}
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="sm" withBorder radius="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Daily Average</Text>
            <Text size="xl" fw={700}>€{stats.dailyAverage.toFixed(2)}</Text>
            <Text size="xs" c="dimmed">Across {days.length} days</Text>
          </Stack>
        </Paper>

        <Paper p="sm" withBorder radius="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Main Stays</Text>
            <Text size="xl" fw={700}>€{stats.totalAccommodationCost.toFixed(2)}</Text>
            <Text size="xs" c="dimmed">Accommodation total</Text>
          </Stack>
        </Paper>

        <Paper p="sm" withBorder radius="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Transit & Activities</Text>
            <Text size="xl" fw={700}>€{(stats.totalLocationCost + stats.totalRouteCost).toFixed(2)}</Text>
            <Text size="xs" c="dimmed">Routes + Destinations</Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Divider my="lg" label={<Group gap={4}><PieChart size={14} /> Category Breakdown</Group>} labelPosition="center" />

      <Group justify="center" wrap="wrap" gap="xl">
        {Object.entries(stats.categoryBreakdown).map(([cat, amount]) => {
          if (amount === 0 && stats.total > 0) return null;
          const percentage = stats.total > 0 ? (amount / stats.total) * 100 : 0;
          const Icon = CATEGORY_ICONS[cat];
          
          return (
            <Tooltip key={cat} label={`${cat.charAt(0).toUpperCase() + cat.slice(1)}: €${amount.toFixed(2)}`}>
              <Stack align="center" gap={4}>
                <RingProgress
                  size={80}
                  thickness={8}
                  roundCaps
                  sections={[{ value: percentage, color: CATEGORY_COLORS[cat] }]}
                  label={
                    <Box style={{ display: 'flex', justifyContent: 'center' }}>
                      <Icon size={16} />
                    </Box>
                  }
                />
                <Text size="xs" fw={700} tt="capitalize">{cat}</Text>
                <Text size="xs" c="dimmed">{percentage.toFixed(0)}%</Text>
              </Stack>
            </Tooltip>
          );
        })}
      </Group>
    </Paper>
  );
}
