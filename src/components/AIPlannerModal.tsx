import { useState } from 'react';
import { Modal, Button, TextInput, Textarea, Stack, Group, Text, PasswordInput, Tabs, Alert } from '@mantine/core';
import { Sparkles, Settings, AlertCircle } from 'lucide-react';
import { AISettings, Day, Location } from '../types';
import { generateAIItinerary } from '../aiService';
import { v4 as uuidv4 } from 'uuid';

interface AIPlannerModalProps {
  show: boolean;
  onClose: () => void;
  days: Day[];
  settings: AISettings;
  onSettingsChange: (settings: AISettings) => void;
  onAddLocations: (locations: Location[]) => void;
}

export function AIPlannerModal({ show, onClose, days, settings, onSettingsChange, onAddLocations }: AIPlannerModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('generate');

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
      const result = await generateAIItinerary(prompt, settings, dayData);
      
      const newLocations: Location[] = result.map((loc, index) => ({
        id: uuidv4(),
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
      }));

      onAddLocations(newLocations);
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
            <Text size="sm" c="dimmed">Describe your trip goals and Gemini will populate your timeline.</Text>
            
            {error && (
              <Alert icon={<AlertCircle size={16} />} title="Error" color="red">
                {error}
              </Alert>
            )}

            <Textarea
              placeholder="e.g. 3 days in London focusing on history and Harry Potter"
              minRows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              disabled={loading}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button 
                onClick={handleGenerate} 
                loading={loading}
                leftSection={!loading && <Sparkles size={16} />}
              >
                Generate Itinerary
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
                Your API key is stored locally in your browser. Gemini is currently the supported AI provider.
            </Alert>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}