import React, { useMemo, useState, useRef } from 'react';
import { Button } from 'react-bootstrap';
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

function DroppableCell({ id, section, row, isEvenDay, onClick, children }: { id: string, section: DaySection, row: number, isEvenDay: boolean, onClick?: () => void, children?: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    let icon;
    let label;
    switch (section) {
        case 'morning':
            icon = <Coffee size={14} className="text-warning" />;
            label = "Morning";
            break;
        case 'afternoon':
            icon = <Sun size={14} className="text-orange" />;
            label = "Afternoon";
            break;
        case 'evening':
            icon = <Moon size={14} className="text-indigo" />;
            label = "Evening";
            break;
    }

    const bgClass = isEvenDay ? 'bg-zebra-even' : 'bg-zebra-odd';

    return (
        <div 
            ref={setNodeRef}
            className={`grid-cell ${bgClass} d-flex align-items-center ${isOver ? 'drag-over' : ''}`}
            onClick={onClick}
            style={{ 
                gridColumn: '2 / -1',
                gridRow: `${row} / span 1`,
                borderBottom: '1px solid #e9ecef',
                minHeight: '80px',
                zIndex: 0,
                cursor: 'pointer'
            }}
        >
            <div className="d-flex align-items-center justify-content-center p-2 text-muted small border-end" style={{ width: '80px', minWidth: '80px', height: '100%', pointerEvents: 'none' }}>
                 <div className="d-flex flex-column align-items-center">
                    {icon}
                    <span style={{ fontSize: '0.7rem' }}>{label}</span>
                 </div>
            </div>
            {children}
        </div>
    );
}

function DayLabel({ day, startRow, dayNum, isEvenDay, onAdd }: { day: Day, startRow: number, dayNum: number, isEvenDay: boolean, onAdd: () => void }) {
    return (
        <div 
            className={`day-label border-end border-bottom d-flex flex-column align-items-center justify-content-center text-center p-2 ${isEvenDay ? 'bg-zebra-even' : 'bg-zebra-odd'}`}
            style={{
                gridColumn: '1 / span 1',
                gridRow: `${startRow} / span 3`,
                zIndex: 2,
                borderTop: '1px solid #dee2e6'
            }}
        >
            <div className="fw-bold small">Day {dayNum}</div>
            <div className="text-muted small mb-2" style={{ fontSize: '0.7rem' }}>{formatDate(day.date)}</div>
            <Button
                variant="outline-secondary"
                size="sm"
                className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '24px', height: '24px' }}
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                title="Add to Day"
            >
                <Plus size={14} />
            </Button>
        </div>
    );
}

// Helper to calculate distance in KM between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
};

function RouteConnector({ route, distance, row, col, onEdit }: { route: Route | null, distance: string, row: number, col: number, onEdit: () => void }) {
    const transportLabel = route ? TRANSPORT_LABELS[route.transportType] : '🔗';
    const transportColor = route ? TRANSPORT_COLORS[route.transportType] : '#adb5bd';

    return (
        <div 
            className="route-connector-grid d-flex align-items-center justify-content-center"
            style={{
                gridColumn: `${3 + col} / span 1`,
                gridRow: `${row} / span 1`,
                zIndex: 10,
                pointerEvents: 'none',
                height: '0'
            }}
        >
            <div 
                className="route-badge shadow border bg-white rounded-pill px-2 d-flex align-items-center gap-1"
                style={{ 
                    cursor: 'pointer', 
                    pointerEvents: 'auto',
                    fontSize: '0.65rem',
                    transform: 'translateY(-50%)',
                    whiteSpace: 'nowrap'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                }}
            >
                <span style={{ color: transportColor, fontWeight: 'bold' }}>{transportLabel}</span>
                <span className="text-muted">{route?.duration || `${distance}km`}</span>
            </div>
        </div>
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
    onHoverLocation
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

    const gridTemplateCols = `80px 80px repeat(${Math.max(1, layout.totalLanes)}, 1fr)`; 
    
    return (
        <div className="day-sidebar h-100 d-flex flex-column">
             <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(e) => setActiveId(e.active.id as string)}
                onDragEnd={handleDragEnd}
            >
                <div ref={scrollContainerRef} className="flex-grow-1 overflow-auto bg-white position-relative" style={{ 
                    display: 'grid',
                    gridTemplateColumns: gridTemplateCols,
                    gridAutoRows: 'minmax(80px, auto)',
                    paddingBottom: '100px' 
                }}>
                    {days.map((day, dayIndex) => {
                        const startRow = dayIndex * 3 + 1;
                        const isEvenDay = dayIndex % 2 === 1;
                        return (
                            <React.Fragment key={day.id}>
                                <DayLabel day={day} startRow={startRow} dayNum={dayIndex + 1} isEvenDay={isEvenDay} onAdd={() => onAddToDay(day.id)} />
                                {SECTION_ORDER.map((section, secIndex) => (
                                    <DroppableCell 
                                        key={`slot-${day.id}-${section}`}
                                        id={`slot-${day.id}-${section}`}
                                        section={section}
                                        row={startRow + secIndex}
                                        isEvenDay={isEvenDay}
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
                                        <div 
                                            style={style} 
                                            className={`p-1 item-hover-wrapper ${hoveredLocationId === loc.id ? 'hovered' : ''}`}
                                            onMouseEnter={() => onHoverLocation?.(loc.id)}
                                            onMouseLeave={() => onHoverLocation?.(null)}
                                        >
                                            <SortableItem
                                                id={loc.id}
                                                location={loc}
                                                onRemove={onRemoveLocation}
                                                onUpdate={onUpdateLocation}
                                                duration={loc.duration}
                                            />
                                        </div>
                                        {route && nextPos && (
                                            <RouteConnector 
                                                route={route} 
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
                </div>

                <div className="p-3 border-top bg-light" style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                    <strong>Unassigned</strong>
                    <DroppableCell id="unassigned-zone" section="morning" row={9999} isEvenDay={false}>
                         <div className="d-flex flex-wrap gap-2 w-100 ps-2">
                             {unassignedLocations.map(loc => (
                                 <div key={loc.id} style={{ width: '100%' }}>
                                     <SortableItem
                                         id={loc.id}
                                         location={loc}
                                         onRemove={onRemoveLocation}
                                         onUpdate={onUpdateLocation}
                                         duration={loc.duration}
                                     />
                                 </div>
                             ))}
                             {unassignedLocations.length === 0 && <div className="text-muted small">No unassigned places</div>}
                         </div>
                    </DroppableCell>
                </div>

                <DragOverlay>
                    {activeLocation ? (
                        <div className="sortable-item dragging-overlay bg-white border shadow p-2 rounded" style={{ height: '80px' }}>
                             <div className="fw-bold">{activeLocation.name}</div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}