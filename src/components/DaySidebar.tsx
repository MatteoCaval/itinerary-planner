import React, { useState } from 'react';
import { Badge, Button } from 'react-bootstrap';
import { Calendar, MapPin, Plus, Clock, Euro } from 'lucide-react';
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
import { Day, Location, Route, TRANSPORT_LABELS, TRANSPORT_COLORS } from '../types';
import { SortableItem } from './SortableItem';

interface DaySidebarProps {
    days: Day[];
    locations: Location[];
    routes: Route[];
    onReorderLocations: (activeId: string, overId: string | null, newDayId: string | null) => void;
    onRemoveLocation: (id: string) => void;
    onUpdateLocation: (id: string, updates: Partial<Location>) => void;
    onEditRoute: (fromId: string, toId: string) => void;
    onAddToDay: (dayId: string) => void;
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

// Droppable day container
function DroppableDay({ id, children }: { id: string; children: React.ReactNode }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`day-drop-zone ${isOver ? 'drag-over' : ''}`}
        >
            {children}
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

    // Get locations for a specific day, sorted by order
    const getLocationsForDay = (dayId: string) => {
        return locations
            .filter(loc => loc.dayIds.includes(dayId))
            .sort((a, b) => a.order - b.order);
    };

    // Get unassigned locations
    const getUnassignedLocations = () => {
        return locations.filter(loc => loc.dayIds.length === 0);
    };

    // Find which day a location belongs to
    const findDayForLocation = (locationId: string): string | null => {
        const location = locations.find(l => l.id === locationId);
        if (location && location.dayIds.length > 0) {
            return location.dayIds[0];
        }
        return null;
    };

    // Get route between two locations
    const getRoute = (fromId: string, toId: string): Route | undefined => {
        return routes.find(r =>
            (r.fromLocationId === fromId && r.toLocationId === toId) ||
            (r.fromLocationId === toId && r.toLocationId === fromId)
        );
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        // Check if dropping on a day header
        const isOverDay = days.some(d => d.id === overId);

        if (isOverDay) {
            onReorderLocations(activeIdStr, null, overId);
        } else if (overId === 'unassigned-zone') {
            onReorderLocations(activeIdStr, null, null);
        } else {
            const targetDay = findDayForLocation(overId);
            onReorderLocations(activeIdStr, overId, targetDay);
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
                                const dayLocations = getLocationsForDay(day.id);
                                const dayNum = getDayNumber(day.date, startDate);

                                return (
                                    <DroppableDay key={day.id} id={day.id}>
                                        <div className="day-section mb-3">
                                            <div className="day-header d-flex align-items-center p-2 rounded-top">
                                                <div className="flex-grow-1">
                                                    <strong>Day {dayNum}</strong>
                                                    <span className="text-muted ms-2 small">{formatDate(day.date)}</span>
                                                </div>
                                                <Badge bg="secondary" pill className="me-2">{dayLocations.length}</Badge>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="py-0 px-1"
                                                    onClick={() => onAddToDay(day.id)}
                                                    title="Add place to this day"
                                                >
                                                    <Plus size={14} />
                                                </Button>
                                            </div>

                                            <div className="day-locations p-2">
                                                {dayLocations.length === 0 ? (
                                                    <div className="text-muted small py-2 text-center drop-placeholder">
                                                        <MapPin size={14} className="me-1" />
                                                        Drop places here or click +
                                                    </div>
                                                ) : (
                                                    dayLocations.map((location, locIndex) => {
                                                        const nextLoc = dayLocations[locIndex + 1];
                                                        const route = nextLoc ? getRoute(location.id, nextLoc.id) : undefined;

                                                        return (
                                                            <div key={location.id}>
                                                                <SortableItem
                                                                    id={location.id}
                                                                    location={location}
                                                                    index={locIndex + 1}
                                                                    onRemove={onRemoveLocation}
                                                                    onUpdate={onUpdateLocation}
                                                                    dayCount={location.dayIds.length}
                                                                />
                                                                {locIndex < dayLocations.length - 1 && (
                                                                    <RouteInfo
                                                                        route={route}
                                                                        onEdit={() => onEditRoute(location.id, nextLoc.id)}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </DroppableDay>
                                );
                            })}

                            {unassignedLocations.length > 0 && (
                                <DroppableDay id="unassigned-zone">
                                    <div className="unassigned-section mt-3">
                                        <div className="text-muted small mb-2">
                                            <strong>Unassigned ({unassignedLocations.length})</strong>
                                        </div>
                                        {unassignedLocations.map((location, idx) => (
                                            <SortableItem
                                                key={location.id}
                                                id={location.id}
                                                location={location}
                                                index={idx + 1}
                                                onRemove={onRemoveLocation}
                                                onUpdate={onUpdateLocation}
                                                dayCount={0}
                                            />
                                        ))}
                                    </div>
                                </DroppableDay>
                            )}
                        </>
                    )}
                </SortableContext>

                <DragOverlay>
                    {activeLocation ? (
                        <div className="sortable-item dragging-overlay">
                            <div className="d-flex align-items-center w-100">
                                <div className="drag-handle">
                                    <span>⋮⋮</span>
                                </div>
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
