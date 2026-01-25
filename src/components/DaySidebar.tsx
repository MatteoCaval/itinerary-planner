import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ActionIcon, Text, Group, Stack, Box, Paper, Tooltip } from '@mantine/core';
import { Plus, Sun, Moon, Coffee } from 'lucide-react';
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

interface DaySidebarProps {
    days: Day[];
    locations: Location[];
    routes: Route[];
    onReorderLocations: (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => void;
    onRemoveLocation: (id: string) => void;
    onUpdateLocation: (id: string, updates: Partial<Location>) => void;
    onEditRoute: (fromId: string, toId: string) => void;
    onAddToDay: (dayId: string, slot?: DaySection) => void;
    hoveredLocationId?: string | null;
    onHoverLocation?: (id: string | null) => void;
    selectedLocationId?: string | null;
    onSelectLocation?: (id: string | null) => void;
    zoomLevel: number;
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

function DroppableCell({ id, section, row, isEvenDay, zoomLevel, onClick, children }: { id: string, section: DaySection, row: number, isEvenDay: boolean, zoomLevel: number, onClick?: () => void, children?: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id });

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

    const bgClass = isEvenDay ? 'var(--mantine-color-gray-0)' : 'white';

    return (
        <Box
            ref={setNodeRef}
            onClick={onClick}
            style={{
                gridColumn: '2 / -1',
                gridRow: `${row} / span 1`,
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                minHeight: `${80 * zoomLevel}px`,
                zIndex: 0,
                cursor: 'pointer',
                backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : bgClass,
                display: 'flex',
                alignItems: 'center',
                transition: 'background-color 0.2s ease'
            }}
        >
            <Box style={{ width: 40, minWidth: 40, height: '100%', pointerEvents: 'none', borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stack gap={2} align="center" c={color}>
                    {icon}
                </Stack>
            </Box>
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

function DayLabel({ day, startRow, dayNum, isEvenDay, onAdd }: { day: Day, startRow: number, dayNum: number, isEvenDay: boolean, onAdd: () => void }) {
    return (
        <Box
            p="xs"
            style={{
                gridColumn: '1 / span 1',
                gridRow: `${startRow} / span 3`,
                zIndex: 2,
                borderTop: '1px solid var(--mantine-color-gray-3)',
                borderRight: '1px solid var(--mantine-color-gray-3)',
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                backgroundColor: isEvenDay ? 'var(--mantine-color-gray-0)' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
            }}
        >
            <Stack gap={4} align="center">
                <Text size="sm" fw={700}>Day {dayNum}</Text>
                <Text size="xs" c="dimmed">{formatDate(day.date)}</Text>
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
    hoveredLocationId,
    onHoverLocation,
    selectedLocationId,
    onSelectLocation,
    zoomLevel
}: DaySidebarProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
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
                                    dayNum={dayIndex + 1}
                                    isEvenDay={isEvenDay}
                                    onAdd={() => onAddToDay(day.id)}
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
                    <Group justify="space-between" mb="xs">
                        <Text fw={700}>Unassigned</Text>
                        <Tooltip label="Add to Unassigned">
                            <ActionIcon variant="light" size="sm" radius="xl" onClick={() => onAddToDay('unassigned')}>
                                <Plus size={14} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                    <UnassignedZone
                        locations={unassignedLocations}
                        onRemove={onRemoveLocation}
                        onUpdate={onUpdateLocation}
                        onSelect={onSelectLocation}
                        selectedLocationId={selectedLocationId}
                    />
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
