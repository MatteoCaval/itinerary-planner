import { useMemo } from 'react';
import { Location, Day, DaySection } from '../types';

interface DrillDownProps {
  locations: Location[];
  days: Day[];
  selectedLocationId: string | null;
  selectedDayId: string | null;
}

export function useItineraryDrillDown({ locations, days, selectedLocationId, selectedDayId }: DrillDownProps) {
  // 1. Identify the "Active Parent" destination
  const activeParent = useMemo(() => {
    const top = locations.find(l => l.id === selectedLocationId);
    if (top && top.subLocations && top.subLocations.length > 0) return top;
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) return loc;
    }
    return null;
  }, [locations, selectedLocationId]);

  const isSubItinerary = !!activeParent;

  const parentLocation = useMemo(() => {
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) return loc;
    }
    return null;
  }, [locations, selectedLocationId]);

  // 2. Determine the range of days for this destination
  const activeDays = useMemo(() => {
    if (!activeParent || !activeParent.startDayId) return days;
    const startIdx = days.findIndex(d => d.id === activeParent.startDayId);
    if (startIdx === -1) return days;
    
    // Calculate how many days this destination spans
    const startSlotIdx = ['morning', 'afternoon', 'evening'].indexOf(activeParent.startSlot || 'morning');
    const totalSlots = activeParent.duration || 1;
    const endDayIdx = Math.floor((startIdx * 3 + startSlotIdx + totalSlots - 1) / 3);
    
    return days.slice(startIdx, endDayIdx + 1);
  }, [days, activeParent]);

  // 3. Filter locations for the MAP
  const mapLocations = useMemo(() => {
    let base = activeParent?.subLocations || (isSubItinerary ? [] : locations);

    if (selectedDayId) {
      if (!activeParent) {
        // Global focus: match by startDayId
        return base.filter(l => l.startDayId === selectedDayId);
      } else {
        // Sub-itinerary focus: find relative index of selectedDayId within activeDays
        const relIdx = activeDays.findIndex(d => d.id === selectedDayId);
        if (relIdx === -1) return []; // Day is outside this destination's range
        return base.filter(l => l.dayOffset === relIdx);
      }
    }
    return base;
  }, [locations, activeParent, selectedDayId, activeDays, isSubItinerary]);

  // 4. Locations for the Sidebar
  const sidebarLocations = useMemo(() => {
    if (!activeParent || !activeParent.subLocations) return locations;
    return activeParent.subLocations.map(sub => {
      const targetDay = sub.dayOffset !== undefined ? activeDays[sub.dayOffset] : undefined;
      return { ...sub, startDayId: targetDay ? targetDay.id : undefined };
    });
  }, [activeParent, activeDays, locations]);

  const isSlotBlocked = (dayId: string, slot: DaySection) => {
    if (!activeParent || !activeParent.startDayId) return false;
    const startIdx = days.findIndex(d => d.id === activeParent.startDayId);
    const currIdx = days.findIndex(d => d.id === dayId);
    if (startIdx === -1 || currIdx === -1) return false;

    const sections = ['morning', 'afternoon', 'evening'];
    const startAbs = startIdx * 3 + sections.indexOf(activeParent.startSlot || 'morning');
    const endAbs = startAbs + (activeParent.duration || 1) - 1;
    const currAbs = currIdx * 3 + sections.indexOf(slot);

    return currAbs < startAbs || currAbs > endAbs;
  };

  return { activeParent, parentLocation, isSubItinerary, activeDays, mapLocations, sidebarLocations, isSlotBlocked };
}