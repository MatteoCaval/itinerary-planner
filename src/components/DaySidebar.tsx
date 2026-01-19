import React, { useMemo, useState } from 'react';
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
    DragStartEvent,
    DragOverlay,
    useDroppable
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Day, Location, Route, DaySection } from '../types';
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
}

// Helper to map section to index
const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => {
    if (!section) return 0;
    return SECTION_ORDER.indexOf(section);
};

// Format date for display
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

// Droppable Cell Component
function DroppableCell({ id, section, row, isFirstInDay, children }: { id: string, section: DaySection, row: number, isFirstInDay: boolean, children?: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    let icon;
    let label;
    let bgClass = '';

    switch (section) {
        case 'morning':
            icon = <Coffee size={14} className="text-warning" />;
            label = "Morning";
            bgClass = 'bg-light-yellow';
            break;
        case 'afternoon':
            icon = <Sun size={14} className="text-orange" />;
            label = "Afternoon";
            bgClass = 'bg-light-orange';
            break;
        case 'evening':
            icon = <Moon size={14} className="text-indigo" />;
            label = "Evening";
            bgClass = 'bg-light-indigo';
            break;
    }

    const borderClass = isFirstInDay ? 'border-top' : '';

    return (
        <div 
            ref={setNodeRef}
            className={`grid-cell ${bgClass} ${borderClass} d-flex align-items-center ${isOver ? 'drag-over' : ''}`}
            style={{ 
                gridColumn: '2 / -1', // Start after DayLabel
                gridRow: `${row} / span 1`,
                borderBottom: '1px solid #e9ecef',
                minHeight: '80px',
                zIndex: 0
            }}
        >
            <div className="d-flex align-items-center justify-content-center p-2 text-muted small border-end" style={{ width: '80px', minWidth: '80px', height: '100%' }}>
                 <div className="d-flex flex-column align-items-center">
                    {icon}
                    <span style={{ fontSize: '0.7rem' }}>{label}</span>
                 </div>
            </div>
            {/* Content area is implicit in the rest of the cell width */}
            {children}
        </div>
    );
}

// Day Label Component (Left Sidebar for the Day group)
function DayLabel({ day, startRow, dayNum, onAdd }: { day: Day, startRow: number, dayNum: number, onAdd: () => void }) {
    return (
        <div 
            className="day-label bg-light border-end border-top border-bottom d-flex flex-column align-items-center justify-content-center text-center p-2"
            style={{
                gridColumn: '1 / span 1', // Sidebar column
                gridRow: `${startRow} / span 3`, // Spans 3 slots
                zIndex: 2,
                marginRight: '1px' // separation
            }}
        >
            <div className="fw-bold small">Day {dayNum}</div>
            <div className="text-muted small mb-2" style={{ fontSize: '0.7rem' }}>{formatDate(day.date)}</div>
            <Button
                variant="outline-secondary"
                size="sm"
                className="p-1 rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: '24px', height: '24px' }}
                onClick={onAdd}
                title="Add to Day"
            >
                <Plus size={14} />
            </Button>
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
    onAddToDay
}: DaySidebarProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Layout Engine: Calculate grid positions
    const layout = useMemo(() => {
        const itemPositions = new Map<string, { row: number, col: number, span: number }>();
        const lanes: number[][] = []; // lanes[col_index] = [last_occupied_row]

        // 1. Map days/slots to rows
        const dayRowMap = new Map<string, number>();
        days.forEach((d, i) => dayRowMap.set(d.id, i * 3 + 1)); // 1-based index

        // 2. Sort locations by start time
        const sortedLocs = [...locations].sort((a, b) => {
            if (a.startDayId !== b.startDayId) {
                // Ensure days exist
                const rowA = dayRowMap.get(a.startDayId || '') || 9999;
                const rowB = dayRowMap.get(b.startDayId || '') || 9999;
                return rowA - rowB;
            }
            // Same day, compare slots
            const slotA = getSectionIndex(a.startSlot);
            const slotB = getSectionIndex(b.startSlot);
            return slotA - slotB;
        });

        // 3. Assign lanes
        sortedLocs.forEach(loc => {
            if (!loc.startDayId) return; // Skip unassigned
            
            const startRowBase = dayRowMap.get(loc.startDayId);
            if (startRowBase === undefined) return;

            const startRow = startRowBase + getSectionIndex(loc.startSlot);
            const span = Math.max(1, loc.duration || 1);
            const endRow = startRow + span;

            // Find first available lane
            let laneIndex = 0;
            while (true) {
                if (!lanes[laneIndex]) lanes[laneIndex] = [];
                const lastEnd = lanes[laneIndex][0] || 0; 
                
                if (lastEnd <= startRow) {
                    // Fits!
                    lanes[laneIndex][0] = endRow;
                    itemPositions.set(loc.id, { row: startRow, col: laneIndex, span });
                    break;
                }
                laneIndex++;
            }
        });

        return { itemPositions, totalLanes: lanes.length || 1 };
    }, [days, locations]);

    const findLocation = (id: string) => locations.find(l => l.id === id);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        // Parse overId (Cell ID: slot-{dayId}-{section})
        if (overId.startsWith('slot-')) {
            const lastHyphenIndex = overId.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
                const slot = overId.substring(lastHyphenIndex + 1) as DaySection;
                const dayId = overId.substring(5, lastHyphenIndex);
                if (dayId && slot) {
                    onReorderLocations(activeIdStr, null, dayId, slot);
                }
            }
        } else if (overId === 'unassigned-zone') {
            onReorderLocations(activeIdStr, null, null, null);
        } else {
            // Dropped on another item? dnd-kit might return the item ID
            const targetLoc = findLocation(overId);
            if (targetLoc) {
                onReorderLocations(activeIdStr, overId, targetLoc.startDayId || null, targetLoc.startSlot || null);
            }
        }
    };

    const activeLocation = activeId ? locations.find(l => l.id === activeId) : null;
    const allLocationIds = locations.map(l => l.id);
    const unassignedLocations = locations.filter(l => !l.startDayId);

    // CSS Grid Template
    const gridTemplateCols = `80px 80px repeat(${Math.max(1, layout.totalLanes)}, 1fr)`; 
    
    return (
        <div className="day-sidebar h-100 d-flex flex-column">
             <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-grow-1 overflow-auto bg-white position-relative" style={{ 
                    display: 'grid',
                    gridTemplateColumns: gridTemplateCols,
                    gridAutoRows: 'minmax(80px, auto)',
                    paddingBottom: '100px' // Space for unassigned
                }}>
                    {/* Render Grid Structure */}
                    {days.map((day, dayIndex) => {
                        const startRow = dayIndex * 3 + 1;
                        const dayNum = dayIndex + 1; // Assuming sorted days

                        return (
                            <React.Fragment key={day.id}>
                                {/* Day Sidebar */}
                                <DayLabel day={day} startRow={startRow} dayNum={dayNum} onAdd={() => onAddToDay(day.id)} />

                                {/* Slots (Background Layer) */}
                                {SECTION_ORDER.map((section, secIndex) => (
                                    <DroppableCell 
                                        key={`slot-${day.id}-${section}`}
                                        id={`slot-${day.id}-${section}`}
                                        section={section}
                                        row={startRow + secIndex}
                                        isFirstInDay={secIndex === 0}
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}

                    {/* Render Items (Overlay Layer) */}
                    <SortableContext items={allLocationIds} strategy={verticalListSortingStrategy}>
                        {(() => {
                            // Compute sorted list for route linkage
                            const dayRowMap = new Map<string, number>();
                            days.forEach((d, i) => dayRowMap.set(d.id, i * 3 + 1));

                            const sortedLocs = [...locations].sort((a, b) => {
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

                            return locations.map(loc => {
                                if (!loc.startDayId) return null; // Unassigned handled separately
                                const pos = layout.itemPositions.get(loc.id);
                                if (!pos) return null;

                                // Find route to next location
                                const currentIndex = sortedLocs.findIndex(l => l.id === loc.id);
                                const nextLoc = sortedLocs[currentIndex + 1];
                                const route = nextLoc ? routes.find(r => 
                                    (r.fromLocationId === loc.id && r.toLocationId === nextLoc.id) ||
                                    (r.fromLocationId === nextLoc.id && r.toLocationId === loc.id)
                                ) : undefined;

                                // Grid positioning
                                const style: React.CSSProperties = {
                                    gridColumn: `${3 + pos.col} / span 1`, // 1=DayLabel, 2=SlotLabel (in cell), 3=Start of lanes
                                    gridRow: `${pos.row} / span ${pos.span}`,
                                    zIndex: 1,
                                    height: '100%',
                                    marginBottom: 0 // Flush
                                };

                                return (
                                    <div key={loc.id} style={style} className="p-1">
                                        <SortableItem
                                            id={loc.id}
                                            location={loc}
                                            onRemove={onRemoveLocation}
                                            onUpdate={onUpdateLocation}
                                            duration={loc.duration}
                                            route={route}
                                            onEditRoute={() => onEditRoute(loc.id, nextLoc?.id || "")}
                                        />
                                    </div>
                                );
                            });
                        })()}
                    </SortableContext>
                </div>

                {/* Unassigned Zone (Fixed at bottom) */}
                <div className="p-3 border-top bg-light" style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                    <strong>Unassigned</strong>
                    <DroppableCell id="unassigned-zone" section="morning" row={9999} isFirstInDay={false}>
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