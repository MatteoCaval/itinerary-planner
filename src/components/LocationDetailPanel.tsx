import React, { useState, useEffect, useMemo } from 'react';
import { TextInput, Textarea, Button, ActionIcon, Paper, Group, Stack, Text, Badge, Image, Checkbox, LoadingOverlay, Box, Divider, ScrollArea, Anchor, Tooltip, NumberInput } from '@mantine/core';
import { X, Plus, Trash2, ExternalLink, CheckSquare, Link as LinkIcon, Map as MapIcon, Calendar, ArrowRight, ArrowLeft, Bed, Search, ChevronRight, ArrowUp, ArrowDown, Utensils, Train, Globe, Euro, Image as ImageIcon } from 'lucide-react';
import { Location, Day, Route, DaySection, TRANSPORT_LABELS, TRANSPORT_COLORS, CATEGORY_COLORS } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { searchPhoto } from '../unsplash';
import { PlaceSearchResult, searchPlace } from '../utils/geocoding';
import { LocationThumbnail } from './LocationThumbnail';

interface LocationDetailPanelProps {
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

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => SECTION_ORDER.indexOf(section || 'morning');

export function LocationDetailPanel({ 
  location, parentLocation, days, allLocations, routes, onUpdate, onClose, onSelectLocation,
  onEditRoute, selectedDayId, onSelectDay, onCollapse, onEnterSubItinerary, onExitSubItinerary, isSubItineraryActive = false
}: LocationDetailPanelProps) {
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [imageLoading, setImageLoading] = useState(false);
  
  // Sub-location search state
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [subSuggestions, setSubSuggestions] = useState<PlaceSearchResult[]>([]);

  // 1. Unified Chronological Sort for Sub-locations
  const sortedSubLocations = useMemo(() => {
    const subs = location?.subLocations || [];
    return [...subs].sort((a, b) => {
      const dayA = a.dayOffset || 0;
      const dayB = b.dayOffset || 0;
      if (dayA !== dayB) return dayA - dayB;
      const slotA = SECTION_ORDER.indexOf(a.startSlot || 'morning');
      const slotB = SECTION_ORDER.indexOf(b.startSlot || 'morning');
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    });
  }, [location?.subLocations]);

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

  if (!location) return null;

  // Calculate Schedule Recap
  const startDay = days.find(d => d.id === location.startDayId);
  const startDayIdx = days.findIndex(d => d.id === location.startDayId);

  const getScheduleRecap = () => {
    if (!startDay) return 'Unassigned';

    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || 'morning');
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
    
    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || 'morning');
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

  const sortedSiblingSubLocs = [...(parentLocation?.subLocations || [])].sort((a, b) => {
    const dayA = a.dayOffset || 0;
    const dayB = b.dayOffset || 0;
    if (dayA !== dayB) return dayA - dayB;
    const slotA = getSectionIndex(a.startSlot);
    const slotB = getSectionIndex(b.startSlot);
    if (slotA !== slotB) return slotA - slotB;
    return (a.order || 0) - (b.order || 0);
  });

  const isSubDestination = Boolean(parentLocation?.subLocations?.some(sub => sub.id === location.id));
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

  const handleAddSubLocation = (place: PlaceSearchResult) => {
    const newSub: Location = {
      id: uuidv4(),
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      order: (location.subLocations || []).length,
      dayIds: [],
      category: 'sightseeing'
    };
    onUpdate(location.id, { subLocations: [...(location.subLocations || []), newSub] });
    setSubSearchQuery('');
    setSubSuggestions([]);
  };

  const removeSubLocation = (subId: string) => {
    onUpdate(location.id, { subLocations: (location.subLocations || []).filter(l => l.id !== subId) });
  };

  const moveSubLocation = (subId: string, direction: 'up' | 'down') => {
    if (!location) return;
    const sortedSubs = [...sortedSubLocations];
    const sortedIdx = sortedSubs.findIndex(s => s.id === subId);
    
    if (direction === 'up' && sortedIdx > 0) {
      const currentItem = { ...sortedSubs[sortedIdx] };
      const prevItem = { ...sortedSubs[sortedIdx - 1] };
      
      // Swap positions in the sorted array
      sortedSubs.splice(sortedIdx, 1);
      sortedSubs.splice(sortedIdx - 1, 0, currentItem);
      
      // Inherit timing from new neighbor
      currentItem.dayOffset = prevItem.dayOffset;
      currentItem.startSlot = prevItem.startSlot;
      
      const finalSubs = sortedSubs.map((s, idx) => ({ ...s, order: idx }));
      onUpdate(location.id, { subLocations: finalSubs });
    } else if (direction === 'down' && sortedIdx < sortedSubs.length - 1) {
      const currentItem = { ...sortedSubs[sortedIdx] };
      const nextItem = { ...sortedSubs[sortedIdx + 1] };
      
      // Swap positions
      sortedSubs.splice(sortedIdx, 1);
      sortedSubs.splice(sortedIdx + 1, 0, currentItem);
      
      // Inherit timing
      currentItem.dayOffset = nextItem.dayOffset;
      currentItem.startSlot = nextItem.startSlot;
      
      const finalSubs = sortedSubs.map((s, idx) => ({ ...s, order: idx }));
      onUpdate(location.id, { subLocations: finalSubs });
    }
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    const newItem = { id: uuidv4(), text: newChecklistItem, completed: false };
    onUpdate(location.id, { checklist: [...(location.checklist || []), newItem] });
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
    onUpdate(location.id, { checklist: updated });
  };

  const removeChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).filter(item => item.id !== itemId);
    onUpdate(location.id, { checklist: updated });
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.url.trim()) return;
    const newItem = { id: uuidv4(), label: newLink.label || newLink.url, url: newLink.url };
    onUpdate(location.id, { links: [...(location.links || []), newItem] });
    setNewLink({ label: '', url: '' });
  };

  const removeLink = (linkId: string) => {
    const updated = (location.links || []).filter(item => item.id !== linkId);
    onUpdate(location.id, { links: updated });
  };

  // Group accommodations for this specific destination's duration
  const accommodationGroups = (() => {
    const groups: { name: string; nights: number; startDay: number; endDay: number }[] = [];
    if (!startDay || typeof schedule === 'string') return groups;

    const startSlotIdx = SECTION_ORDER.indexOf(location.startSlot || 'morning');
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
        bg={location.imageUrl ? 'gray.1' : 'dark.2'}
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
            <Text size="sm" fw={600} c="gray.0" mt={10}>
              Photo Preview
            </Text>
            <Text size="xs" c="gray.3">
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

      <Box className="location-detail-panel-header" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }} bg="gray.0">
        {parentLocation && (
          <Button 
            variant="subtle" 
            size="xs" 
            mb="xs" 
            leftSection={<ArrowLeft size={14} />} 
            onClick={() => onSelectLocation?.(parentLocation.id)}
          >
            Back to {parentLocation.name}
          </Button>
        )}
        <Group justify="space-between" align="start">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} size="lg" truncate>{location.name}</Text>
            <Text size="xs" c="dimmed">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</Text>
          </Box>
          <Group gap="xs">
            {isMainDestinationWithSubItinerary && (
              <Tooltip label={isSubItineraryActive ? 'Back to main itinerary timeline' : 'Open sub-itinerary timeline'}>
                <Button
                  size="xs"
                  variant={isSubItineraryActive ? 'outline' : 'light'}
                  color={isSubItineraryActive ? 'gray' : 'indigo'}
                  onClick={() => {
                    if (isSubItineraryActive) {
                      onExitSubItinerary?.();
                    } else {
                      onEnterSubItinerary?.(location.id);
                    }
                  }}
                >
                  {isSubItineraryActive ? 'Back to Main Itinerary' : 'Open Sub-Itinerary'}
                </Button>
              </Tooltip>
            )}
            <Tooltip label={prevLoc ? `Previous: ${prevLoc.name}` : 'No previous destination'}>
              <Button
                size="xs"
                variant="light"
                leftSection={<ArrowLeft size={14} />}
                disabled={!prevLoc}
                onClick={() => prevLoc && onSelectLocation?.(prevLoc.id)}
              >
                Back
              </Button>
            </Tooltip>
            <Tooltip label={nextLoc ? `Next: ${nextLoc.name}` : 'No next destination'}>
              <Button
                size="xs"
                variant="light"
                rightSection={<ArrowRight size={14} />}
                disabled={!nextLoc}
                onClick={() => nextLoc && onSelectLocation?.(nextLoc.id)}
              >
                Next
              </Button>
            </Tooltip>
            <Button
              size="xs"
              variant="outline"
              leftSection={<MapIcon size={14} />}
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}`, '_blank')}
            >
              Maps
            </Button>
          </Group>
        </Group>
      </Box>

      <ScrollArea flex={1} type="auto">
        <Box p="md">
          <Paper p="sm" withBorder shadow="sm" mb="md">
            <Group align="start" gap="md">
              <Calendar size={18} className="text-primary mt-1" style={{ color: 'var(--mantine-color-blue-6)' }} />
              <Box>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">Schedule Recap</Text>
                {typeof schedule === 'string' ? (
                  <Text size="sm">{schedule}</Text>
                ) : (
                  <Box>
                    <Text size="sm"><Text span fw={500}>From: </Text>{schedule.startStr}</Text>
                    <Text size="sm"><Text span fw={500}>To: </Text>{schedule.endStr}</Text>
                    {scheduledAccommodations.length > 0 && (
                      <Box mt={4} pt={4} style={{ borderTop: '1px dashed var(--mantine-color-gray-3)' }}>
                        <Group gap={4}>
                          <Bed size={12} color="var(--mantine-color-indigo-6)" />
                          <Text size="xs" fw={500} c="indigo.7">
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
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Travel Connections</Text>
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

          {/* Sub-Destinations Section */}
          <Box mb="xl">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Sub-Destinations</Text>
            <Box mb="sm" style={{ position: 'relative' }}>
                <TextInput
                  size="xs"
                  placeholder="Search to add sub-destination..."
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  rightSection={<Search size={14} />}
                />
                {subSuggestions.length > 0 && (
                  <Paper withBorder shadow="md" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: 200, overflowY: 'auto' }}>
                    {subSuggestions.map((s) => (
                      <Box
                        key={s.place_id}
                        p="xs"
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                        className="hover-bg-light"
                        onClick={() => handleAddSubLocation(s)}
                      >
                        <Text size="sm" fw={500}>{s.display_name.split(',')[0]}</Text>
                        <Text size="xs" c="dimmed" truncate>{s.display_name}</Text>
                      </Box>
                    ))}
                  </Paper>
                )}
            </Box>

            <Stack gap="xs">
              {(() => {
                const subs = sortedSubLocations;
                const numDays = Math.ceil((location.duration || 1) / 3);
                const grouped: Record<number | string, Location[]> = {};
                
                // Group by dayOffset
                subs.forEach(s => {
                  const day = s.dayOffset === undefined ? 'unassigned' : s.dayOffset;
                  if (!grouped[day]) grouped[day] = [];
                  grouped[day].push(s);
                });

                const rendered = [];

                // Render Assigned Days
                for (let i = 0; i < numDays; i++) {
                  const daySubs = (grouped[i] || []);
                  
                  // Find the actual day ID from the global days array
                  const startDayIdx = days.findIndex(d => d.id === location.startDayId);
                  const actualDay = startDayIdx !== -1 ? days[startDayIdx + i] : null;
                  const isDaySelected = actualDay && selectedDayId === actualDay.id;

                  rendered.push(
                    <Box key={`day-group-${i}`} mt={i > 0 ? 'sm' : 0}>
                      <Group 
                        justify="space-between" 
                        mb={4} 
                        px={4} 
                        onClick={() => actualDay && onSelectDay?.(isDaySelected ? null : actualDay.id)}
                        style={{ cursor: 'pointer', borderRadius: 4 }}
                        bg={isDaySelected ? 'blue.0' : 'transparent'}
                      >
                        <Text size="xs" fw={700} c={isDaySelected ? 'blue.7' : 'blue.7'}>Day {i + 1} {isDaySelected && '(Filtered)'}</Text>
                        <Text size="xs" c="dimmed">{daySubs.length} items</Text>
                      </Group>
                      <Divider mb="xs" color={isDaySelected ? 'blue.3' : 'blue.1'} />
                      <Stack gap={6}>
                        {daySubs.map((sub, subIdx) => {
                           const sortedIdx = sortedSubLocations.findIndex(s => s.id === sub.id);
                           const nextSub = daySubs[subIdx + 1];
                           const route = nextSub ? routes.find(r => 
                             (r.fromLocationId === sub.id && r.toLocationId === nextSub.id) || 
                             (r.fromLocationId === nextSub.id && r.toLocationId === sub.id)
                           ) : null;

                           return (
                             <React.Fragment key={sub.id}>
                              <Paper p="xs" withBorder bg="white" shadow="xs" style={{ cursor: 'pointer' }} onClick={() => onSelectLocation?.(sub.id)}>
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                                    <Badge size="xs" color="blue" variant="light" tt="capitalize">{sub.startSlot || 'morning'}</Badge>
                                    <Text size="sm" fw={500} truncate>{sub.name}</Text>
                                  </Group>
                                  <Group gap={2}>
                                    <ActionIcon size="sm" variant="subtle" disabled={sortedIdx === 0} onClick={(e) => { e.stopPropagation(); moveSubLocation(sub.id, 'up'); }}>
                                      <ArrowUp size={14} />
                                    </ActionIcon>
                                    <ActionIcon size="sm" variant="subtle" disabled={sortedIdx === sortedSubLocations.length - 1} onClick={(e) => { e.stopPropagation(); moveSubLocation(sub.id, 'down'); }}>
                                      <ArrowDown size={14} />
                                    </ActionIcon>
                                    <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); removeSubLocation(sub.id); }}>
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
                                      borderColor: 'var(--mantine-color-gray-3)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      margin: '2px 0'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditRoute?.(sub.id, nextSub.id);
                                    }}
                                  >
                                    {route ? (
                                      <Group gap="xs">
                                        <Text size="10px" fw={700} c={TRANSPORT_COLORS[route.transportType]}>
                                          {TRANSPORT_LABELS[route.transportType]}
                                        </Text>
                                        {route.duration && (
                                          <>
                                            <Box style={{ width: 1, height: 10, backgroundColor: 'var(--mantine-color-gray-3)' }} />
                                            <Text size="10px" c="dimmed">{route.duration}</Text>
                                          </>
                                        )}
                                      </Group>
                                    ) : (
                                      <Text size="10px" c="dimmed">+ Set travel details</Text>
                                    )}
                                  </Paper>
                                </Box>
                              )}
                             </React.Fragment>
                           );
                        })}
                        {daySubs.length === 0 && <Text size="xs" c="dimmed" fs="italic" ta="center" py={4}>No activities planned</Text>}
                      </Stack>
                    </Box>
                  );
                }

                // Render Unassigned
                if (grouped['unassigned'] && grouped['unassigned'].length > 0) {
                  rendered.push(
                    <Box key="day-group-unassigned" mt="md">
                      <Group justify="space-between" mb={4} px={4}>
                        <Text size="xs" fw={700} c="gray.7">Unassigned</Text>
                      </Group>
                      <Divider mb="xs" color="gray.2" />
                      <Stack gap={6}>
                        {grouped['unassigned'].map((sub) => {
                           const sortedIdx = sortedSubLocations.findIndex(s => s.id === sub.id);
                           return (
                             <Paper key={sub.id} p="xs" withBorder bg="gray.0" shadow="xs" style={{ cursor: 'pointer' }} onClick={() => onSelectLocation?.(sub.id)}>
                              <Group justify="space-between" wrap="nowrap">
                                <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                                  <Text size="sm" fw={500} truncate style={{ flex: 1 }}>{sub.name}</Text>
                                </Group>
                                <Group gap={2}>
                                  <ActionIcon size="sm" variant="subtle" disabled={sortedIdx === 0} onClick={(e) => { e.stopPropagation(); moveSubLocation(sub.id, 'up'); }}>
                                    <ArrowUp size={14} />
                                  </ActionIcon>
                                  <ActionIcon size="sm" variant="subtle" disabled={sortedIdx === sortedSubLocations.length - 1} onClick={(e) => { e.stopPropagation(); moveSubLocation(sub.id, 'down'); }}>
                                    <ArrowDown size={14} />
                                  </ActionIcon>
                                  <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); removeSubLocation(sub.id); }}>
                                    <Trash2 size={14} />
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Paper>
                           );
                        })}
                      </Stack>
                    </Box>
                  );
                }

                return rendered;
              })()}
              {(!location.subLocations || location.subLocations.length === 0) && (
                <Text size="xs" c="dimmed" fs="italic">No sub-destinations added yet.</Text>
              )}
            </Stack>
          </Box>

          <Box mb="xl">
            <Group grow gap="md">
              <Box>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Category</Text>
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
                <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Cost</Text>
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
            </Group>
          </Box>

          <Box mb="xl">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>Description & Notes</Text>
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
              <Group gap={6} mb="xs">
                <Bed size={14} />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">Stay Overview</Text>
              </Group>
              <Stack gap="xs">
                {accommodationGroups.map((group, i) => (
                  <Paper key={i} p="xs" withBorder bg={group.name === 'No accommodation set' ? 'gray.0' : 'indigo.0'}>
                    <Group justify="space-between" wrap="nowrap">
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={700} truncate>{group.name}</Text>
                          <Text size="xs" c="dimmed">
                            Day {group.startDay}{group.nights > 1 ? ` - ${group.endDay}` : ''}
                          </Text>
                        </Box>
                        <Badge variant="light" color="indigo">{group.nights} {group.nights === 1 ? 'night' : 'nights'}</Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          <Box mb="xl">
            <Group justify="space-between" mb="xs">
              <Group gap={6}>
                <CheckSquare size={14} />
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">Checklist</Text>
              </Group>
              <Badge color="gray" size="sm">{(location.checklist || []).filter(i => i.completed).length}/{(location.checklist || []).length}</Badge>
            </Group>

            <Stack gap="xs" mb="sm">
              {(location.checklist || []).map(item => (
                <Group key={item.id} gap="sm" align="center" wrap="nowrap">
                  <Checkbox checked={item.completed} onChange={() => toggleChecklistItem(item.id)} />
                  <Text size="sm" td={item.completed ? 'line-through' : undefined} c={item.completed ? 'dimmed' : undefined} style={{ flex: 1, lineHeight: 1.2 }}>{item.text}</Text>
                  <ActionIcon variant="transparent" color="red" size="xs" onClick={() => removeChecklistItem(item.id)} opacity={0.5}><Trash2 size={14} /></ActionIcon>
                </Group>
              ))}
            </Stack>

            <form onSubmit={handleAddChecklistItem}>
              <Group gap="xs">
                <TextInput style={{ flex: 1 }} size="xs" placeholder="Add task..." value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} />
                <ActionIcon type="submit" variant="filled" size="sm"><Plus size={16} /></ActionIcon>
              </Group>
            </form>
          </Box>

          <Box mb="xl">
            <Group gap={6} mb="xs">
              <LinkIcon size={12} />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Helpful Links</Text>
            </Group>

            <Stack gap="xs" mb="sm">
              {(location.links || []).map(link => (
                <Group key={link.id} gap="sm" align="center" wrap="nowrap">
                  <ExternalLink size={14} className="text-muted" />
                  <Anchor href={link.url} target="_blank" rel="noopener noreferrer" size="sm" truncate style={{ flex: 1 }}>{link.label}</Anchor>
                  <ActionIcon variant="transparent" color="red" size="xs" onClick={() => removeLink(link.id)} opacity={0.5}><Trash2 size={14} /></ActionIcon>
                </Group>
              ))}
            </Stack>

            <form onSubmit={handleAddLink}>
              <Stack gap="xs">
                <TextInput size="xs" placeholder="Link Label (e.g. Booking.com)" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} />
                <Group gap="xs">
                  <TextInput style={{ flex: 1 }} size="xs" placeholder="URL..." value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} />
                  <ActionIcon type="submit" variant="filled" size="sm"><Plus size={16} /></ActionIcon>
                </Group>
              </Stack>
            </form>
          </Box>
        </Box>
      </ScrollArea>
    </Stack>
  );
}
