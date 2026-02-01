import React from 'react';
import { Stack, Box, Paper, Group, Button, TextInput, ActionIcon, Slider, Tooltip, ScrollArea, Text } from '@mantine/core';
import { List as ListIcon, Calendar as CalendarIcon, Wallet, Search, Trash2, FileText, Download, Upload, History, Sparkles, Cloud } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { DaySidebar } from './DaySidebar';
import { CalendarView } from './CalendarView';
import { TripDashboard } from './TripDashboard';
import { Location, Day, Route, DaySection } from '../types';

interface SidebarContentProps {
  startDate: string;
  endDate: string;
  updateDateRange: (start: string, end: string) => void;
  sidebarView: 'timeline' | 'calendar' | 'budget';
  setSidebarView: (view: 'timeline' | 'calendar' | 'budget') => void;
  pendingAddToDay: { dayId: string, slot?: DaySection } | null;
  setPendingAddToDay: (val: { dayId: string, slot?: DaySection } | null) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  handleSearch: (e: React.FormEvent) => void;
  suggestions: any[];
  handleAddLocationWrapped: (lat: number, lng: number, name?: string) => Promise<void>;
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
  activeParent: any;
  setSelectedLocationId: (id: string | null) => void;
  days: Day[];
  activeDays: Day[];
  sidebarLocations: Location[];
  routes: Route[];
  handleSubReorder: any;
  handleSubRemove: any;
  handleSubUpdate: any;
  setEditingRoute: any;
  handleSubAdd: any;
  updateDay: any;
  hoveredLocationId: string | null;
  setHoveredLocationId: (id: string | null) => void;
  selectedLocationId: string | null;
  reorderLocations: any;
  removeLocation: any;
  updateLocation: any;
  selectedDayId: string | null;
  setSelectedDayId: (id: string | null) => void;
  isSlotBlocked: any;
  handleNestLocation: any;
  handleScrollToLocation: (id: string | null) => void;
  locations: Location[];
  clearAll: () => void;
  setShowHistoryModal: (val: boolean) => void;
  setShowAIModal: (val: boolean) => void;
  setShowCloudModal: (val: boolean) => void;
  handleExportMarkdown: () => void;
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SidebarContent({
  startDate, endDate, updateDateRange,
  sidebarView, setSidebarView,
  pendingAddToDay, setPendingAddToDay,
  searchQuery, setSearchQuery, isSearching, handleSearch,
  suggestions, handleAddLocationWrapped,
  zoomLevel, setZoomLevel,
  activeParent, setSelectedLocationId,
  days, activeDays, sidebarLocations, routes,
  handleSubReorder, handleSubRemove, handleSubUpdate, setEditingRoute, handleSubAdd, updateDay,
  hoveredLocationId, setHoveredLocationId,
  selectedLocationId, reorderLocations, removeLocation, updateLocation,
  selectedDayId, setSelectedDayId, isSlotBlocked, handleNestLocation,
  handleScrollToLocation, locations, clearAll,
  setShowHistoryModal, setShowAIModal, setShowCloudModal,
  handleExportMarkdown, handleExport, handleImport
}: SidebarContentProps) {
  
  const [datePickerOpened, setDatePickerOpened] = React.useState(false);

  const formatDateRange = () => {
    if (!startDate || !endDate) return 'Select Trip Dates';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const diff = days.length;
    return `${start} — ${end} (${diff} ${diff === 1 ? 'day' : 'days'})`;
  };

  return (
    <Stack h="100%" gap={0}>
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        {/* Collapsible Date Header */}
        <Box mb="xs">
            {!datePickerOpened ? (
                <Paper 
                    withBorder 
                    p="xs" 
                    bg="gray.0" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDatePickerOpened(true)}
                >
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs">
                            <CalendarIcon size={14} color="var(--mantine-color-blue-6)" />
                            <Text size="xs" fw={700}>{formatDateRange()}</Text>
                        </Group>
                        <Text size="10px" c="blue" fw={700}>EDIT</Text>
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
          <Paper withBorder p="xs" bg="blue.0" mt="sm" mb="xs">
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
              placeholder={pendingAddToDay ? "Search place to add..." : "Search place..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              rightSection={
                <ActionIcon size="sm" variant="transparent" type="submit" loading={isSearching}>
                  <Search size={16} />
                </ActionIcon>
              }
            />
          </form>
          {suggestions.length > 0 && (
            <Paper withBorder shadow="md" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: 250, overflowY: 'auto' }}>
              {suggestions.map((s, i) => (
                <Box
                  key={i}
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
          <Group gap="xs" align="center" mt="xs">
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
        )}
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {sidebarView === 'timeline' ? (
          <Stack h="100%" gap={0}>
             {activeParent && (
                <Paper p="xs" bg="blue.6" radius={0}>
                    <Group justify="space-between">
                        <Box>
                            <Text size="xs" c="blue.1" fw={700} tt="uppercase">Planning Sub-Itinerary</Text>
                            <Text size="sm" c="white" fw={700} truncate>{activeParent.name}</Text>
                        </Box>
                        <Button variant="white" size="compact-xs" onClick={() => setSelectedLocationId(null)}>Back to Main</Button>
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
                    selectedLocationId={selectedLocationId} onSelectLocation={setSelectedLocationId}
                    dayNumberOffset={activeParent ? days.findIndex(d => d.id === activeParent.startDayId) + 1 : undefined}
                    parentName={activeParent?.name}
                    selectedDayId={selectedDayId}
                    onSelectDay={setSelectedDayId}
                    isSlotBlocked={activeParent ? isSlotBlocked : undefined}
                    onNestLocation={handleNestLocation}
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

      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Group justify="space-between" mb="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{locations.length} Stops</Text>
          <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => {
            if (confirm('Are you sure you want to clear all data?')) clearAll();
          }}>
            Clear
          </Button>
        </Group>
        <Group gap="xs">
          <Button variant="light" size="xs" flex={1} leftSection={<History size={14} />} onClick={() => setShowHistoryModal(true)}>History</Button>
          <Button variant="light" color="blue" size="xs" flex={1} leftSection={<Sparkles size={14} />} onClick={() => setShowAIModal(true)}>AI Planner</Button>
          <Button variant="light" size="xs" flex={1} leftSection={<Cloud size={14} />} onClick={() => setShowCloudModal(true)}>Cloud Sync</Button>
        </Group>
        <Group gap="xs" mt="xs">
          <Tooltip label="Export Markdown">
            <ActionIcon variant="default" size="md" onClick={handleExportMarkdown}><FileText size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Download JSON">
            <ActionIcon variant="default" size="md" onClick={handleExport}><Download size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Import JSON">
            <ActionIcon variant="default" size="md" component="label" style={{ cursor: 'pointer' }}>
              <Upload size={16} />
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>
    </Stack>
  );
}
