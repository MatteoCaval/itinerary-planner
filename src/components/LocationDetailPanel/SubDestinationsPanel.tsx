import React, { useState, useEffect, useMemo } from 'react';
import { Box, Group, Text, Stack, Paper, TextInput, Badge, ActionIcon, Divider } from '@mantine/core';
import { Search, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Location, Day, Route, TRANSPORT_LABELS, TRANSPORT_COLORS } from '../../types';
import { PlaceSearchResult, searchPlace } from '../../utils/geocoding';
import { SECTION_ORDER, DEFAULT_SECTION } from '../../constants/daySection';

interface SubDestinationsPanelProps {
  location: Location;
  days: Day[];
  routes: Route[];
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onSelectLocation?: (id: string | null) => void;
  onEditRoute?: (fromId: string, toId: string) => void;
  selectedDayId?: string | null;
  onSelectDay?: (id: string | null) => void;
}

export function SubDestinationsPanel({
  location,
  days,
  routes,
  onUpdate,
  onSelectLocation,
  onEditRoute,
  selectedDayId,
  onSelectDay,
}: SubDestinationsPanelProps) {
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subSuggestions, setSubSuggestions] = useState<PlaceSearchResult[]>([]);

  const sortedSubLocations = useMemo(() => {
    const subs = location.subLocations || [];
    return [...subs].sort((a, b) => {
      const dayA = a.dayOffset || 0;
      const dayB = b.dayOffset || 0;
      if (dayA !== dayB) return dayA - dayB;
      const slotA = SECTION_ORDER.indexOf(a.startSlot || DEFAULT_SECTION);
      const slotB = SECTION_ORDER.indexOf(b.startSlot || DEFAULT_SECTION);
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    });
  }, [location.subLocations]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (subSearchQuery.trim().length > 2) {
        const results = await searchPlace(subSearchQuery);
        setSubSuggestions(results || []);
      } else {
        setSubSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [subSearchQuery]);

  const handleAddSubLocation = (place: PlaceSearchResult) => {
    const newSub: Location = {
      id: uuidv4(),
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      order: (location.subLocations || []).length,
      dayIds: [],
      category: 'sightseeing',
    };
    onUpdate(location.id, {
      subLocations: [...(location.subLocations || []), newSub],
    });
    setSubSearchQuery('');
    setSubSuggestions([]);
  };

  const removeSubLocation = (subId: string) => {
    onUpdate(location.id, {
      subLocations: (location.subLocations || []).filter((l) => l.id !== subId),
    });
  };

  const moveSubLocation = (subId: string, direction: 'up' | 'down') => {
    const sortedSubs = [...sortedSubLocations];
    const sortedIdx = sortedSubs.findIndex((s) => s.id === subId);

    if (direction === 'up' && sortedIdx > 0) {
      const currentItem = { ...sortedSubs[sortedIdx] };
      const prevItem = { ...sortedSubs[sortedIdx - 1] };
      sortedSubs.splice(sortedIdx, 1);
      sortedSubs.splice(sortedIdx - 1, 0, currentItem);
      currentItem.dayOffset = prevItem.dayOffset;
      currentItem.startSlot = prevItem.startSlot;
      const finalSubs = sortedSubs.map((s, idx) => ({ ...s, order: idx }));
      onUpdate(location.id, { subLocations: finalSubs });
    } else if (direction === 'down' && sortedIdx < sortedSubs.length - 1) {
      const currentItem = { ...sortedSubs[sortedIdx] };
      const nextItem = { ...sortedSubs[sortedIdx + 1] };
      sortedSubs.splice(sortedIdx, 1);
      sortedSubs.splice(sortedIdx + 1, 0, currentItem);
      currentItem.dayOffset = nextItem.dayOffset;
      currentItem.startSlot = nextItem.startSlot;
      const finalSubs = sortedSubs.map((s, idx) => ({ ...s, order: idx }));
      onUpdate(location.id, { subLocations: finalSubs });
    }
  };

  const numDays = Math.ceil((location.duration || 1) / 3);
  const subs = sortedSubLocations;
  const grouped: Record<number | string, Location[]> = {};
  subs.forEach((s) => {
    const day = s.dayOffset === undefined ? 'unassigned' : s.dayOffset;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(s);
  });

  return (
    <Box mb="xl">
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
        Sub-Destinations
      </Text>
      <Box mb="sm" style={{ position: 'relative' }}>
        <TextInput
          size="xs"
          placeholder="Search to add sub-destination..."
          value={subSearchQuery}
          onChange={(e) => setSubSearchQuery(e.target.value)}
          rightSection={<Search size={14} />}
        />
        {subSuggestions.length > 0 && (
          <Paper
            withBorder
            shadow="md"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {subSuggestions.map((s) => (
              <Box
                key={s.place_id}
                p="xs"
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--mantine-color-gray-2)',
                }}
                className="hover-bg-light"
                onClick={() => handleAddSubLocation(s)}
              >
                <Text size="sm" fw={500}>
                  {s.display_name.split(',')[0]}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {s.display_name}
                </Text>
              </Box>
            ))}
          </Paper>
        )}
      </Box>

      <Stack gap="xs">
        {(() => {
          const rendered = [];

          for (let i = 0; i < numDays; i++) {
            const daySubs = grouped[i] || [];
            const startDayIdx = days.findIndex(
              (d) => d.id === location.startDayId,
            );
            const actualDay =
              startDayIdx !== -1 ? days[startDayIdx + i] : null;
            const isDaySelected = actualDay && selectedDayId === actualDay.id;

            rendered.push(
              <Box key={`day-group-${i}`} mt={i > 0 ? 'sm' : 0}>
                <Group
                  justify="space-between"
                  mb={4}
                  px={4}
                  onClick={() =>
                    actualDay &&
                    onSelectDay?.(isDaySelected ? null : actualDay.id)
                  }
                  style={{ cursor: 'pointer', borderRadius: 4 }}
                  bg={isDaySelected ? 'blue.0' : 'transparent'}
                >
                  <Text
                    size="xs"
                    fw={700}
                    c={isDaySelected ? 'blue.7' : 'blue.7'}
                  >
                    Day {i + 1} {isDaySelected && '(Filtered)'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {daySubs.length} items
                  </Text>
                </Group>
                <Divider
                  mb="xs"
                  color={isDaySelected ? 'blue.3' : 'blue.1'}
                />
                <Stack gap={6}>
                  {daySubs.map((sub, subIdx) => {
                    const sortedIdx = sortedSubLocations.findIndex(
                      (s) => s.id === sub.id,
                    );
                    const nextSub = daySubs[subIdx + 1];
                    const route = nextSub
                      ? routes.find(
                          (r) =>
                            (r.fromLocationId === sub.id &&
                              r.toLocationId === nextSub.id) ||
                            (r.fromLocationId === nextSub.id &&
                              r.toLocationId === sub.id),
                        )
                      : null;

                    return (
                      <React.Fragment key={sub.id}>
                        <Paper
                          p="xs"
                          withBorder
                          bg="white"
                          shadow="xs"
                          style={{ cursor: 'pointer' }}
                          onClick={() => onSelectLocation?.(sub.id)}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <Group
                              gap="xs"
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              <Badge
                                size="xs"
                                color="blue"
                                variant="light"
                                tt="capitalize"
                              >
                                {sub.startSlot || DEFAULT_SECTION}
                              </Badge>
                              <Text size="sm" fw={500} truncate>
                                {sub.name}
                              </Text>
                            </Group>
                            <Group gap={2}>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                disabled={sortedIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSubLocation(sub.id, 'up');
                                }}
                              >
                                <ArrowUp size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                disabled={
                                  sortedIdx ===
                                  sortedSubLocations.length - 1
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveSubLocation(sub.id, 'down');
                                }}
                              >
                                <ArrowDown size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSubLocation(sub.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Group>
                          </Group>
                        </Paper>

                        {nextSub && (
                          <Box px="md">
                            <Paper
                              p={4}
                              withBorder={!!route}
                              bg={route ? 'gray.0' : 'transparent'}
                              style={{
                                borderStyle: route ? 'solid' : 'dashed',
                                borderWidth: 1,
                                borderColor:
                                  'var(--mantine-color-gray-3)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '2px 0',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditRoute?.(sub.id, nextSub.id);
                              }}
                            >
                              {route ? (
                                <Group gap="xs">
                                  <Text
                                    size="10px"
                                    fw={700}
                                    c={
                                      TRANSPORT_COLORS[
                                        route.transportType
                                      ]
                                    }
                                  >
                                    {
                                      TRANSPORT_LABELS[
                                        route.transportType
                                      ]
                                    }
                                  </Text>
                                  {route.duration && (
                                    <>
                                      <Box
                                        style={{
                                          width: 1,
                                          height: 10,
                                          backgroundColor:
                                            'var(--mantine-color-gray-3)',
                                        }}
                                      />
                                      <Text size="10px" c="dimmed">
                                        {route.duration}
                                      </Text>
                                    </>
                                  )}
                                </Group>
                              ) : (
                                <Text size="10px" c="dimmed">
                                  + Set travel details
                                </Text>
                              )}
                            </Paper>
                          </Box>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {daySubs.length === 0 && (
                    <Text
                      size="xs"
                      c="dimmed"
                      fs="italic"
                      ta="center"
                      py={4}
                    >
                      No activities planned
                    </Text>
                  )}
                </Stack>
              </Box>,
            );
          }

          if (grouped['unassigned'] && grouped['unassigned'].length > 0) {
            rendered.push(
              <Box key="day-group-unassigned" mt="md">
                <Group justify="space-between" mb={4} px={4}>
                  <Text size="xs" fw={700} c="gray.7">
                    Unassigned
                  </Text>
                </Group>
                <Divider mb="xs" color="gray.2" />
                <Stack gap={6}>
                  {grouped['unassigned'].map((sub) => {
                    const sortedIdx = sortedSubLocations.findIndex(
                      (s) => s.id === sub.id,
                    );
                    return (
                      <Paper
                        key={sub.id}
                        p="xs"
                        withBorder
                        bg="gray.0"
                        shadow="xs"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectLocation?.(sub.id)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group
                            gap="xs"
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <Text
                              size="sm"
                              fw={500}
                              truncate
                              style={{ flex: 1 }}
                            >
                              {sub.name}
                            </Text>
                          </Group>
                          <Group gap={2}>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              disabled={sortedIdx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSubLocation(sub.id, 'up');
                              }}
                            >
                              <ArrowUp size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              disabled={
                                sortedIdx ===
                                sortedSubLocations.length - 1
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSubLocation(sub.id, 'down');
                              }}
                            >
                              <ArrowDown size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSubLocation(sub.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>,
            );
          }

          return rendered;
        })()}
        {(!location.subLocations || location.subLocations.length === 0) && (
          <Text size="xs" c="dimmed" fs="italic">
            No sub-destinations added yet.
          </Text>
        )}
      </Stack>
    </Box>
  );
}
