import { useState, useEffect, useMemo } from 'react';
import { Textarea, Button, ActionIcon, Paper, Group, Stack, Text, Badge, Image, LoadingOverlay, Box, Divider, ScrollArea, Tooltip, NumberInput, TextInput } from '@mantine/core';
import { X, Map as MapIcon, Calendar, ArrowRight, ArrowLeft, Bed, ChevronRight, ArrowUp, ArrowDown, Utensils, Train, Globe, Euro, Image as ImageIcon, Clock3 } from 'lucide-react';
import { Location, Day, Route, TRANSPORT_LABELS, CATEGORY_COLORS } from '../../types';
import { searchPhoto } from '../../unsplash';
import { LocationThumbnail } from '../LocationThumbnail';
import { SECTION_ORDER, getSectionIndex, DEFAULT_SECTION } from '../../constants/daySection';
import { SubDestinationsPanel } from './SubDestinationsPanel';
import { ChecklistSection } from './ChecklistSection';
import { LinksSection } from './LinksSection';

export interface LocationDetailPanelProps {
  location: Location | null;
  parentLocation?: Location | null;
  days: Day[];
  allLocations: Location[];
  routes: Route[];
  onUpdate: (id: string, updates: Partial<Location>) => void;
  onClose: () => void;
  onSelectLocation?: (id: string | null) => void;
  onEditRoute?: (fromId: string, toId: string) => void;
  selectedDayId?: string | null;
  onSelectDay?: (id: string | null) => void;
  onCollapse?: () => void;
  onEnterSubItinerary?: (parentId: string) => void;
  onExitSubItinerary?: () => void;
  isSubItineraryActive?: boolean;
}

export function LocationDetailPanel({
  location, parentLocation, days, allLocations, routes, onUpdate, onClose, onSelectLocation,
  onEditRoute, selectedDayId, onSelectDay, onCollapse, onEnterSubItinerary, onExitSubItinerary, isSubItineraryActive = false
}: LocationDetailPanelProps) {
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (location && !location.imageUrl && !imageLoading) {
        setImageLoading(true);
        const url = await searchPhoto(location.name);
        if (url) {
          onUpdate(location.id, { imageUrl: url });
        }
        setImageLoading(false);
      }
    };
    fetchImage();
  }, [location?.id]); // Only re-run if location ID changes

  const resolvedParentLocation = useMemo(() => {
    if (!location) return null;
    if (parentLocation?.subLocations?.some(sub => sub.id === location.id)) {
      return parentLocation;
    }
    return allLocations.find(loc => loc.subLocations?.some(sub => sub.id === location.id)) || null;
  }, [allLocations, location, parentLocation]);

  if (!location) return null;

  // Calculate Schedule Recap
  const startDay = days.find(d => d.id === location.startDayId);
  const startDayIdx = days.findIndex(d => d.id === location.startDayId);

  const getScheduleRecap = () => {
    if (!startDay) return 'Unassigned';

    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || DEFAULT_SECTION);
    const totalSlots = location.duration || 1;
    const endAbsSlot = (startDayIdx * 3) + startSlotIdx + totalSlots - 1;
    const endDayIdx = Math.floor(endAbsSlot / 3);
    const endSlotIdx = endAbsSlot % 3;
    const endDay = days[endDayIdx];

    const formatDate = (d: Day) => new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const startStr = `${formatDate(startDay)} (${location.startSlot})`;
    const endStr = endDay ? `${formatDate(endDay)} (${SECTION_ORDER[endSlotIdx]})` : 'End of trip';

    return { startStr, endStr, endDayIdx };
  };

  const schedule = getScheduleRecap();

  // Find Accommodations for this specific location (only if staying overnight)
  const scheduledAccommodations = (() => {
    if (!startDay || typeof schedule === 'string') return [];

    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || DEFAULT_SECTION);
    const totalSlots = location.duration || 1;
    const startAbsSlot = (startDayIdx * 3) + startSlotIdx;
    const endAbsSlot = startAbsSlot + totalSlots - 1;

    const accoms = new Set<string>();
    for (let i = startDayIdx; i < days.length; i++) {
      const eveningAbsSlot = i * 3 + 2;
      if (eveningAbsSlot >= startAbsSlot && eveningAbsSlot <= endAbsSlot) {
        if (days[i]?.accommodation?.name) {
          accoms.add(days[i].accommodation!.name);
        }
      }
    }
    return Array.from(accoms);
  })();

  // Find Chronological Neighbors for Travel Info
  const sortedMainLocs = [...allLocations]
    .filter(l => l.startDayId)
    .sort((a, b) => {
      const dayA = days.findIndex(d => d.id === a.startDayId);
      const dayB = days.findIndex(d => d.id === b.startDayId);
      if (dayA !== dayB) return dayA - dayB;
      const slotA = getSectionIndex(a.startSlot);
      const slotB = getSectionIndex(b.startSlot);
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    });

  const sortedSiblingSubLocs = [...(resolvedParentLocation?.subLocations || [])].sort((a, b) => {
    const dayA = a.dayOffset || 0;
    const dayB = b.dayOffset || 0;
    if (dayA !== dayB) return dayA - dayB;
    const slotA = getSectionIndex(a.startSlot);
    const slotB = getSectionIndex(b.startSlot);
    if (slotA !== slotB) return slotA - slotB;
    return (a.order || 0) - (b.order || 0);
  });

  const isSubDestination = Boolean(resolvedParentLocation?.subLocations?.some(sub => sub.id === location.id));
  const isMainDestinationWithSubItinerary = !isSubDestination && Boolean(location.subLocations?.length);
  const orderedNeighbors = isSubDestination ? sortedSiblingSubLocs : sortedMainLocs;
  const currentIdx = orderedNeighbors.findIndex(l => l.id === location.id);
  const prevLoc = currentIdx > 0 ? orderedNeighbors[currentIdx - 1] : null;
  const nextLoc = currentIdx < orderedNeighbors.length - 1 ? orderedNeighbors[currentIdx + 1] : null;

  const arrivalRoute = prevLoc ? routes.find(r =>
    (r.fromLocationId === prevLoc.id && r.toLocationId === location.id) ||
    (r.fromLocationId === location.id && r.toLocationId === prevLoc.id)
  ) : null;

  const departureRoute = nextLoc ? routes.find(r =>
    (r.fromLocationId === location.id && r.toLocationId === nextLoc.id) ||
    (r.fromLocationId === nextLoc.id && r.toLocationId === location.id)
  ) : null;

  // Group accommodations for this specific destination's duration
  const accommodationGroups = (() => {
    const groups: { name: string; nights: number; startDay: number; endDay: number }[] = [];
    if (!startDay || typeof schedule === 'string') return groups;

    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || DEFAULT_SECTION);
    const totalSlots = location.duration || 1;
    const startAbsSlot = (startDayIdx * 3) + startSlotIdx;
    const endAbsSlot = startAbsSlot + totalSlots - 1;

    // A "night" is counted if the location covers the transition from Day i to i+1
    // We define this as covering the "Evening" slot (index 2) of Day i
    const nightsCovered: number[] = [];
    for (let i = startDayIdx; i < days.length; i++) {
      const eveningAbsSlot = i * 3 + 2;
      if (eveningAbsSlot >= startAbsSlot && eveningAbsSlot <= endAbsSlot) {
        nightsCovered.push(i);
      }
    }

    if (nightsCovered.length === 0) return [];

    let currentGroup: { name: string; nights: number; startDay: number; endDay: number } | null = null;

    nightsCovered.forEach((dayIdx) => {
      const day = days[dayIdx];
      const name = day.accommodation?.name || 'No accommodation set';

      if (!currentGroup || currentGroup.name !== name) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { name, nights: 1, startDay: dayIdx + 1, endDay: dayIdx + 1 };
      } else {
        currentGroup.nights++;
        currentGroup.endDay = dayIdx + 1;
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  })();

  return (
    <Stack h="100%" gap={0}>
      <Box
        w="100%"
        className="location-detail-panel-image"
        style={{ position: 'relative' }}
        bg={location.imageUrl ? 'neutral.1' : 'neutral.8'}
      >
        {location.imageUrl && (
          <Image
            src={location.imageUrl}
            alt={location.name}
            h="100%"
            w="100%"
            fit="cover"
            onLoad={() => setImageLoading(false)}
          />
        )}
        {!location.imageUrl && (
          <Box className="location-detail-empty-preview">
            <LocationThumbnail
              name={location.name}
              category={location.category}
              size={72}
              radius={16}
            />
            <Text size="sm" fw={600} c="neutral.0" mt={10}>
              Photo Preview
            </Text>
            <Text size="xs" c="neutral.3">
              Open this destination to auto-load a representative image
            </Text>
          </Box>
        )}
        <Badge
          variant="filled"
          color="dark"
          leftSection={<ImageIcon size={12} />}
          style={{ position: 'absolute', left: 12, top: 12, zIndex: 11, opacity: 0.9 }}
        >
          Destination Preview
        </Badge>
        <LoadingOverlay visible={imageLoading && !location.imageUrl} />
        <Box style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
          <Group gap="xs">
            <Tooltip label="Collapse Panel">
              <ActionIcon variant="filled" color="blue" size="lg" radius="xl" onClick={onCollapse} style={{ opacity: 0.9 }}>
                <ChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Close (Exit Context)">
              <ActionIcon variant="filled" color="gray" size="lg" radius="xl" onClick={onClose} style={{ opacity: 0.9 }}>
                <X size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </Box>

      <Box className="location-detail-panel-header" p="lg" style={{ borderBottom: '1px solid var(--mantine-color-neutral-2)' }} bg="var(--mantine-color-neutral-0)">
        {parentLocation && (
          <Button
            variant="subtle"
            size="xs"
            mb="sm"
            leftSection={<ArrowLeft size={14} />}
            onClick={() => onSelectLocation?.(parentLocation.id)}
            style={{ paddingLeft: 0, '&:hover': { background: 'transparent' } }}
          >
            Back to {parentLocation.name}
          </Button>
        )}
        <Box>
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} size="lg">{location.name}</Text>
            <Text size="xs" c="dimmed">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</Text>
          </Box>
          <Group gap="xs" mt="xs" wrap="wrap">
            {isMainDestinationWithSubItinerary && (
              <Tooltip
                label={isSubItineraryActive ? 'Back to main itinerary timeline' : 'Open sub-itinerary timeline'}
                openDelay={500}
                withArrow
              >
                <ActionIcon
                  size="sm"
                  variant={isSubItineraryActive ? 'outline' : 'light'}
                  color={isSubItineraryActive ? 'gray' : 'indigo'}
                  onClick={() => {
                    if (isSubItineraryActive) {
                      onExitSubItinerary?.();
                    } else {
                      onEnterSubItinerary?.(location.id);
                    }
                  }}
                  aria-label={isSubItineraryActive ? 'Back to main itinerary' : 'Open sub-itinerary'}
                >
                  {isSubItineraryActive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={prevLoc ? `Previous: ${prevLoc.name}` : 'No previous destination'} openDelay={500} withArrow>
              <ActionIcon
                size="sm"
                variant="light"
                disabled={!prevLoc}
                onClick={() => prevLoc && onSelectLocation?.(prevLoc.id)}
                aria-label="Previous destination"
              >
                <ArrowLeft size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={nextLoc ? `Next: ${nextLoc.name}` : 'No next destination'} openDelay={500} withArrow>
              <ActionIcon
                size="sm"
                variant="light"
                disabled={!nextLoc}
                onClick={() => nextLoc && onSelectLocation?.(nextLoc.id)}
                aria-label="Next destination"
              >
                <ArrowRight size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Open in Google Maps" openDelay={500} withArrow>
              <ActionIcon
                size="sm"
                variant="outline"
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}`, '_blank')}
                aria-label="Open in Google Maps"
              >
                <MapIcon size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </Box>

      <ScrollArea flex={1} type="auto">
        <Box p="lg">
          <Paper p="md" withBorder shadow="sm" mb="lg" radius="md">
            <Group align="start" gap="md">
              <Calendar size={18} className="text-primary mt-1" style={{ color: 'var(--mantine-color-brand-6)' }} />
              <Box>
                <Text size="xs" fw={600} c="dimmed">Schedule recap</Text>
                {typeof schedule === 'string' ? (
                  <Text size="sm" mt={2} fw={500}>{schedule}</Text>
                ) : (
                  <Box mt={4}>
                    <Text size="sm"><Text span fw={600} c="neutral.6">From: </Text>{schedule.startStr}</Text>
                    <Text size="sm"><Text span fw={600} c="neutral.6">To: </Text>{schedule.endStr}</Text>
                    {scheduledAccommodations.length > 0 && (
                      <Box mt={8} pt={8} style={{ borderTop: '1px dashed var(--mantine-color-neutral-3)' }}>
                        <Group gap={6}>
                          <Bed size={14} color="var(--mantine-color-brand-6)" />
                          <Text size="xs" fw={600} c="brand.7">
                            Staying at: {scheduledAccommodations.join(', ')}
                          </Text>
                        </Group>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Group>

            {(arrivalRoute || departureRoute) && (
              <>
                <Divider my="sm" />
                <Text size="xs" fw={600} c="dimmed" mb="xs">Travel connections</Text>
                {arrivalRoute && prevLoc && (
                  <Group gap="xs" mb="xs">
                    <ArrowLeft size={14} style={{ color: 'var(--mantine-color-blue-5)' }} />
                    <Text size="xs" c="dimmed">Arrive from <Text span fw={700} c="dark">{prevLoc.name}</Text> via {TRANSPORT_LABELS[arrivalRoute.transportType]}</Text>
                  </Group>
                )}
                {departureRoute && nextLoc && (
                  <Group gap="xs">
                    <ArrowRight size={14} style={{ color: 'var(--mantine-color-green-6)' }} />
                    <Text size="xs" c="dimmed">Depart to <Text span fw={700} c="dark">{nextLoc.name}</Text> via {TRANSPORT_LABELS[departureRoute.transportType]}</Text>
                  </Group>
                )}
              </>
            )}
          </Paper>

          <SubDestinationsPanel
            location={location}
            days={days}
            routes={routes}
            onUpdate={onUpdate}
            onSelectLocation={onSelectLocation}
            onEditRoute={onEditRoute}
            selectedDayId={selectedDayId}
            onSelectDay={onSelectDay}
          />

          <Box mb="xl">
            <Group grow gap="md">
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={4}>Category</Text>
                <Group gap={4}>
                  {(['sightseeing', 'dining', 'hotel', 'transit', 'other'] as const).map(cat => (
                    <Tooltip key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                      <ActionIcon
                        variant={location.category === cat ? 'filled' : 'light'}
                        color={location.category === cat ? undefined : 'gray'}
                        style={{ backgroundColor: location.category === cat ? CATEGORY_COLORS[cat] : undefined }}
                        onClick={() => onUpdate(location.id, { category: cat })}
                        size="md"
                      >
                        {cat === 'sightseeing' && <MapIcon size={16} />}
                        {cat === 'dining' && <Utensils size={16} />}
                        {cat === 'hotel' && <Bed size={16} />}
                        {cat === 'transit' && <Train size={16} />}
                        {cat === 'other' && <Globe size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  ))}
                </Group>
              </Box>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={4}>Cost</Text>
                <NumberInput
                  size="xs"
                  placeholder="0.00"
                  leftSection={<Euro size={14} />}
                  value={location.cost}
                  onChange={(val) => onUpdate(location.id, { cost: Number(val) || 0 })}
                  min={0}
                  decimalScale={2}
                />
              </Box>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={4}>Target time</Text>
                <TextInput
                  size="xs"
                  placeholder="09:30"
                  leftSection={<Clock3 size={14} />}
                  value={location.targetTime || ''}
                  onChange={(e) => onUpdate(location.id, { targetTime: e.target.value })}
                />
              </Box>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={4}>Duration (slots)</Text>
                <NumberInput
                  size="xs"
                  value={location.duration || 1}
                  onChange={(val) => {
                    const parsed = Number(val);
                    onUpdate(location.id, {
                      duration: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1
                    });
                  }}
                  min={1}
                  step={1}
                  allowDecimal={false}
                />
                <Text size="10px" c="dimmed" mt={2}>
                  1 slot = morning, afternoon, or evening
                </Text>
              </Box>
            </Group>
          </Box>

          <Box mb="xl">
            <Text size="sm" fw={600} c="var(--app-ink)" mb={6} style={{ paddingLeft: 10, borderLeft: '3px solid var(--mantine-color-brand-4)' }}>Description & notes</Text>
            <Textarea
              autosize
              minRows={4}
              maxRows={12}
              placeholder="Add details, booking numbers, or notes..."
              value={location.notes || ''}
              onChange={(e) => onUpdate(location.id, { notes: e.target.value })}
            />
          </Box>

          {accommodationGroups.length > 0 && (
            <Box mb="xl">
              <Text size="sm" fw={600} c="var(--app-ink)" mb="xs" style={{ paddingLeft: 10, borderLeft: '3px solid var(--mantine-color-brand-4)' }}>Stay overview</Text>
              <Stack gap="sm">
                {accommodationGroups.map((group, i) => (
                  <Paper key={i} p="sm" withBorder bg={group.name === 'No accommodation set' ? 'neutral.0' : 'brand.0'} radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={700} truncate>{group.name}</Text>
                        <Text size="xs" c="dimmed">
                          Day {group.startDay}{group.nights > 1 ? ` - ${group.endDay}` : ''}
                        </Text>
                      </Box>
                      <Badge variant="light" color="brand">{group.nights} {group.nights === 1 ? 'night' : 'nights'}</Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          <ChecklistSection location={location} onUpdate={onUpdate} />

          <LinksSection location={location} onUpdate={onUpdate} />
        </Box>
      </ScrollArea>
    </Stack>
  );
}
