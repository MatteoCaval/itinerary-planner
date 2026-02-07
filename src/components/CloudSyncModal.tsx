import React, { useState, useEffect } from 'react';
import { Modal, Button, TextInput, Alert, Tabs, Text, Stack, ActionIcon, Skeleton, Paper } from '@mantine/core';
import { Upload, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { saveItinerary, loadItinerary } from '../firebase';

interface CloudSyncModalProps {
  show: boolean;
  onClose: () => void;
  getData: () => unknown;
  onLoadData: (data: unknown) => { success: boolean; error?: string };
}

export function CloudSyncModal({ show, onClose, getData, onLoadData }: CloudSyncModalProps) {
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('save');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generatePasscode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPasscode(`TRIP-${code}`);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (show) {
      const savedCode = localStorage.getItem('last-trip-passcode');
      setStatus(null);
      if (savedCode) {
        setPasscode(savedCode);
      } else {
        setPasscode('');
        if (activeTab === 'save') generatePasscode();
      }
    }
  }, [show, activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setStatus({ type: 'error', message: 'Please enter a passcode.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Saving to cloud...' });

    const data = getData();
    const result = await saveItinerary(passcode.trim(), data);

    setIsLoading(false);
    if (result.success) {
      localStorage.setItem('last-trip-passcode', passcode.trim());
      setStatus({ type: 'success', message: 'Itinerary saved successfully!' });
    } else {
      setStatus({ type: 'error', message: 'Failed to save. Check your connection.' });
    }
  };

  const handleLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setStatus({ type: 'error', message: 'Please enter a passcode.' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Loading from cloud...' });

    const result = await loadItinerary(passcode.trim());

    setIsLoading(false);
    if (result.success && result.data) {
      localStorage.setItem('last-trip-passcode', passcode.trim());
      const loadResult = onLoadData(result.data);
      if (loadResult.success) {
        setStatus({ type: 'success', message: 'Itinerary loaded successfully!' });
        setTimeout(onClose, 1500);
      } else {
        setStatus({ type: 'error', message: loadResult.error || 'The loaded itinerary has invalid format.' });
      }
    } else {
      setStatus({ type: 'error', message: result.error || 'Failed to load.' });
    }
  };

  return (
    <Modal opened={show} onClose={onClose} title="Cloud Sync" centered zIndex={2000}>
      <Stack>
        {status && (
          <Alert
            color={status.type === 'success' ? 'green' : status.type === 'error' ? 'red' : 'blue'}
            title={status.type === 'success' ? 'Success' : status.type === 'error' ? 'Error' : 'Info'}
            icon={status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          >
            {status.message}
          </Alert>
        )}

        {isLoading && (
          <Paper withBorder p="sm" radius="md">
            <Stack gap="xs">
              <Skeleton height={12} radius="xl" />
              <Skeleton height={12} radius="xl" width="85%" />
              <Skeleton height={32} radius="sm" />
            </Stack>
          </Paper>
        )}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="save" leftSection={<Upload size={16} />}>Save</Tabs.Tab>
            <Tabs.Tab value="load" leftSection={<Download size={16} />}>Load</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="save" pt="md">
            <form onSubmit={handleSave}>
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Save your trip to the cloud with a unique passcode. Share this code with friends to let them view or edit your plan.
                </Text>

                <TextInput
                  label="Passcode"
                  placeholder="e.g. TRIP-ABCD"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  styles={{ input: { fontFamily: 'monospace', fontWeight: 'bold' } }}
                  rightSection={
                    <ActionIcon variant="light" onClick={generatePasscode} title="Generate New Code">
                      <RefreshCw size={16} />
                    </ActionIcon>
                  }
                />

                <Button type="submit" loading={isLoading}>Save to Cloud</Button>
              </Stack>
            </form>
          </Tabs.Panel>

          <Tabs.Panel value="load" pt="md">
            <form onSubmit={handleLoad}>
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Enter a passcode to load an itinerary. <Text span c="red" fw={700}>Warning: This will overwrite your current plan.</Text>
                </Text>

                <TextInput
                  label="Passcode"
                  placeholder="Enter passcode..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  styles={{ input: { fontFamily: 'monospace', fontWeight: 'bold' } }}
                />

                <Button type="submit" color="orange" loading={isLoading}>Load from Cloud</Button>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Modal>
  );
}
