import React from 'react';
import { Stack, Box, Paper, Group, Button, TextInput, ActionIcon, Slider, Tooltip, ScrollArea, Text, Modal, Skeleton } from '@mantine/core';
import { List as ListIcon, Calendar as CalendarIcon, Wallet, Search, Trash2, FileText, Download, Upload, History, Sparkles, Cloud, Compass, Plus } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { DaySidebar } from './DaySidebar';
import { CalendarView } from './CalendarView';
import { TripDashboard } from './TripDashboard';
import { Location, DaySection } from '../types';
import { PlaceSearchResult } from '../utils/geocoding';
import { ACTION_LABELS } from '../constants/actionLabels';
import { useItinerary } from '../context/ItineraryContext';

type EditingRoute = { fromId: string; toId: string } | null;

interface SidebarContentProps {
  sidebarView: 'timeline' | 'calendar' | 'budget';
  setSidebarView: (view: 'timeline' | 'calendar' | 'budget') => void;
  pendingAddToDay: { dayId: string, slot?: DaySection } | null;
  setPendingAddToDay: (val: { dayId: string, slot?: DaySection } | null) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  suggestionLoading: boolean;
  reorderShortcutHint: string;
  handleSearch: (e: React.FormEvent) => void;
  suggestions: PlaceSearchResult[];
  handleAddLocationWrapped: (lat: number, lng: number, name?: string) => Promise<void>;
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
  activeParent: Location | null;
  onSelectLocation: (id: string | null) => void;
  exitSubItinerary: () => void;
  activeDays: import('../types').Day[];
  sidebarLocations: Location[];
  handleSubReorder: (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => void;
  handleSubRemove: (id: string) => void;
  handleSubUpdate: (id: string, updates: Partial<Location>) => void;
  setEditingRoute: React.Dispatch<React.SetStateAction<EditingRoute>>;
  handleSubAdd: (dayId: string, slot?: DaySection) => void;
  selectedDayId: string | null;
  setSelectedDayId: (id: string | null) => void;
  isSlotBlocked: (dayId: string, slot: DaySection) => boolean;
  handleNestLocation: (activeId: string, parentId: string) => void;
  openSubItinerary: (parentId: string) => void;
  handleScrollToLocation: (id: string | null) => void;
  setShowHistoryModal: (val: boolean) => void;
  setShowAIModal: (val: boolean) => void;
  setShowCloudModal: (val: boolean) => void;
  handleExportMarkdown: () => void;
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SidebarContent({
  sidebarView, setSidebarView,
  pendingAddToDay, setPendingAddToDay,
  searchQuery, setSearchQuery, isSearching, suggestionLoading, reorderShortcutHint, handleSearch,
  suggestions, handleAddLocationWrapped,
  zoomLevel, setZoomLevel,
  activeParent, onSelectLocation, exitSubItinerary,
  activeDays, sidebarLocations,
  handleSubReorder, handleSubRemove, handleSubUpdate, setEditingRoute, handleSubAdd,
  selectedDayId, setSelectedDayId, isSlotBlocked, handleNestLocation,
  openSubItinerary,
  handleScrollToLocation,
  setShowHistoryModal, setShowAIModal, setShowCloudModal,
  handleExportMarkdown, handleExport, handleImport
}: SidebarContentProps) {
  const {
    startDate, endDate, days, locations, routes,
    hoveredLocationId, selectedLocationId,
    updateDateRange, updateDay,
    removeLocation, updateLocation, reorderLocations,
    setHoveredLocationId, clearAll
  } = useItinerary();

  const [datePickerOpened, setDatePickerOpened] = React.useState(false);
  const [confirmClearOpened, setConfirmClearOpened] = React.useState(false);
  const hasDates = Boolean(startDate && endDate);
  const hasStops = locations.length > 0;

  const setSuggestedTripRange = (dayCount: number) => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + dayCount - 1);
    const toIso = (date: Date) => date.toISOString().split('T')[0];
    updateDateRange(toIso(start), toIso(end));
    setDatePickerOpened(false);
  };

  const formatDateRange = () => {
    if (!startDate || !endDate) return 'Select Trip Dates';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const diff = days.length;
    return `${start} — ${end} (${diff} ${diff === 1 ? 'day' : 'days'})`;
  };

  return (
    <Stack style={{ height: '100%' }} gap={0} bg="var(--mantine-color-neutral-0)">
      <Box p="lg" style={{ borderBottom: '1px solid var(--mantine-color-neutral-2)' }}>
        {/* Collapsible Date Header */}
        <Box mb="xs">
          {!datePickerOpened ? (
            <Paper
              withBorder
              p="sm"
              bg="var(--mantine-color-neutral-0)"
              shadow="sm"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.2s ease', borderColor: 'var(--mantine-color-neutral-2)' }}
              onClick={() => setDatePickerOpened(true)}
              className="date-picker-trigger hover-shadow"
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <CalendarIcon size={16} color="var(--mantine-color-brand-6)" />
                  <Text size="sm" fw={600} c="var(--mantine-color-neutral-8)">{formatDateRange()}</Text>
                </Group>
                <Text size="xs" c="brand" fw={700} style={{ letterSpacing: '0.05em' }}>EDIT</Text>
              </Group>
            </Paper>
          ) : (
            <Stack gap="xs">
              <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={(s, e) => {
                updateDateRange(s, e);
                // We don't auto-close to allow fine-tuning, but user can close it
              }} />
              <Button variant="subtle" size="compact-xs" color="gray" onClick={() => setDatePickerOpened(false)}>
                Collapse Date Picker
              </Button>
            </Stack>
          )}
        </Box>

        {/* View Toggle */}
        <Group grow mt="sm" mb="md">
          <Button
            variant={sidebarView === 'timeline' ? 'light' : 'subtle'}
            onClick={() => setSidebarView('timeline')}
            leftSection={<ListIcon size={16} />}
            size="xs"
          >
            Timeline
          </Button>
          <Button
            variant={sidebarView === 'calendar' ? 'light' : 'subtle'}
            onClick={() => setSidebarView('calendar')}
            leftSection={<CalendarIcon size={16} />}
            size="xs"
          >
            Calendar
          </Button>
          <Button
            variant={sidebarView === 'budget' ? 'light' : 'subtle'}
            onClick={() => setSidebarView('budget')}
            leftSection={<Wallet size={16} />}
            size="xs"
            color="blue"
          >
            Budget
          </Button>
        </Group>

        {pendingAddToDay && (
          <Paper withBorder p="sm" bg="var(--mantine-color-brand-0)" style={{ borderColor: 'var(--mantine-color-brand-2)' }} shadow="xs" mt="sm" mb="xs" radius="md">
            <Group justify="space-between">
              <Text size="sm">
                {pendingAddToDay.dayId === 'unassigned'
                  ? 'Adding to Unassigned'
                  : `Adding to Day ${days.findIndex(d => d.id === pendingAddToDay.dayId) + 1}${pendingAddToDay.slot ? ` (${pendingAddToDay.slot})` : ''}`
                }
              </Text>
              <Button variant="subtle" size="xs" color="red" onClick={() => setPendingAddToDay(null)}>Cancel</Button>
            </Group>
          </Paper>
        )}

        <Box mb="xs" style={{ position: 'relative' }}>
          <form onSubmit={handleSearch}>
            <TextInput
              placeholder={pendingAddToDay ? "Search place to add..." : "Search destination or stop..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="md"
              radius="md"
              leftSection={<Search size={18} color="var(--mantine-color-neutral-4)" />}
              rightSection={
                isSearching && (
                  <ActionIcon size="sm" variant="transparent" loading>
                  </ActionIcon>
                )
              }
            />
          </form>
          {suggestionLoading && searchQuery.trim().length > 2 && (
            <Paper withBorder shadow="sm" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
              <Stack p="xs" gap="xs">
                <Skeleton height={14} radius="sm" />
                <Skeleton height={14} radius="sm" />
                <Skeleton height={14} radius="sm" width="85%" />
              </Stack>
            </Paper>
          )}
          {suggestions.length > 0 && (
            <Paper withBorder shadow="md" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: 250, overflowY: 'auto' }}>
              {suggestions.map((s) => (
                <Box
                  key={s.place_id}
                  p="xs"
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                  className="hover-bg-light"
                  onClick={async () => {
                    await handleAddLocationWrapped(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
                    setSearchQuery('');
                  }}
                >
                  <Text size="sm" fw={500}>{s.display_name.split(',')[0]}</Text>
                  <Text size="xs" c="dimmed" truncate>{s.display_name}</Text>
                </Box>
              ))}
            </Paper>
          )}
        </Box>

        {sidebarView === 'timeline' && (
          <Stack gap={4} mt="xs">
            <Group gap="xs" align="center">
              <Text size="xs" fw={500} c="dimmed">Zoom:</Text>
              <Slider
                flex={1}
                size="sm"
                min={0.5}
                max={2.5}
                step={0.1}
                value={zoomLevel}
                onChange={setZoomLevel}
                label={(val) => `${Math.round(val * 100)}%`}
                mb={4}
              />
              <Text size="xs" c="dimmed" w={35}>{Math.round(zoomLevel * 100)}%</Text>
            </Group>
            <Text size="10px" c="dimmed">Accessibility: use {reorderShortcutHint} to reorder selected timeline stops.</Text>
          </Stack>
        )}

        {!hasDates && (
          <Paper mt="sm" withBorder p="sm" bg="blue.0" radius="md">
            <Stack gap={6}>
              <Group gap={6}>
                <Compass size={14} color="var(--app-accent-contrast)" />
                <Text size="xs" fw={700}>Quick Start</Text>
              </Group>
              <Text size="xs" c="dimmed">Set dates to unlock timeline planning.</Text>
              <Group gap="xs">
                <Button size="compact-xs" variant="light" onClick={() => setSuggestedTripRange(2)}>2-day trip</Button>
                <Button size="compact-xs" variant="light" onClick={() => setSuggestedTripRange(5)}>5-day trip</Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {hasDates && !hasStops && (
          <Paper mt="sm" withBorder p="sm" radius="md">
            <Stack gap={6}>
              <Text size="xs" fw={700}>No stops yet</Text>
              <Text size="xs" c="dimmed">Search a destination above or add directly to Day 1.</Text>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<Plus size={12} />}
                onClick={() => setPendingAddToDay({ dayId: days[0]?.id || 'unassigned', slot: 'morning' })}
              >
                Add first stop
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidebarView === 'timeline' ? (
          <Stack h="100%" gap={0}>
            {activeParent && (
              <Paper p="md" bg="brand.6" radius={0}>
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="brand.1" fw={700} tt="uppercase" style={{ letterSpacing: '0.05em' }}>Sub-Itinerary</Text>
                    <Text size="md" c="white" fw={700} truncate>{activeParent.name}</Text>
                  </Box>
                  <Button variant="white" color="brand" size="xs" radius="md" fw={600} onClick={exitSubItinerary}>Back</Button>
                </Group>
              </Paper>
            )}
            <Box flex={1} style={{ overflow: 'hidden' }}>
              <DaySidebar
                days={activeDays} locations={sidebarLocations} routes={routes}
                onReorderLocations={activeParent ? handleSubReorder : reorderLocations}
                onRemoveLocation={activeParent ? handleSubRemove : removeLocation}
                onUpdateLocation={activeParent ? handleSubUpdate : updateLocation}
                onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
                onAddToDay={activeParent ? handleSubAdd : (dayId, slot) => setPendingAddToDay({ dayId, slot })}
                onUpdateDay={updateDay}
                hoveredLocationId={hoveredLocationId} onHoverLocation={setHoveredLocationId} zoomLevel={zoomLevel}
                selectedLocationId={selectedLocationId} onSelectLocation={onSelectLocation}
                dayNumberOffset={activeParent ? days.findIndex(d => d.id === activeParent.startDayId) + 1 : undefined}
                parentName={activeParent?.name}
                selectedDayId={selectedDayId}
                onSelectDay={setSelectedDayId}
                isSlotBlocked={activeParent ? isSlotBlocked : undefined}
                onNestLocation={handleNestLocation}
                onOpenSubItinerary={openSubItinerary}
              />
            </Box>
          </Stack>
        ) : sidebarView === 'calendar' ? (
          <CalendarView days={days} locations={locations} onSelectLocation={handleScrollToLocation} />
        ) : (
          <ScrollArea h="100%" p="md">
            <TripDashboard days={days} locations={locations} routes={routes} />
          </ScrollArea>
        )}
      </Box>

      <Box p="lg" style={{ borderTop: '1px solid var(--mantine-color-neutral-2)', backgroundColor: 'var(--mantine-color-neutral-0)' }}>
        {locations.length > 1 && routes.length === 0 && (
          <Paper withBorder p="sm" mb="md" bg="var(--app-warning-soft)" shadow="xs">
            <Text size="xs" c="dimmed">
              Routes are not configured yet. Add transport links from timeline connectors for better map guidance.
            </Text>
          </Paper>
        )}
        <Group justify="space-between" mb="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{locations.length} Stops</Text>
          <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => setConfirmClearOpened(true)}>
            Clear
          </Button>
        </Group>
        <Group gap="xs">
          <Button variant="light" size="xs" flex={1} leftSection={<History size={14} />} onClick={() => setShowHistoryModal(true)}>{ACTION_LABELS.history}</Button>
          <Button variant="light" color="blue" size="xs" flex={1} leftSection={<Sparkles size={14} />} onClick={() => setShowAIModal(true)}>{ACTION_LABELS.aiPlanner}</Button>
          <Button variant="light" size="xs" flex={1} leftSection={<Cloud size={14} />} onClick={() => setShowCloudModal(true)}>{ACTION_LABELS.cloudSync}</Button>
        </Group>
        <Group gap="xs" mt="xs">
          <Tooltip label={ACTION_LABELS.exportMarkdown}>
            <ActionIcon variant="default" size="md" onClick={handleExportMarkdown}><FileText size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label={ACTION_LABELS.exportJson}>
            <ActionIcon variant="default" size="md" onClick={handleExport}><Download size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label={ACTION_LABELS.importJson}>
            <ActionIcon variant="default" size="md" component="label" style={{ cursor: 'pointer' }}>
              <Upload size={16} />
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <Modal
        opened={confirmClearOpened}
        onClose={() => setConfirmClearOpened(false)}
        title="Clear itinerary?"
        centered
        size="sm"
        zIndex={3000}
        withinPortal
      >
        <Stack gap="md">
          <Text size="sm">This will remove all current itinerary data from the planner.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmClearOpened(false)}>Cancel</Button>
            <Button color="red" onClick={() => {
              clearAll();
              setConfirmClearOpened(false);
            }}>
              Clear all
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
