import { useState } from 'react';
import { Modal, Button, TextInput, Textarea, Stack, Group, Text, PasswordInput, Tabs, Alert, SegmentedControl, Box, Paper, ScrollArea } from '@mantine/core';
import { Sparkles, Settings, AlertCircle, Calendar, MessageSquareQuote } from 'lucide-react';
import { AISettings, Day, DaySection, Location, LocationCategory, Route, TransportType } from '../types';
import { generateAIItinerary } from '../aiService';
import { v4 as uuidv4 } from 'uuid';

interface AIPlannerModalProps {
  show: boolean;
  onClose: () => void;
  days: Day[];
  currentLocations: Location[];
  currentRoutes: Route[];
  settings: AISettings;
  onSettingsChange: (settings: AISettings) => void;
  onApplyItinerary: (locations: Location[], routes: Route[], days?: Day[]) => void;
}

export function AIPlannerModal({ show, onClose, days, currentLocations, currentRoutes, settings, onSettingsChange, onApplyItinerary }: AIPlannerModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('generate');
  const [mode, setMode] = useState<'scratch' | 'refactor'>('scratch');
  const [resultExplanation, setResultExplanation] = useState<string | null>(null);
  const [pendingResults, setPendingResults] = useState<{ locations: Location[], routes: Route[], days?: Day[] } | null>(null);

  const hasDates = days.length > 0;
  const validSlots: DaySection[] = ['morning', 'afternoon', 'evening'];
  const validCategories: LocationCategory[] = ['sightseeing', 'dining', 'hotel', 'transit', 'other'];
  const validTransportTypes: TransportType[] = ['walk', 'car', 'bus', 'train', 'flight', 'ferry', 'other'];

  const normalizeErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'An error occurred during generation';
  };

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setError(`Please provide your Gemini API key in the settings tab first.`);
      setActiveTab('settings');
      return;
    }
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResultExplanation(null);
    setPendingResults(null);

    try {
      const dayData = days.map(d => ({ id: d.id, date: d.date }));
      const result = await generateAIItinerary(prompt, settings, dayData, currentLocations, currentRoutes, mode);
      
      const idMap: Record<string, string> = {};
      
      const mapLocation = (loc: Partial<Location>, index: number): Location => {
        const newId = uuidv4();
        if (loc.id) idMap[loc.id] = newId;
        const mappedSlot = loc.startSlot && validSlots.includes(loc.startSlot) ? loc.startSlot : 'morning';
        const mappedCategory = loc.category && validCategories.includes(loc.category) ? loc.category : 'sightseeing';
        
        return {
          id: newId,
          name: loc.name || 'Unnamed Activity',
          lat: loc.lat || 0,
          lng: loc.lng || 0,
          notes: loc.notes || '',
          startDayId: loc.startDayId,
          startSlot: mappedSlot,
          duration: loc.duration || 1,
          order: index + 1000,
          category: mappedCategory,
          dayOffset: loc.dayOffset,
          dayIds: [],
          checklist: [],
          links: [],
          subLocations: loc.subLocations?.map((sub, sIdx) => mapLocation(sub, sIdx))
        };
      };

      const newLocations: Location[] = result.locations.map((loc, index) => mapLocation(loc, index));

      const newRoutes: Route[] = result.routes.map(r => ({
        id: uuidv4(),
        fromLocationId: idMap[r.fromLocationId || ''] || r.fromLocationId || '',
        toLocationId: idMap[r.toLocationId || ''] || r.toLocationId || '',
        transportType: r.transportType && validTransportTypes.includes(r.transportType) ? r.transportType : 'car',
        duration: r.duration || '',
        notes: r.notes || ''
      }));

      // Update days with accommodations if provided
      const updatedDays: Day[] = days.map(d => {
        const aiDay = result.days?.find(ad => ad.id === d.id);
        if (aiDay && aiDay.accommodation) {
          return { ...d, accommodation: { ...aiDay.accommodation } };
        }
        return d;
      });

      setResultExplanation(result.explanation || null);
      setPendingResults({ locations: newLocations, routes: newRoutes, days: updatedDays });
      
      // If there's no explanation, we can just apply immediately
      if (!result.explanation) {
        onApplyItinerary(newLocations, newRoutes, updatedDays);
        setPrompt('');
        onClose();
      }
    } catch (error) {
      setError(normalizeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (pendingResults) {
        onApplyItinerary(pendingResults.locations, pendingResults.routes, pendingResults.days);
        setPrompt('');
        setPendingResults(null);
        setResultExplanation(null);
        onClose();
    }
  };

  return (
    <Modal 
      opened={show} 
      onClose={onClose} 
      title={
        <Group gap="xs">
            <Sparkles size={18} color="var(--mantine-color-blue-6)" /> 
            AI Magic Planner (Gemini)
        </Group>
      } 
      size="lg"
      centered
      zIndex={9999}
      withinPortal={false}
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="generate" leftSection={<Sparkles size={14} />}>Generate</Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<Settings size={14} />}>Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="generate">
          <Stack gap="md">
            {!hasDates && (
              <Alert icon={<Calendar size={16} />} title="Dates Required" color="orange">
                Please select your trip dates in the sidebar first.
              </Alert>
            )}

            {!resultExplanation ? (
                <>
                    <Box>
                      <Text size="sm" fw={500} mb={4}>Planning Mode</Text>
                      <SegmentedControl
                        fullWidth
                        value={mode}
                        onChange={val => {
                          if (val === 'scratch' || val === 'refactor') {
                            setMode(val);
                          }
                        }}
                        data={[
                          { label: 'From Scratch', value: 'scratch' },
                          { label: 'Refactor', value: 'refactor' },
                        ]}
                        disabled={!hasDates || loading}
                      />
                    </Box>

                    <Textarea
                      placeholder="e.g. 3 days in London focusing on history"
                      minRows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.currentTarget.value)}
                      disabled={!hasDates || loading}
                      label="What should I plan?"
                    />
                </>
            ) : (
                <Paper withBorder p="md" bg="blue.0" radius="md">
                    <Stack gap="xs">
                        <Group gap="xs">
                            <MessageSquareQuote size={18} color="var(--mantine-color-blue-6)" />
                            <Text fw={700} size="sm">AI Insights & Decisions</Text>
                        </Group>
                        <ScrollArea.Autosize mah={200}>
                            <Text size="sm" style={{ fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                {resultExplanation}
                            </Text>
                        </ScrollArea.Autosize>
                        <Alert color="blue" variant="light" mt="sm">
                            The itinerary has been generated based on your request. Review the notes above and click 'Apply' to update your timeline.
                        </Alert>
                    </Stack>
                </Paper>
            )}

            {error && (
              <Alert icon={<AlertCircle size={16} />} title="Error" color="red">
                {error}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
              {resultExplanation ? (
                  <Button onClick={handleApply} color="green">Apply Changes</Button>
              ) : (
                  <Button 
                    onClick={handleGenerate} 
                    loading={loading}
                    disabled={!hasDates || !prompt.trim()}
                    leftSection={!loading && <Sparkles size={16} />}
                  >
                    Generate
                  </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="settings">
          <Stack gap="md">
            <PasswordInput
              label="Gemini API Key"
              placeholder="Enter your Google AI API key"
              value={settings.apiKey}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.currentTarget.value })}
              description={
                <Text size="xs" component="a" href="https://aistudio.google.com/app/apikey" target="_blank" c="blue">Get a free Gemini API key here</Text>
              }
            />

            <TextInput
              label="Model Name"
              placeholder="gemini-3-flash-preview"
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.currentTarget.value })}
            />

            <Alert color="blue">
                Your API key is stored locally in your browser.
            </Alert>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
