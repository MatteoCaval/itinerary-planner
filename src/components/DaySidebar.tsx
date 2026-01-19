import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { Calendar, MapPin, Plus, Clock, Euro, Sun, Moon, Coffee } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    useDroppable,
    DragStartEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Day, Location, Route, TRANSPORT_LABELS, TRANSPORT_COLORS, DaySection } from '../types';
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

// Format date for display
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

// Get day number from start
const getDayNumber = (dateStr: string, startDate: string) => {
    const date = new Date(dateStr);
    const start = new Date(startDate);
    const diffTime = date.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
};

// Droppable slot container
interface DroppableSlotProps {
    id: string;
    daySection?: DaySection;
    label?: string;
    icon?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

function DroppableSlot({ id, daySection, label, icon, className = '', children }: DroppableSlotProps) {
    const { isOver, setNodeRef } = useDroppable({ id });

    let displayIcon = icon;
    let displayLabel = label;
    let bgClass = '';

    if (daySection) {
        switch (daySection) {
            case 'morning':
                if (!displayIcon) displayIcon = <Coffee size={14} className="text-warning" />;
                if (!displayLabel) displayLabel = "Morning";
                bgClass = 'bg-light-yellow';
                break;
            case 'afternoon':
                if (!displayIcon) displayIcon = <Sun size={14} className="text-orange" />;
                if (!displayLabel) displayLabel = "Afternoon";
                bgClass = 'bg-light-orange';
                break;
            case 'evening':
                if (!displayIcon) displayIcon = <Moon size={14} className="text-indigo" />;
                if (!displayLabel) displayLabel = "Evening";
                bgClass = 'bg-light-indigo';
                break;
        }
    }

    return (
        <div className={`timeline-slot d-flex ${bgClass} ${className}`}>
            <div className="slot-label d-flex flex-column align-items-center justify-content-center border-end p-2 text-muted small" style={{ width: '80px', minWidth: '80px' }}>
                {displayIcon}
                <span style={{ fontSize: '0.7rem' }}>{displayLabel}</span>
            </div>
            <div
                ref={setNodeRef}
                className={`slot-content flex-grow-1 p-2 ${isOver ? 'drag-over' : ''}`}
                style={{ minHeight: '60px' }}
            >
                {children}
            </div>
        </div>
    );
}

// Route info display between locations
interface RouteInfoProps {
    route?: Route;
    onEdit: () => void;
}

function RouteInfo({ route, onEdit }: RouteInfoProps) {
    const transportLabel = route ? TRANSPORT_LABELS[route.transportType] : null;
    const transportColor = route ? TRANSPORT_COLORS[route.transportType] : '#6b7280';

    return (
        <div
            className="route-info-bar d-flex align-items-center justify-content-center py-1 px-2 my-1"
            onClick={onEdit}
            style={{ cursor: 'pointer' }}
        >
            <div className="route-info-content d-flex align-items-center gap-2 small">
                {route ? (
                    <>
                        <span
                            className="route-transport-badge"
                            style={{ color: transportColor }}
                        >
                            {transportLabel}
                        </span>
                        {route.duration && (
                            <span className="route-duration text-muted d-flex align-items-center gap-1">
                                <Clock size={12} />
                                {route.duration}
                            </span>
                        )}
                        {route.cost && (
                            <span className="route-cost text-muted d-flex align-items-center gap-1">
                                <Euro size={12} />
                                {route.cost}
                            </span>
                        )}
                        {!route.duration && !route.cost && (
                            <span className="text-muted opacity-75">Click to add details</span>
                        )}
                    </>
                ) : (
                    <span className="text-muted opacity-50">+ Add route info</span>
                )}
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

    // Get locations for a specific day and slot
    const getLocationsForSlot = (dayId: string, slot: DaySection) => {
        return locations
            .filter(loc => loc.startDayId === dayId && loc.startSlot === slot)
            .sort((a, b) => a.order - b.order);
    };

    // Get unassigned locations
    const getUnassignedLocations = () => {
        return locations.filter(loc => !loc.startDayId);
    };

    // Find location info
    const findLocation = (id: string) => locations.find(l => l.id === id);

    // Get route between two locations
    const getRoute = (fromId: string, toId: string): Route | undefined => {
        return routes.find(r =>
            (r.fromLocationId === fromId && r.toLocationId === toId) ||
            (r.fromLocationId === toId && r.toLocationId === fromId)
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        // Parse overId to see if it's a slot
        if (overId.startsWith('slot-')) {
            // Format is slot-{UUID}-{Section}
            // Section is always the last part (morning, afternoon, evening)
            const lastHyphenIndex = overId.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
                const slot = overId.substring(lastHyphenIndex + 1) as DaySection;
                // dayId is between "slot-" (length 5) and the last hyphen
                const dayId = overId.substring(5, lastHyphenIndex);
                
                if (dayId && slot) {
                    onReorderLocations(activeIdStr, null, dayId, slot);
                }
            }
        } else if (overId === 'unassigned-zone') {
            onReorderLocations(activeIdStr, null, null, null);
        } else {
            // Dropped on another location
            // Find that location's day and slot
            const targetLoc = findLocation(overId);
            if (targetLoc) {
                onReorderLocations(activeIdStr, overId, targetLoc.startDayId || null, targetLoc.startSlot || null);
            }
        }
    };

    const startDate = days.length > 0 ? days[0].date : '';
    const unassignedLocations = getUnassignedLocations();
    const activeLocation = activeId ? locations.find(l => l.id === activeId) : null;
    const allLocationIds = locations.map(l => l.id);

    return (
        <div className="day-sidebar">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={allLocationIds}
                    strategy={verticalListSortingStrategy}
                >
                    {days.length === 0 ? (
                        <div className="text-center text-muted py-4">
                            <Calendar size={32} className="mb-2 opacity-50" />
                            <p className="mb-0">Select dates above to start planning</p>
                        </div>
                    ) : (
                        <>
                            {days.map((day) => {
                                const dayNum = getDayNumber(day.date, startDate);
                                const sections: DaySection[] = ['morning', 'afternoon', 'evening'];

                                return (
                                    <div key={day.id} className="day-section mb-3 border rounded overflow-hidden">
                                        <div className="day-header bg-secondary text-white p-2 d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>Day {dayNum}</strong>
                                                <span className="ms-2 small opacity-75">{formatDate(day.date)}</span>
                                            </div>
                                            <Button
                                                variant="link"
                                                className="text-white p-0"
                                                size="sm"
                                                onClick={() => onAddToDay(day.id)}
                                                title="Add to Day"
                                            >
                                                <Plus size={16} />
                                            </Button>
                                        </div>

                                        <div className="day-slots">
                                            {sections.map(section => {
                                                const slotId = `slot-${day.id}-${section}`;
                                                const slotLocations = getLocationsForSlot(day.id, section);

                                                return (
                                                    <DroppableSlot key={slotId} id={slotId} daySection={section}>
                                                        {slotLocations.map((location, locIndex) => {
                                                            // Logic to show route connection if next location exists IN THIS SLOT
                                                            // Cross-slot routes are harder to visualize in this list view without connecting lines
                                                            const nextLoc = slotLocations[locIndex + 1];
                                                            const route = nextLoc ? getRoute(location.id, nextLoc.id) : undefined;

                                                            return (
                                                                <div key={location.id} className="mb-2">
                                                                    <SortableItem
                                                                        id={location.id}
                                                                        location={location}
                                                                        index={undefined} // Don't show index in slot view to avoid confusion
                                                                        onRemove={onRemoveLocation}
                                                                        onUpdate={onUpdateLocation}
                                                                        duration={location.duration}
                                                                    />
                                                                    {locIndex < slotLocations.length - 1 && (
                                                                        <RouteInfo
                                                                            route={route}
                                                                            onEdit={() => onEditRoute(location.id, nextLoc.id)}
                                                                        />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {slotLocations.length === 0 && (
                                                            <div className="text-muted small opacity-25 text-center p-1" style={{ fontSize: '0.7em' }}>
                                                                Drop item here
                                                            </div>
                                                        )}
                                                    </DroppableSlot>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="p-2 border-top mt-3">
                                <div className="text-muted small mb-2">
                                    <strong>Unassigned Places</strong>
                                </div>
                                <DroppableSlot 
                                    id="unassigned-zone" 
                                    label="Pending" 
                                    icon={<MapPin size={14} />}
                                    className="bg-light"
                                > 
                                     {unassignedLocations.length === 0 ? (
                                         <div className="text-muted small text-center">No unassigned places</div>
                                     ) : (
                                         unassignedLocations.map((location) => (
                                             <SortableItem
                                                 key={location.id}
                                                 id={location.id}
                                                 location={location}
                                                 onRemove={onRemoveLocation}
                                                 onUpdate={onUpdateLocation}
                                                 duration={location.duration}
                                             />
                                         ))
                                     )}
                                </DroppableSlot>
                            </div>
                        </>
                    )}
                </SortableContext>

                <DragOverlay>
                    {activeLocation ? (
                        <div className="sortable-item dragging-overlay bg-white border shadow p-2 rounded">
                            <div className="d-flex align-items-center w-100">
                                <div className="flex-grow-1">
                                    <div className="fw-bold text-truncate">{activeLocation.name}</div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}