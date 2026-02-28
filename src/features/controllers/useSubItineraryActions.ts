import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { notifications } from '@mantine/notifications';
import { Day, DaySection, ItineraryData, Location } from '../../types';
import { reverseGeocode } from '../../utils/geocoding';
import { DEFAULT_CATEGORY, DEFAULT_SECTION, SLOT_PREFIX, UNASSIGNED_ZONE_ID } from '../../constants/daySection';

interface PendingAddToDay {
  dayId: string;
  slot?: DaySection;
}

interface LoadDataResult {
  success: boolean;
  error?: string;
}

interface UseSubItineraryActionsParams {
  activeParent: Location | null;
  activeDays: Day[];
  locations: Location[];
  selectedLocationId: string | null;
  pendingAddToDay: PendingAddToDay | null;
  setPendingAddToDay: (value: PendingAddToDay | null) => void;
  setSelectedLocationId: (id: string | null) => void;
  updateLocation: (id: string, updates: Partial<Location>) => void;
  loadFromData: (data: unknown) => LoadDataResult;
  getExportData: () => ItineraryData;
  handleAddLocationMain: (
    lat: number,
    lng: number,
    name?: string,
    targetDayId?: string,
    targetSlot?: DaySection,
  ) => Promise<void>;
}

export function useSubItineraryActions({
  activeParent,
  activeDays,
  locations,
  selectedLocationId,
  pendingAddToDay,
  setPendingAddToDay,
  setSelectedLocationId,
  updateLocation,
  loadFromData,
  getExportData,
  handleAddLocationMain,
}: UseSubItineraryActionsParams) {
  const handleSubReorder = useCallback((activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => {
    if (!activeParent) return;

    const newSubLocations = [...(activeParent.subLocations || [])];
    const activeIdx = newSubLocations.findIndex((item) => item.id === activeId);
    if (activeIdx === -1) return;

    let newDayOffset: number | undefined = undefined;
    if (newDayId && newDayId !== UNASSIGNED_ZONE_ID) {
      const dayIdx = activeDays.findIndex((day) => day.id === newDayId);
      if (dayIdx !== -1) newDayOffset = dayIdx;
    }

    const originalItem = newSubLocations[activeIdx];
    const updatedItem = {
      ...originalItem,
      dayOffset: newDayOffset,
      startSlot: newSlot || (newDayOffset !== undefined ? originalItem.startSlot || DEFAULT_SECTION : undefined),
    };

    if (overId && overId !== activeId && overId !== UNASSIGNED_ZONE_ID && !overId.startsWith(SLOT_PREFIX)) {
      newSubLocations.splice(activeIdx, 1);
      const overIdx = newSubLocations.findIndex((item) => item.id === overId);
      if (overIdx !== -1) {
        newSubLocations.splice(overIdx, 0, updatedItem);
      } else {
        newSubLocations.push(updatedItem);
      }
    } else {
      newSubLocations[activeIdx] = updatedItem;
    }

    updateLocation(activeParent.id, {
      subLocations: newSubLocations.map((item, idx) => ({ ...item, order: idx })),
    });
  }, [activeDays, activeParent, updateLocation]);

  const handleSubAdd = useCallback((dayId: string, slot?: DaySection) => {
    if (!activeParent) return;
    setPendingAddToDay({ dayId, slot });
  }, [activeParent, setPendingAddToDay]);

  const handleSubRemove = useCallback((id: string) => {
    if (!activeParent) return;
    updateLocation(activeParent.id, {
      subLocations: (activeParent.subLocations || []).filter((item) => item.id !== id),
    });
    if (selectedLocationId === id) setSelectedLocationId(activeParent.id);
  }, [activeParent, selectedLocationId, setSelectedLocationId, updateLocation]);

  const handleSubUpdate = useCallback((id: string, updates: Partial<Location>) => {
    if (!activeParent) return;
    updateLocation(activeParent.id, {
      subLocations: (activeParent.subLocations || []).map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  }, [activeParent, updateLocation]);

  const handleNestLocation = useCallback((activeId: string, parentId: string) => {
    const itemToNest = locations.find((item) => item.id === activeId);
    const parent = locations.find((item) => item.id === parentId);

    if (itemToNest && parent && activeId !== parentId) {
      const newLocations = locations.filter((item) => item.id !== activeId);
      const nestedItem: Location = {
        ...itemToNest,
        dayOffset: 0,
        startDayId: undefined,
        startSlot: DEFAULT_SECTION,
        order: (parent.subLocations || []).length,
      };

      const updatedLocations = newLocations.map((item) => {
        if (item.id === parentId) {
          return {
            ...item,
            subLocations: [...(item.subLocations || []), nestedItem],
          };
        }
        return item;
      });

      const result = loadFromData({ ...getExportData(), locations: updatedLocations });
      if (!result.success) {
        notifications.show({ color: 'red', title: 'Update failed', message: result.error || 'Unable to nest location.' });
      }

      if (selectedLocationId === activeId) {
        setSelectedLocationId(parentId);
      }
    }
  }, [getExportData, loadFromData, locations, selectedLocationId, setSelectedLocationId]);

  const handleAddLocationWrapped = useCallback(async (
    lat: number,
    lng: number,
    name?: string,
    targetDayId?: string,
    targetSlot?: DaySection,
  ) => {
    if (activeParent) {
      const resolvedName = name || await reverseGeocode(lat, lng);
      const dayId = targetDayId || pendingAddToDay?.dayId;
      const dayIdx = activeDays.findIndex((day) => day.id === dayId);

      const newSub: Location = {
        id: uuidv4(),
        name: resolvedName.split(',')[0],
        lat,
        lng,
        order: (activeParent.subLocations || []).length,
        dayOffset: dayIdx === -1 ? 0 : dayIdx,
        startSlot: targetSlot || pendingAddToDay?.slot || DEFAULT_SECTION,
        category: DEFAULT_CATEGORY,
        dayIds: [],
      };

      updateLocation(activeParent.id, {
        subLocations: [...(activeParent.subLocations || []), newSub],
      });
      setPendingAddToDay(null);
      return;
    }

    await handleAddLocationMain(lat, lng, name, targetDayId, targetSlot);
  }, [activeDays, activeParent, handleAddLocationMain, pendingAddToDay, setPendingAddToDay, updateLocation]);

  return {
    handleSubReorder,
    handleSubAdd,
    handleSubRemove,
    handleSubUpdate,
    handleNestLocation,
    handleAddLocationWrapped,
  };
}
