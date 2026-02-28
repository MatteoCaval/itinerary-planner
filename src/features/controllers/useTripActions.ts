import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { TripSummary } from '../../types';

interface AuthActionResult {
  success: boolean;
  error?: string;
}

interface UseTripActionsParams {
  trips: TripSummary[];
  activeTripId: string;
  switchTrip: (tripId: string) => void;
  createTrip: (name?: string) => string;
  renameTrip: (tripId: string, name: string) => void;
  deleteTrip: (tripId: string) => boolean;
  signOutUser: () => Promise<AuthActionResult>;
  onResetUiForTripChange: () => void;
}

export function useTripActions({
  trips,
  activeTripId,
  switchTrip,
  createTrip,
  renameTrip,
  deleteTrip,
  signOutUser,
  onResetUiForTripChange,
}: UseTripActionsParams) {
  const activeTrip = trips.find((trip) => trip.id === activeTripId) || null;
  const suggestedTripName = `Trip ${trips.length + 1}`;

  const executeSignOut = useCallback(async () => {
    const result = await signOutUser();
    if (!result.success) {
      notifications.show({
        color: 'red',
        title: 'Sign out failed',
        message: result.error || 'Unable to sign out right now.',
      });
      return false;
    }

    notifications.show({
      color: 'blue',
      title: 'Signed out',
      message: 'You are now in guest mode.',
    });
    return true;
  }, [signOutUser]);

  const executeSwitchTrip = useCallback((tripId: string) => {
    if (tripId === activeTripId) return;
    switchTrip(tripId);
    onResetUiForTripChange();
    notifications.show({ color: 'blue', title: 'Trip switched', message: 'Active trip changed successfully.' });
  }, [activeTripId, onResetUiForTripChange, switchTrip]);

  const executeCreateTrip = useCallback((name: string) => {
    const tripName = name.trim() || suggestedTripName;
    createTrip(tripName);
    onResetUiForTripChange();
    notifications.show({ color: 'green', title: 'Trip created', message: `Now editing "${tripName}".` });
    return true;
  }, [createTrip, onResetUiForTripChange, suggestedTripName]);

  const executeRenameActiveTrip = useCallback((name: string) => {
    if (!activeTrip) return false;
    const tripName = name.trim();
    if (!tripName) {
      notifications.show({
        color: 'yellow',
        title: 'Name required',
        message: 'Trip name cannot be empty.',
      });
      return false;
    }
    renameTrip(activeTrip.id, tripName);
    notifications.show({ color: 'green', title: 'Trip renamed', message: `Renamed to "${tripName}".` });
    return true;
  }, [activeTrip, renameTrip]);

  const executeDeleteActiveTrip = useCallback(() => {
    if (!activeTrip) return false;

    const deleted = deleteTrip(activeTrip.id);
    if (!deleted) {
      notifications.show({
        color: 'yellow',
        title: 'Trip not deleted',
        message: 'At least one trip must remain. Create another trip first.',
      });
      return false;
    }

    onResetUiForTripChange();
    notifications.show({ color: 'green', title: 'Trip deleted', message: 'Trip removed successfully.' });
    return true;
  }, [activeTrip, deleteTrip, onResetUiForTripChange]);

  return {
    activeTrip,
    suggestedTripName,
    executeSignOut,
    executeSwitchTrip,
    executeCreateTrip,
    executeRenameActiveTrip,
    executeDeleteActiveTrip,
  };
}
