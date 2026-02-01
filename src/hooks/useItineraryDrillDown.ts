import { useMemo } from 'react';
import { Location, Day, DaySection } from '../types';

interface DrillDownProps {
  locations: Location[];
  days: Day[];
  selectedLocationId: string | null;
  selectedDayId: string | null;
}

export function useItineraryDrillDown({ locations, days, selectedLocationId, selectedDayId }: DrillDownProps) {
  // 1. Identify the "Active Parent" for the current context
  const activeParent = useMemo(() => {
    // Case 1: A top-level location with sub-locations is selected
    const top = locations.find(l => l.id === selectedLocationId);
    if (top && top.subLocations && top.subLocations.length > 0) return top;
    
    // Case 2: A sub-location is selected -> return its parent
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) return loc;
    }
    return null;
  }, [locations, selectedLocationId]);

  const isSubItinerary = !!activeParent;

  // 2. Identify the direct parent of the selected location (for "Back to" buttons)
  const parentLocation = useMemo(() => {
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) {
        return loc;
      }
    }
    return null;
  }, [locations, selectedLocationId]);

  // 3. Derive days for the current view (Main Trip or Sub-Itinerary range)
  const activeDays = useMemo(() => {
    if (!activeParent || !activeParent.startDayId) return days;
    
    const startDayIdx = days.findIndex(d => d.id === activeParent.startDayId);
    if (startDayIdx === -1) return days;
    
    const startSlotIdx = ['morning', 'afternoon', 'evening'].indexOf(activeParent.startSlot || 'morning');
    const totalSlots = activeParent.duration || 1;
    const endAbsSlot = (startDayIdx * 3) + startSlotIdx + totalSlots - 1;
    const endDayIdx = Math.floor(endAbsSlot / 3);
    
    return days.slice(startDayIdx, endDayIdx + 1);
  }, [days, activeParent]);

  // 4. Derive locations for the Map (handling drill-down + day filtering)
  const mapLocations = useMemo(() => {
    let baseLocations = locations;
    
    if (activeParent && activeParent.subLocations && activeParent.subLocations.length > 0) {
      baseLocations = activeParent.subLocations;
    }

    if (selectedDayId) {
      if (!activeParent) {
        // Global mode: Filter by startDayId
        return baseLocations.filter(l => l.startDayId === selectedDayId);
      } else {
        // Sub-itinerary mode: Filter by dayOffset index
        const dayIdx = activeDays.findIndex(d => d.id === selectedDayId);
        if (dayIdx !== -1) {
          return baseLocations.filter(l => l.dayOffset === dayIdx);
        }
      }
    }

    return baseLocations;
  }, [locations, activeParent, selectedDayId, activeDays]);

  // 5. Derive locations for the Timeline Sidebar (mapping dayOffset to startDayId)
  const sidebarLocations = useMemo(() => {
    if (!activeParent || !activeParent.subLocations) return locations;

    return activeParent.subLocations.map(sub => {
      const dayIdx = sub.dayOffset;
      const targetDay = dayIdx !== undefined ? activeDays[dayIdx] : undefined;
      return {
        ...sub,
        startDayId: targetDay ? targetDay.id : undefined
      };
    });
  }, [activeParent?.subLocations, activeDays, locations]);

  // 6. Slot blocking helper
  const isSlotBlocked = (dayId: string, slot: DaySection) => {
    if (!activeParent || !activeParent.startDayId) return false;

    const startDayIdx = days.findIndex(d => d.id === activeParent.startDayId);
    const currentDayIdx = days.findIndex(d => d.id === dayId);
    if (startDayIdx === -1 || currentDayIdx === -1) return false;

    const sectionOrder = ['morning', 'afternoon', 'evening'];
    const startSlotIdx = sectionOrder.indexOf(activeParent.startSlot || 'morning');
    const currentSlotIdx = sectionOrder.indexOf(slot);

    const absStart = startDayIdx * 3 + startSlotIdx;
    const absEnd = absStart + (activeParent.duration || 1) - 1;
    const absCurrent = currentDayIdx * 3 + currentSlotIdx;

    return absCurrent < absStart || absCurrent > absEnd;
  };

  return {
    activeParent,
    parentLocation,
    isSubItinerary,
    activeDays,
    mapLocations,
    sidebarLocations,
    isSlotBlocked
  };
}
