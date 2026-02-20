import React from 'react';
import { Group, Button, ActionIcon, Text, Box, Menu } from '@mantine/core';
import { Burger } from '@mantine/core';
import { Map as MapIcon, Download, Upload, Cloud, FileText, MoreHorizontal, History, Undo, Redo, Sparkles, FolderKanban, Plus, Pencil, Trash2, Check, LogIn, LogOut, UserCircle2 } from 'lucide-react';
import { ACTION_LABELS } from '../constants/actionLabels';
import { ENABLE_ACCOUNT_AUTH } from '../constants/featureFlags';
import { TripSummary } from '../types';

interface AppHeaderProps {
  opened: boolean;
  toggle: () => void;
  trips: TripSummary[];
  activeTripId: string;
  onSwitchTrip: (tripId: string) => void;
  onCreateTrip: () => void;
  onRenameTrip: () => void;
  onDeleteTrip: () => void;
  historyIndex: number;
  historyLength: number;
  navigateHistory: (index: number) => void;
  onOpenHistory: () => void;
  onOpenAI: () => void;
  onOpenCloud: () => void;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  authEmail: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onExportMarkdown: () => void;
  onImport: React.ChangeEventHandler<HTMLInputElement>;
  onExport: () => void;
  importFileInputRef: React.RefObject<HTMLInputElement>;
}

export function AppHeader({
  opened,
  toggle,
  trips,
  activeTripId,
  onSwitchTrip,
  onCreateTrip,
  onRenameTrip,
  onDeleteTrip,
  historyIndex,
  historyLength,
  navigateHistory,
  onOpenHistory,
  onOpenAI,
  onOpenCloud,
  isAuthLoading,
  isAuthenticated,
  authEmail,
  onOpenAuth,
  onSignOut,
  onExportMarkdown,
  onImport,
  onExport,
  importFileInputRef,
}: AppHeaderProps) {
  const openImportPicker = () => importFileInputRef.current?.click();
  const activeTrip = trips.find((trip) => trip.id === activeTripId);
  const activeTripName = activeTrip?.name || 'Trip';

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group wrap="nowrap" gap="xs">
        <Burger opened={opened} onClick={toggle} size="sm" color="blue" hiddenFrom="sm" />
        <Text fw={700} fz="lg" c="blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapIcon size={20} /> <Box visibleFrom="xs">Itinerary Planner</Box>
        </Text>
        <Menu shadow="md" width={280} position="bottom-start" withinPortal zIndex={4000}>
          <Menu.Target>
            <Button variant="default" size="xs" leftSection={<FolderKanban size={14} />}>
              <Box visibleFrom="sm">{activeTripName}</Box>
              <Box hiddenFrom="sm">Trip</Box>
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Trips</Menu.Label>
            {trips.map((trip) => (
              <Menu.Item
                key={trip.id}
                leftSection={trip.id === activeTripId ? <Check size={14} /> : undefined}
                onClick={() => onSwitchTrip(trip.id)}
              >
                {trip.name}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<Plus size={14} />} onClick={onCreateTrip}>
              New trip
            </Menu.Item>
            <Menu.Item leftSection={<Pencil size={14} />} onClick={onRenameTrip}>
              Rename current trip
            </Menu.Item>
            <Menu.Item leftSection={<Trash2 size={14} />} color="red" onClick={onDeleteTrip}>
              Delete current trip
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Group gap="xs" visibleFrom="lg" wrap="nowrap">
        <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex - 1)} disabled={historyIndex <= 0}>
          <Undo size={18} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex + 1)} disabled={historyIndex >= historyLength - 1}>
          <Redo size={18} />
        </ActionIcon>
        <Button variant="default" size="xs" leftSection={<History size={16} />} onClick={onOpenHistory}>{ACTION_LABELS.history}</Button>
        <Button variant="light" color="blue" size="xs" leftSection={<Sparkles size={16} />} onClick={onOpenAI}>{ACTION_LABELS.aiPlanner}</Button>
        <Button variant="default" size="xs" leftSection={<FileText size={16} />} onClick={onExportMarkdown}>{ACTION_LABELS.exportMarkdown}</Button>
        <Button variant="default" size="xs" leftSection={<Upload size={16} />} onClick={openImportPicker}>{ACTION_LABELS.importJson}</Button>
        <Button variant="default" size="xs" leftSection={<Download size={16} />} onClick={onExport}>{ACTION_LABELS.exportJson}</Button>
        <Button variant="filled" color="blue" size="xs" leftSection={<Cloud size={16} />} onClick={onOpenCloud}>{ACTION_LABELS.cloudSync}</Button>
        {!ENABLE_ACCOUNT_AUTH ? (
          <Button variant="default" size="xs" leftSection={<UserCircle2 size={16} />} disabled>
            Account (Coming soon)
          </Button>
        ) : isAuthLoading ? (
          <Button variant="default" size="xs" leftSection={<UserCircle2 size={16} />} disabled>
            Account...
          </Button>
        ) : isAuthenticated ? (
          <Menu shadow="md" width={260} position="bottom-end" withinPortal zIndex={4000}>
            <Menu.Target>
              <Button variant="default" size="xs" leftSection={<UserCircle2 size={16} />}>
                <Box visibleFrom="xl">{authEmail || 'Account'}</Box>
                <Box hiddenFrom="xl">Account</Box>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in</Menu.Label>
              <Menu.Item disabled>{authEmail || 'Account'}</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={onSignOut}>
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Button variant="default" size="xs" leftSection={<LogIn size={16} />} onClick={onOpenAuth}>
            Sign in
          </Button>
        )}
      </Group>

      <Box hiddenFrom="lg">
        <Menu shadow="md" width={220} position="bottom-end" withinPortal zIndex={4000}>
          <Menu.Target>
            <ActionIcon variant="light" size="lg">
              <MoreHorizontal size={20} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Actions</Menu.Label>
            <Menu.Item leftSection={<History size={16} />} onClick={onOpenHistory}>{ACTION_LABELS.history}</Menu.Item>
            <Menu.Item leftSection={<Sparkles size={16} />} onClick={onOpenAI} color="blue">{ACTION_LABELS.aiPlanner}</Menu.Item>
            <Menu.Item leftSection={<Cloud size={16} />} onClick={onOpenCloud}>{ACTION_LABELS.cloudSync}</Menu.Item>
            <Menu.Item leftSection={<FileText size={16} />} onClick={onExportMarkdown}>
              {ACTION_LABELS.exportMarkdown}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Account</Menu.Label>
            {!ENABLE_ACCOUNT_AUTH ? (
              <Menu.Item leftSection={<UserCircle2 size={16} />} disabled>
                Account (Coming soon)
              </Menu.Item>
            ) : isAuthLoading ? (
              <Menu.Item leftSection={<UserCircle2 size={16} />} disabled>
                Account...
              </Menu.Item>
            ) : isAuthenticated ? (
              <>
                <Menu.Item leftSection={<UserCircle2 size={16} />} disabled>
                  {authEmail || 'Signed in'}
                </Menu.Item>
                <Menu.Item leftSection={<LogOut size={16} />} color="red" onClick={onSignOut}>
                  Sign out
                </Menu.Item>
              </>
            ) : (
              <Menu.Item leftSection={<LogIn size={16} />} onClick={onOpenAuth}>
                Sign in (optional)
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Label>Data</Menu.Label>
            <Menu.Item leftSection={<Upload size={16} />} onClick={openImportPicker}>
              {ACTION_LABELS.importJson}
            </Menu.Item>
            <Menu.Item leftSection={<Download size={16} />} onClick={onExport}>
              {ACTION_LABELS.exportJson}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
      <input
        ref={importFileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onImport}
        accept=".json"
      />
    </Group>
  );
}
