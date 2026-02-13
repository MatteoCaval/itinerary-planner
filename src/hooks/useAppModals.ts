import { useState } from 'react';
import { Location, DaySection } from '../types';

export function useAppModals() {
  const [showAIModal, setShowAIModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<{ fromId: string; toId: string } | null>(null);
  const [editingDayAssignment, setEditingDayAssignment] = useState<Location | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [pendingAddToDay, setPendingAddToDay] = useState<{ dayId: string; slot?: DaySection } | null>(null);

  return {
    showAIModal, setShowAIModal,
    showCloudModal, setShowCloudModal,
    showHistoryModal, setShowHistoryModal,
    editingRoute, setEditingRoute,
    editingDayAssignment, setEditingDayAssignment,
    panelCollapsed, setPanelCollapsed,
    pendingAddToDay, setPendingAddToDay,
  };
}
