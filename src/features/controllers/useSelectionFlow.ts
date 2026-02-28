import { useCallback } from 'react';
import { Location } from '../../types';
import { DEFAULT_SECTION, SECTION_ORDER } from '../../constants/daySection';

interface UseSelectionFlowParams {
  locations: Location[];
  activeParent: Location | null;
  setSelectedLocationId: (id: string | null) => void;
  setDrillDownParentId: (id: string | null) => void;
  onCloseMobilePlanner: () => void;
}

export function useSelectionFlow({
  locations,
  activeParent,
  setSelectedLocationId,
  setDrillDownParentId,
  onCloseMobilePlanner,
}: UseSelectionFlowParams) {
  const handleSelectLocation = useCallback((id: string | null) => {
    setSelectedLocationId(id);
    if (!id) {
      setDrillDownParentId(null);
      return;
    }

    const topLevel = locations.find((location) => location.id === id);
    if (topLevel) {
      setDrillDownParentId(null);
      return;
    }

    const parent = locations.find((location) => location.subLocations?.some((sub) => sub.id === id));
    if (parent) {
      setDrillDownParentId(parent.id);
    }
  }, [locations, setDrillDownParentId, setSelectedLocationId]);

  const handleEnterSubItinerary = useCallback((parentId: string) => {
    const parent = locations.find((location) => location.id === parentId);
    const firstSub = [...(parent?.subLocations || [])].sort((a, b) => {
      const dayA = a.dayOffset ?? Number.MAX_SAFE_INTEGER;
      const dayB = b.dayOffset ?? Number.MAX_SAFE_INTEGER;
      if (dayA !== dayB) return dayA - dayB;
      const slotA = SECTION_ORDER.indexOf(a.startSlot || DEFAULT_SECTION);
      const slotB = SECTION_ORDER.indexOf(b.startSlot || DEFAULT_SECTION);
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    })[0];

    setDrillDownParentId(parentId);
    setSelectedLocationId(firstSub?.id || parentId);
  }, [locations, setDrillDownParentId, setSelectedLocationId]);

  const handleExitSubItinerary = useCallback(() => {
    if (activeParent) {
      setSelectedLocationId(activeParent.id);
    }
    setDrillDownParentId(null);
  }, [activeParent, setDrillDownParentId, setSelectedLocationId]);

  const handleScrollToLocation = useCallback((id: string | null) => {
    handleSelectLocation(id);
    if (!id) return;

    onCloseMobilePlanner();
    window.setTimeout(() => {
      const element = document.getElementById(`item-${id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [handleSelectLocation, onCloseMobilePlanner]);

  return {
    handleSelectLocation,
    handleEnterSubItinerary,
    handleExitSubItinerary,
    handleScrollToLocation,
  };
}
