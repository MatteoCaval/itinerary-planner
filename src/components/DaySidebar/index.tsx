import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ActionIcon, Text, Group, Box, Paper, Tooltip, Collapse } from '@mantine/core';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Day, Location, Route, DaySection } from '../../types';
import { SortableItem } from '../SortableItem';
import {
  SECTION_ORDER,
  getSectionIndex,
  UNASSIGNED_ZONE_ID,
  SLOT_PREFIX,
} from '../../constants/daySection';
import { DroppableCell } from './DroppableCell';
import { UnassignedZone } from './UnassignedZone';
import { DayLabel } from './DayLabel';
import { RouteConnector } from './RouteConnector';
import { CurrentTimeLine } from './CurrentTimeLine';

interface DaySidebarProps {
  days: Day[];
  locations: Location[];
  routes: Route[];
  onReorderLocations: (
    activeId: string,
    overId: string | null,
    newDayId: string | null,
    newSlot: DaySection | null,
  ) => void;
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
  onNestLocation?: (activeId: string, parentId: string) => void;
  onOpenSubItinerary?: (id: string) => void;
}

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
};

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
  isSlotBlocked,
  onNestLocation,
  onOpenSubItinerary,
}: DaySidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unassignedCollapsed, setUnassignedCollapsed] = useState(
    () => locations.filter((l) => !l.startDayId).length === 0,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMacPlatform = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform),
    [],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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
    const itemPositions = new Map<
      string,
      { row: number; col: number; span: number }
    >();
    const lanes: number[][] = [];

    sortedLocs.forEach((loc) => {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedLocationId) return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      const eventTarget = event.target as HTMLElement | null;
      if (eventTarget) {
        const tag = eventTarget.tagName.toLowerCase();
        const isTypingContext =
          eventTarget.isContentEditable ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select';
        if (isTypingContext) return;
      }

      const usesMacShortcut = isMacPlatform && event.metaKey && event.shiftKey;
      const usesDefaultShortcut =
        !isMacPlatform && event.altKey && event.shiftKey;
      if (!usesMacShortcut && !usesDefaultShortcut) return;

      const currentIndex = sortedLocs.findIndex(
        (location) => location.id === selectedLocationId,
      );
      if (currentIndex === -1) return;
      const targetIndex =
        event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sortedLocs.length) return;

      event.preventDefault();
      const current = sortedLocs[currentIndex];
      const targetLocation = sortedLocs[targetIndex];
      onReorderLocations(
        current.id,
        targetLocation.id,
        current.startDayId || null,
        current.startSlot || null,
      );
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedLocationId, sortedLocs, onReorderLocations, isMacPlatform]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = active.id as string;
    const overId = over.id as string;

    if (
      !parentName &&
      locations.some((l) => l.id === overId) &&
      activeIdStr !== overId
    ) {
      onNestLocation?.(activeIdStr, overId);
      return;
    }

    if (overId.startsWith(SLOT_PREFIX)) {
      const lastHyphenIndex = overId.lastIndexOf('-');
      if (lastHyphenIndex !== -1) {
        const slot = overId.substring(lastHyphenIndex + 1) as DaySection;
        const dayId = overId.substring(SLOT_PREFIX.length, lastHyphenIndex);
        if (dayId && slot) onReorderLocations(activeIdStr, null, dayId, slot);
      }
    } else if (overId === UNASSIGNED_ZONE_ID) {
      onReorderLocations(activeIdStr, null, null, null);
    } else {
      const targetLoc = locations.find((l) => l.id === overId);
      if (targetLoc)
        onReorderLocations(
          activeIdStr,
          overId,
          targetLoc.startDayId || null,
          targetLoc.startSlot || null,
        );
    }
  };

  const activeLocation = activeId
    ? locations.find((l) => l.id === activeId)
    : null;
  const allLocationIds = locations.map((l) => l.id);
  const unassignedLocations = locations.filter((l) => !l.startDayId);

  const gridTemplateCols = `80px 40px repeat(${Math.max(1, layout.totalLanes)}, 1fr)`;

  const existingAccommodations = useMemo(() => {
    const names = new Set<string>();
    days.forEach((d) => {
      if (d.accommodation?.name) names.add(d.accommodation.name);
    });
    return Array.from(names);
  }, [days]);

  return (
    <Box
      className="day-sidebar"
      h="100%"
      display="flex"
      style={{ flexDirection: 'column' }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <Box
          ref={scrollContainerRef}
          bg="white"
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: gridTemplateCols,
            gridAutoRows: `minmax(${80 * zoomLevel}px, auto)`,
            paddingBottom: 100,
          }}
        >
          <CurrentTimeLine days={days} />
          {days.map((day, dayIndex) => {
            const startRow = dayIndex * 3 + 1;
            const isEvenDay = dayIndex % 2 === 1;
            return (
              <React.Fragment key={day.id}>
                <DayLabel
                  day={day}
                  startRow={startRow}
                  dayNum={
                    dayNumberOffset
                      ? dayNumberOffset + dayIndex
                      : dayIndex + 1
                  }
                  isEvenDay={isEvenDay}
                  onAdd={() => onAddToDay(day.id)}
                  onUpdateDay={onUpdateDay}
                  existingAccommodations={existingAccommodations}
                  parentName={parentName}
                  dayNumberOffset={dayNumberOffset}
                  isSelected={selectedDayId === day.id}
                  onSelect={() =>
                    onSelectDay?.(selectedDayId === day.id ? null : day.id)
                  }
                />
                {SECTION_ORDER.map((section, secIndex) => (
                  <DroppableCell
                    key={`${SLOT_PREFIX}${day.id}-${section}`}
                    id={`${SLOT_PREFIX}${day.id}-${section}`}
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

          <SortableContext
            items={allLocationIds}
            strategy={verticalListSortingStrategy}
          >
            {locations.map((loc) => {
              if (!loc.startDayId) return null;
              const pos = layout.itemPositions.get(loc.id);
              if (!pos) return null;

              const currentIndex = sortedLocs.findIndex(
                (l) => l.id === loc.id,
              );
              const nextLoc = sortedLocs[currentIndex + 1];
              const nextPos = nextLoc
                ? layout.itemPositions.get(nextLoc.id)
                : null;
              const route = nextLoc
                ? routes.find(
                  (r) =>
                    (r.fromLocationId === loc.id &&
                      r.toLocationId === nextLoc.id) ||
                    (r.fromLocationId === nextLoc.id &&
                      r.toLocationId === loc.id),
                )
                : undefined;

              const style: React.CSSProperties = {
                gridColumn: `${3 + pos.col} / span 1`,
                gridRow: `${pos.row} / span ${pos.span}`,
                zIndex: 1,
                height: '100%',
                marginBottom: 0,
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
                    className={`timeline-location-cell ${hoveredLocationId === loc.id ? 'hovered' : ''} ${selectedLocationId === loc.id ? 'selected' : ''}`}
                  >
                    <SortableItem
                      id={loc.id}
                      location={loc}
                      onRemove={onRemoveLocation}
                      onUpdate={onUpdateLocation}
                      onSelect={onSelectLocation}
                      onOpenSubItinerary={
                        !parentName ? onOpenSubItinerary : undefined
                      }
                      isSelected={selectedLocationId === loc.id}
                      duration={loc.duration}
                      zoomLevel={zoomLevel}
                      isSubLocation={Boolean(parentName)}
                    />
                  </Box>
                  {nextPos && (
                    <RouteConnector
                      route={route || null}
                      distance={calculateDistance(
                        loc.lat,
                        loc.lng,
                        nextLoc.lat,
                        nextLoc.lng,
                      )}
                      row={
                        pos.row === nextPos.row && pos.span === nextPos.span
                          ? pos.row
                          : pos.row + pos.span
                      }
                      rowSpan={
                        pos.row === nextPos.row && pos.span === nextPos.span
                          ? pos.span
                          : 1
                      }
                      col={Math.min(pos.col, nextPos.col)}
                      colSpan={Math.abs(nextPos.col - pos.col) + 1}
                      orientation={
                        pos.row === nextPos.row && pos.span === nextPos.span
                          ? 'horizontal'
                          : 'vertical'
                      }
                      onEdit={() => onEditRoute(loc.id, nextLoc.id)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </SortableContext>
        </Box>

        <Paper
          p="md"
          bg="var(--mantine-color-neutral-0)"
          style={{ position: 'sticky', bottom: 0, zIndex: 10, borderTop: '1px solid var(--mantine-color-neutral-2)' }}
        >
          <Group
            justify="space-between"
            mb={unassignedCollapsed ? 0 : 'xs'}
          >
            <Group
              gap="xs"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setUnassignedCollapsed(!unassignedCollapsed)}
            >
              {unassignedCollapsed ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
              <Text fw={700}>
                Unassigned{' '}
                {unassignedCollapsed && unassignedLocations.length > 0
                  ? `(${unassignedLocations.length})`
                  : ''}
              </Text>
            </Group>
            <Tooltip label="Add to Unassigned">
              <ActionIcon
                variant="light"
                size="sm"
                radius="xl"
                onClick={() => onAddToDay('unassigned')}
              >
                <Plus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Collapse
            in={!unassignedCollapsed}
            transitionDuration={180}
            transitionTimingFunction="ease"
          >
            <UnassignedZone
              locations={unassignedLocations}
              onRemove={onRemoveLocation}
              onUpdate={onUpdateLocation}
              onSelect={onSelectLocation}
              onOpenSubItinerary={
                !parentName ? onOpenSubItinerary : undefined
              }
              selectedLocationId={selectedLocationId}
              isSubLocation={Boolean(parentName)}
            />
          </Collapse>
        </Paper>

        <DragOverlay>
          {activeLocation ? (
            <Paper
              shadow="xl"
              withBorder
              p="sm"
              radius="lg"
              bg="var(--mantine-color-brand-0)"
              style={{ height: 80, cursor: 'grabbing', borderColor: 'var(--mantine-color-brand-3)' }}
            >
              <Text fw={700} c="brand.8">{activeLocation.name}</Text>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}
