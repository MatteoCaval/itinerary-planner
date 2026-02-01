import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ActionIcon, Text, Group, Stack, Box, Paper, Tooltip, Popover, TextInput, Button, Autocomplete } from '@mantine/core';
import { Plus, Sun, Moon, Coffee, ChevronDown, ChevronUp, Bed, Trash, Search, MapPin } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    useDroppable
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Day, Location, Route, DaySection, TRANSPORT_COLORS, TRANSPORT_LABELS } from '../types';
import { SortableItem } from './SortableItem';
import { searchPlace } from '../utils/geocoding';

interface DaySidebarProps {
    days: Day[];
    locations: Location[];
    routes: Route[];
    onReorderLocations: (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => void;
    onRemoveLocation: (id: string) => void;
    onUpdateLocation: (id: string, updates: Partial<Location>) => void;
    onEditRoute: (fromId: string, toId: string) => void;
    onAddToDay: (dayId: string, slot?: DaySection) => void;
    onUpdateDay: (id: string, updates: Partial<Day>) => void;
    hoveredLocationId?: string | null;
    onHoverLocation?: (id: string | null) => void;
    selectedLocationId?: string | null;
    onSelectLocation?: (id: string | null) => void;
    zoomLevel: number;
    dayNumberOffset?: number;
    parentName?: string;
    selectedDayId?: string | null;
    onSelectDay?: (id: string | null) => void;
    isSlotBlocked?: (dayId: string, slot: DaySection) => boolean;
}

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => {
    if (!section) return 0;
    return SECTION_ORDER.indexOf(section);
};

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

function DroppableCell({ id, section, row, isEvenDay, zoomLevel, onClick, isBlocked, children }: { id: string, section: DaySection, row: number, isEvenDay: boolean, zoomLevel: number, onClick?: () => void, isBlocked?: boolean, children?: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id, disabled: isBlocked });

    let icon;
    let color;
    switch (section) {
        case 'morning':
            icon = <Coffee size={14} />;
            color = "orange";
            break;
        case 'afternoon':
            icon = <Sun size={14} />;
            color = "yellow";
            break;
        case 'evening':
            icon = <Moon size={14} />;
            color = "indigo";
            break;
    }

    const bgClass = isBlocked ? 'var(--mantine-color-gray-2)' : (isEvenDay ? 'var(--mantine-color-gray-0)' : 'white');

    return (
        <Box
            ref={setNodeRef}
            onClick={!isBlocked ? onClick : undefined}
            style={{
                gridColumn: '2 / -1',
                gridRow: `${row} / span 1`,
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                minHeight: `${80 * zoomLevel}px`,
                zIndex: 0,
                cursor: isBlocked ? 'not-allowed' : 'pointer',
                backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : bgClass,
                display: 'flex',
                alignItems: 'center',
                transition: 'background-color 0.2s ease',
                opacity: isBlocked ? 0.6 : 1,
            }}
        >
            <Box style={{ width: 40, minWidth: 40, height: '100%', pointerEvents: 'none', borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isBlocked ? 'rgba(0,0,0,0.05)' : 'transparent' }}>
                <Stack gap={2} align="center" c={isBlocked ? 'gray' : color}>
                    {icon}
                </Stack>
            </Box>
            {isBlocked && (
              <Box px="md">
                <Text size="xs" c="dimmed" fs="italic">Outside destination timeframe</Text>
              </Box>
            )}
            {children}
        </Box>
    );
}

function UnassignedZone({ locations, onRemove, onUpdate, onSelect, selectedLocationId }: {
    locations: Location[],
    onRemove: (id: string) => void,
    onUpdate: (id: string, updates: Partial<Location>) => void,
    onSelect?: (id: string | null) => void,
    selectedLocationId?: string | null
}) {
    const { isOver, setNodeRef } = useDroppable({ id: 'unassigned-zone' });
    return (
        <Box
            ref={setNodeRef}
            style={{
                minHeight: 100,
                backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : 'transparent',
                transition: 'background-color 0.2s ease',
                borderRadius: '8px',
                border: '2px dashed var(--mantine-color-gray-3)'
            }}
        >
            <Group gap="xs" p="xs" w="100%" wrap="wrap">
                {locations.map(loc => (
                    <Box key={loc.id} style={{ width: '100%' }}>
                        <SortableItem
                            id={loc.id}
                            location={loc}
                            onRemove={onRemove}
                            onUpdate={onUpdate}
                            onSelect={(id) => onSelect?.(id)}
                            isSelected={selectedLocationId === loc.id}
                            duration={loc.duration}
                            zoomLevel={1.0}
                        />
                    </Box>
                ))}
                {locations.length === 0 && <Text c="dimmed" size="xs" w="100%" ta="center">Drop places here to unassign them</Text>}
            </Group>
        </Box>
    );
}

function DayLabel({ day, startRow, dayNum, isEvenDay, onAdd, onUpdateDay, existingAccommodations, parentName, dayNumberOffset, isSelected, onSelect }: {
    day: Day,
    startRow: number,
    dayNum: number,
    isEvenDay: boolean,
    onAdd: () => void,
    onUpdateDay: (id: string, updates: Partial<Day>) => void,
    existingAccommodations: string[],
    parentName?: string,
    dayNumberOffset?: number,
    isSelected?: boolean,
    onSelect?: () => void
}) {
    const [opened, setOpened] = useState(false);
    const [tempName, setTempName] = useState(day.accommodation?.name || '');
    const [tempNotes, setTempNotes] = useState(day.accommodation?.notes || '');
    const [tempLat, setTempLat] = useState(day.accommodation?.lat);
    const [tempLng, setTempLng] = useState(day.accommodation?.lng);
    
    // Search state
    const [suggestions, setSuggestions] = useState<any[]>([]);

    // Reset local state when day prop changes (e.g. if loaded from cloud)
    useEffect(() => {
        setTempName(day.accommodation?.name || '');
        setTempNotes(day.accommodation?.notes || '');
        setTempLat(day.accommodation?.lat);
        setTempLng(day.accommodation?.lng);
    }, [day.accommodation]);

    // Auto-search when name changes (debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (opened && tempName.trim().length > 2 && !tempLat) {
                const results = await searchPlace(tempName);
                setSuggestions(results || []);
            } else {
                setSuggestions([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [tempName, opened, tempLat]);

    const selectSuggestion = (s: any) => {
        setTempName(s.display_name.split(',')[0]);
        setTempLat(parseFloat(s.lat));
        setTempLng(parseFloat(s.lon));
        setSuggestions([]);
    };

    const handleSave = () => {
        onUpdateDay(day.id, {
            accommodation: {
                ...day.accommodation,
                name: tempName,
                notes: tempNotes,
                lat: tempLat,
                lng: tempLng
            }
        });
        setOpened(false);
    };

    const handleRemove = () => {
        onUpdateDay(day.id, { accommodation: undefined });
        setOpened(false);
    };

    return (
        <Box
            p="xs"
            onClick={onSelect}
            className="day-label-box"
            style={{
                gridColumn: '1 / span 1',
                gridRow: `${startRow} / span 3`,
                zIndex: 2,
                borderTop: '1px solid var(--mantine-color-gray-3)',
                borderRight: isSelected ? '4px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-gray-3)',
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : (isEvenDay ? 'var(--mantine-color-gray-0)' : 'white'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: onSelect ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                position: 'relative'
            }}
        >
            <Stack gap={4} align="center">
                <Box>
                    <Text size="sm" fw={700}>{parentName ? `${parentName} Day` : 'Day'} {parentName ? dayNum - (dayNumberOffset || 0) + 1 : dayNum}</Text>
                    {parentName && <Text size="xs" c="blue.6" fw={500}>(Day {dayNum})</Text>}
                </Box>
                <Text size="xs" c="dimmed">{formatDate(day.date)}</Text>
                
                <Popover opened={opened} onChange={setOpened} withArrow trapFocus width={300} position="right" shadow="md" zIndex={2100} withinPortal>
                    <Tooltip label={day.accommodation?.name ? `Staying at: ${day.accommodation.name}` : "Set Accommodation"}>
                        <Popover.Target>
                            <ActionIcon 
                                variant={day.accommodation?.name ? "filled" : "light"} 
                                color={day.accommodation?.name ? "indigo" : "gray"} 
                                size="sm" 
                                radius="sm" 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setOpened((o) => !o); 
                                }}
                            >
                                <Bed size={14} />
                            </ActionIcon>
                        </Popover.Target>
                    </Tooltip>
                    <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
                        <Stack gap="xs">
                            <Text size="sm" fw={700}>Accommodation</Text>
                            <Box style={{ position: 'relative' }}>
                                <Autocomplete
                                    placeholder="Search Hotel / Address..."
                                    value={tempName}
                                    onChange={(val) => {
                                        setTempName(val);
                                        // Reset coords if user types new name, unless selecting
                                        if (val !== tempName) {
                                           // We don't strictly reset coords here to avoid clearing them on minor edits
                                           // But ideally we should if it's a totally new place. 
                                           // For now, let's keep it simple. User can re-select from dropdown.
                                        }
                                    }}
                                    size="xs"
                                    label="Name / Location"
                                    data={existingAccommodations}
                                    comboboxProps={{ withinPortal: false }}
                                    rightSection={tempLat ? <MapPin size={14} color="green" /> : <Search size={14} />}
                                />
                                {suggestions.length > 0 && (
                                    <Paper 
                                        withBorder 
                                        shadow="md" 
                                        style={{ 
                                            position: 'absolute', 
                                            top: '100%', 
                                            left: 0, 
                                            right: 0, 
                                            zIndex: 2200, 
                                            maxHeight: 150, 
                                            overflowY: 'auto' 
                                        }}
                                    >
                                        {suggestions.map((s, i) => (
                                            <Box
                                                key={i}
                                                p="xs"
                                                style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                                                className="hover-bg-light"
                                                onClick={() => selectSuggestion(s)}
                                            >
                                                <Text size="xs" fw={500}>{s.display_name.split(',')[0]}</Text>
                                                <Text size="xs" c="dimmed" truncate>{s.display_name}</Text>
                                            </Box>
                                        ))}
                                    </Paper>
                                )}
                            </Box>
                            
                            {tempLat && (
                                <Text size="xs" c="dimmed" fs="italic">
                                    <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />
                                    Location set ({tempLat.toFixed(4)}, {tempLng?.toFixed(4)})
                                </Text>
                            )}

                            <TextInput 
                                placeholder="Notes / Address" 
                                value={tempNotes} 
                                onChange={(e) => setTempNotes(e.currentTarget.value)}
                                size="xs"
                                label="Notes"
                            />
                            <Group justify="space-between" gap="xs">
                                {day.accommodation?.name && (
                                     <ActionIcon variant="subtle" color="red" size="sm" onClick={handleRemove} title="Remove Accommodation">
                                        <Trash size={14} />
                                     </ActionIcon>
                                )}
                                <Group gap="xs" style={{ flex: 1 }} justify="flex-end">
                                    <Button variant="default" size="xs" onClick={() => setOpened(false)}>Cancel</Button>
                                    <Button size="xs" onClick={handleSave}>Save</Button>
                                </Group>
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                <Tooltip label="Add to Day">
                    <ActionIcon variant="light" size="sm" radius="xl" onClick={(e) => { e.stopPropagation(); onAdd(); }}>
                        <Plus size={14} />
                    </ActionIcon>
                </Tooltip>
            </Stack>
        </Box>
    );
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
};

function RouteConnector({ route, distance, row, col, onEdit }: { route: Route | null, distance: string, row: number, col: number, onEdit: () => void }) {
    const transportLabel = route ? TRANSPORT_LABELS[route.transportType] : null;
    const transportColor = route ? TRANSPORT_COLORS[route.transportType] : '#0d6efd';

    return (
        <Box
            style={{
                gridColumn: `${3 + col} / span 1`,
                gridRow: `${row} / span 1`,
                zIndex: 10,
                pointerEvents: 'none',
                height: 0,
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
            }}
        >
            <Tooltip label="Edit Connection">
                <Paper
                    shadow="sm"
                    withBorder
                    bg={!route ? 'blue.0' : 'white'}
                    style={{
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        padding: '4px 12px',
                        transform: 'translateY(-50%)',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderStyle: route ? 'solid' : 'dashed',
                        borderWidth: 2,
                        position: 'absolute',
                        top: 0,
                        borderColor: !route ? 'var(--mantine-color-blue-3)' : 'var(--mantine-color-gray-3)',
                        borderRadius: 999
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                >
                    <Group gap="xs">
                        {route ? (
                            <>
                                <Text size="xs" fw={700} c={transportColor as any}>{transportLabel}</Text>
                                <Box style={{ width: 1, height: 12, backgroundColor: 'var(--mantine-color-gray-3)' }} />
                                <Text size="xs" c="dimmed" fw={500}>{route.duration || `${distance}km`}</Text>
                            </>
                        ) : (
                            <>
                                <Text size="sm" fw={700} c="blue" lh={1}>+</Text>
                                <Text size="xs" fw={500}>Set travel <Text span size="xs" c="dimmed">({distance}km)</Text></Text>
                            </>
                        )}
                    </Group>
                </Paper>
            </Tooltip>
        </Box>
    );
}

function CurrentTimeLine({ days }: { days: Day[] }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const nowStr = now.toISOString().split('T')[0];
    const dayIndex = days.findIndex(d => d.date === nowStr);

    if (dayIndex === -1) return null;

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    let slotOffset = 0;
    let percentInSlot = 0;

    if (totalMinutes < 480) {
        slotOffset = 0;
        percentInSlot = 0;
    } else if (totalMinutes < 720) {
        slotOffset = 0;
        percentInSlot = (totalMinutes - 480) / 240;
    } else if (totalMinutes < 1080) {
        slotOffset = 1;
        percentInSlot = (totalMinutes - 720) / 360;
    } else {
        slotOffset = 2;
        percentInSlot = (totalMinutes - 1080) / 360;
    }

    const startRow = dayIndex * 3 + 1 + slotOffset;

    return (
        <Box
            style={{
                gridColumn: '2 / -1',
                gridRow: `${startRow} / span 1`,
                top: `${percentInSlot * 100}%`,
                zIndex: 15,
                position: 'absolute',
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: 'var(--mantine-color-red-filled)',
                pointerEvents: 'none'
            }}
        >
            <Box
                style={{
                    position: 'absolute',
                    left: -45,
                    top: -10,
                    backgroundColor: 'var(--mantine-color-red-filled)',
                    color: 'white',
                    fontSize: 10,
                    padding: '2px 4px',
                    borderRadius: 4,
                    fontWeight: 'bold'
                }}
            >
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Box>
            <Box
                style={{
                    position: 'absolute',
                    left: 0,
                    top: -4,
                    width: 10,
                    height: 10,
                    backgroundColor: 'var(--mantine-color-red-filled)',
                    borderRadius: '50%'
                }}
            />
        </Box>
    );
}

export function DaySidebar({
    days,
    locations,
    routes,
    onReorderLocations,
    onRemoveLocation,
    onUpdateLocation,
    onEditRoute,
    onAddToDay,
    onUpdateDay,
    hoveredLocationId,
    onHoverLocation,
    selectedLocationId,
    onSelectLocation,
    zoomLevel,
    dayNumberOffset,
    parentName,
    selectedDayId,
    onSelectDay,
    isSlotBlocked
}: DaySidebarProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [unassignedCollapsed, setUnassignedCollapsed] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const dayRowMap = useMemo(() => {
        const map = new Map<string, number>();
        days.forEach((d, i) => map.set(d.id, i * 3 + 1));
        return map;
    }, [days]);

    const sortedLocs = useMemo(() => {
        return [...locations].sort((a, b) => {
            if (a.startDayId !== b.startDayId) {
                const rowA = dayRowMap.get(a.startDayId || '') || 9999;
                const rowB = dayRowMap.get(b.startDayId || '') || 9999;
                return rowA - rowB;
            }
            const slotA = getSectionIndex(a.startSlot);
            const slotB = getSectionIndex(b.startSlot);
            if (slotA !== slotB) return slotA - slotB;
            return a.order - b.order;
        });
    }, [locations, dayRowMap]);

    const layout = useMemo(() => {
        const itemPositions = new Map<string, { row: number, col: number, span: number }>();
        const lanes: number[][] = [];

        sortedLocs.forEach(loc => {
            if (!loc.startDayId) return;
            const startRowBase = dayRowMap.get(loc.startDayId);
            if (startRowBase === undefined) return;

            const startRow = startRowBase + getSectionIndex(loc.startSlot);
            const span = Math.max(1, loc.duration || 1);
            const endRow = startRow + span;

            let laneIndex = 0;
            while (true) {
                if (!lanes[laneIndex]) lanes[laneIndex] = [];
                const lastEnd = lanes[laneIndex][0] || 0;
                if (lastEnd <= startRow) {
                    lanes[laneIndex][0] = endRow;
                    itemPositions.set(loc.id, { row: startRow, col: laneIndex, span });
                    break;
                }
                laneIndex++;
            }
        });
        return { itemPositions, totalLanes: lanes.length || 1 };
    }, [sortedLocs, dayRowMap]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        if (overId.startsWith('slot-')) {
            const lastHyphenIndex = overId.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
                const slot = overId.substring(lastHyphenIndex + 1) as DaySection;
                const dayId = overId.substring(5, lastHyphenIndex);
                if (dayId && slot) onReorderLocations(activeIdStr, null, dayId, slot);
            }
        } else if (overId === 'unassigned-zone') {
            onReorderLocations(activeIdStr, null, null, null);
        } else {
            const targetLoc = locations.find(l => l.id === overId);
            if (targetLoc) onReorderLocations(activeIdStr, overId, targetLoc.startDayId || null, targetLoc.startSlot || null);
        }
    };

    const activeLocation = activeId ? locations.find(l => l.id === activeId) : null;
    const allLocationIds = locations.map(l => l.id);
    const unassignedLocations = locations.filter(l => !l.startDayId);

    const gridTemplateCols = `80px 40px repeat(${Math.max(1, layout.totalLanes)}, 1fr)`;

    const existingAccommodations = useMemo(() => {
        const names = new Set<string>();
        days.forEach(d => {
            if (d.accommodation?.name) names.add(d.accommodation.name);
        });
        return Array.from(names);
    }, [days]);

    return (
        <Box className="day-sidebar" h="100%" display="flex" style={{ flexDirection: 'column' }}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveId(e.active.id as string)}
                onDragEnd={handleDragEnd}
            >
                <Box ref={scrollContainerRef} bg="white" style={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: gridTemplateCols,
                    gridAutoRows: `minmax(${80 * zoomLevel}px, auto)`,
                    paddingBottom: 100
                }}>
                    <CurrentTimeLine days={days} />
                    {days.map((day, dayIndex) => {
                        const startRow = dayIndex * 3 + 1;
                        const isEvenDay = dayIndex % 2 === 1;
                        return (
                            <React.Fragment key={day.id}>
                                <DayLabel
                                    day={day}
                                    startRow={startRow}
                                    dayNum={dayNumberOffset ? dayNumberOffset + dayIndex : dayIndex + 1}
                                    isEvenDay={isEvenDay}
                                    onAdd={() => onAddToDay(day.id)}
                                    onUpdateDay={onUpdateDay}
                                    existingAccommodations={existingAccommodations}
                                    parentName={parentName}
                                    dayNumberOffset={dayNumberOffset}
                                    isSelected={selectedDayId === day.id}
                                    onSelect={() => onSelectDay?.(selectedDayId === day.id ? null : day.id)}
                                />
                                {SECTION_ORDER.map((section, secIndex) => (
                                    <DroppableCell
                                        key={`slot-${day.id}-${section}`}
                                        id={`slot-${day.id}-${section}`}
                                        section={section}
                                        row={startRow + secIndex}
                                        isEvenDay={isEvenDay}
                                        zoomLevel={zoomLevel}
                                        onClick={() => onAddToDay(day.id, section)}
                                        isBlocked={isSlotBlocked?.(day.id, section)}
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}

                    <SortableContext items={allLocationIds} strategy={verticalListSortingStrategy}>
                        {locations.map(loc => {
                            if (!loc.startDayId) return null;
                            const pos = layout.itemPositions.get(loc.id);
                            if (!pos) return null;

                            const currentIndex = sortedLocs.findIndex(l => l.id === loc.id);
                            const nextLoc = sortedLocs[currentIndex + 1];
                            const nextPos = nextLoc ? layout.itemPositions.get(nextLoc.id) : null;
                            const route = nextLoc ? routes.find(r =>
                                (r.fromLocationId === loc.id && r.toLocationId === nextLoc.id) ||
                                (r.fromLocationId === nextLoc.id && r.toLocationId === loc.id)
                            ) : undefined;

                            const style: React.CSSProperties = {
                                gridColumn: `${3 + pos.col} / span 1`,
                                gridRow: `${pos.row} / span ${pos.span}`,
                                zIndex: 1,
                                height: '100%',
                                marginBottom: 0
                            };

                            return (
                                <React.Fragment key={loc.id}>
                                    <Box
                                        id={`item-${loc.id}`}
                                        style={style}
                                        px={4}
                                        py={16}
                                        onMouseEnter={() => onHoverLocation?.(loc.id)}
                                        onMouseLeave={() => onHoverLocation?.(null)}
                                        onClick={() => onSelectLocation?.(loc.id)}
                                        className={`${hoveredLocationId === loc.id ? 'hovered' : ''} ${selectedLocationId === loc.id ? 'selected' : ''}`}

                                    >
                                        <SortableItem
                                            id={loc.id}
                                            location={loc}
                                            onRemove={onRemoveLocation}
                                            onUpdate={onUpdateLocation}
                                            onSelect={onSelectLocation}
                                            isSelected={selectedLocationId === loc.id}
                                            duration={loc.duration}
                                            zoomLevel={zoomLevel}
                                        />
                                    </Box>
                                    {nextPos && (
                                        <RouteConnector
                                            route={route || null}
                                            distance={calculateDistance(loc.lat, loc.lng, nextLoc.lat, nextLoc.lng)}
                                            row={pos.row + pos.span}
                                            col={pos.col}
                                            onEdit={() => onEditRoute(loc.id, nextLoc.id)}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </SortableContext>
                </Box>

                <Paper p="md" bg="gray.0" withBorder style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                    <Group justify="space-between" mb={unassignedCollapsed ? 0 : "xs"}>
                        <Group
                            gap="xs"
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => setUnassignedCollapsed(!unassignedCollapsed)}
                        >
                            {unassignedCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <Text fw={700}>Unassigned {unassignedCollapsed && unassignedLocations.length > 0 ? `(${unassignedLocations.length})` : ''}</Text>
                        </Group>
                        <Tooltip label="Add to Unassigned">
                            <ActionIcon variant="light" size="sm" radius="xl" onClick={() => onAddToDay('unassigned')}>
                                <Plus size={14} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                    {!unassignedCollapsed && (
                        <UnassignedZone
                            locations={unassignedLocations}
                            onRemove={onRemoveLocation}
                            onUpdate={onUpdateLocation}
                            onSelect={onSelectLocation}
                            selectedLocationId={selectedLocationId}
                        />
                    )}
                </Paper>

                <DragOverlay>
                    {activeLocation ? (
                        <Paper shadow="md" withBorder p="xs" radius="md" style={{ height: 80, cursor: 'grabbing' }}>
                            <Text fw={700}>{activeLocation.name}</Text>
                        </Paper>
                    ) : null}
                </DragOverlay>
            </DndContext>

        </Box>
    );
}
