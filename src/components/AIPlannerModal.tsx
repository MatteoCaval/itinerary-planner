import { useState } from 'react';
import { Modal, Button, TextInput, Textarea, Stack, Group, Text, PasswordInput, Tabs, Alert, SegmentedControl, Box } from '@mantine/core';
import { Sparkles, Settings, AlertCircle, Calendar } from 'lucide-react';
import { AISettings, Day, Location, Route } from '../types';
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
  onApplyItinerary: (locations: Location[], routes: Route[], mode: 'scratch' | 'refactor') => void;
}

export function AIPlannerModal({ show, onClose, days, currentLocations, currentRoutes, settings, onSettingsChange, onApplyItinerary }: AIPlannerModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('generate');
  const [mode, setMode] = useState<'scratch' | 'refactor'>('scratch');

  const hasDates = days.length > 0;

  const handleGenerate = async () => {
    if (!settings.apiKey) {
      setError(`Please provide your Gemini API key in the settings tab first.`);
      setActiveTab('settings');
      return;
    }
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const dayData = days.map(d => ({ id: d.id, date: d.date }));
      const result = await generateAIItinerary(prompt, settings, dayData, currentLocations, currentRoutes, mode);
      
      // Map temporary AI IDs to real UUIDs to ensure uniqueness and proper routing
      const idMap: Record<string, string> = {};
      
      const newLocations: Location[] = result.locations.map((loc, index) => {
        const newId = uuidv4();
        if (loc.id) idMap[loc.id] = newId;
        return {
          id: newId,
          name: loc.name || 'Unnamed Activity',
          lat: loc.lat || 0,
          lng: loc.lng || 0,
          notes: loc.notes || '',
          startDayId: loc.startDayId,
          startSlot: (loc.startSlot as any) || 'morning',
          duration: loc.duration || 1,
          order: index + 1000,
          category: (loc.category as any) || 'sightseeing',
          dayIds: [],
          checklist: [],
          links: []
        };
      });

      const newRoutes: Route[] = result.routes.map(r => ({
        id: uuidv4(),
        fromLocationId: idMap[r.fromLocationId || ''] || r.fromLocationId || '',
        toLocationId: idMap[r.toLocationId || ''] || r.toLocationId || '',
        transportType: (r.transportType as any) || 'car',
        duration: r.duration || '',
        notes: r.notes || ''
      }));

      onApplyItinerary(newLocations, newRoutes, mode);
      setPrompt('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation');
    } finally {
      setLoading(false);
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
                Please select your trip dates in the sidebar first. The AI needs to know the specific days to plan for.
              </Alert>
            )}

            <Box>
              <Text size="sm" fw={500} mb={4}>Planning Mode</Text>
              <SegmentedControl
                fullWidth
                value={mode}
                onChange={(val) => setMode(val as any)}
                data={[
                  { label: 'From Scratch (Replaces everything)', value: 'scratch' },
                  { label: 'Refactor (Enhance existing plans)', value: 'refactor' },
                ]}
                disabled={!hasDates || loading}
              />
            </Box>

            <Textarea
              placeholder="e.g. 3 days in London focusing on history and Harry Potter"
              minRows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              disabled={!hasDates || loading}
              label="What should I plan?"
            />

            {error && (
              <Alert icon={<AlertCircle size={16} />} title="Error" color="red">
                {error}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button 
                onClick={handleGenerate} 
                loading={loading}
                disabled={!hasDates || !prompt.trim()}
                leftSection={!loading && <Sparkles size={16} />}
              >
                {mode === 'scratch' ? 'Generate Itinerary' : 'Refactor Itinerary'}
              </Button>
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
