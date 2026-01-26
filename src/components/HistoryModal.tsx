import { Modal, Slider, Text, Stack, Group, Paper, ActionIcon, ScrollArea, Box } from '@mantine/core';
import { History, Undo, Redo } from 'lucide-react';

interface HistorySnapshot {
  timestamp: number;
  label: string;
}

interface HistoryModalProps {
  show: boolean;
  onClose: () => void;
  currentIndex: number;
  totalStates: number;
  snapshots: HistorySnapshot[];
  onNavigate: (index: number) => void;
}

export function HistoryModal({ show, onClose, currentIndex, totalStates, snapshots, onNavigate }: HistoryModalProps) {
  return (
    <Modal 
      opened={show} 
      onClose={onClose} 
      title={
        <Group gap="xs">
          <History size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={700}>Time Machine</Text>
        </Group>
      }
      size="lg"
      centered
      zIndex={9999}
      withinPortal={false}
      trapFocus={false}
    >
      <Stack gap="xl" py="md">
        {snapshots.length === 0 ? (
            <Box py="xl" ta="center">
                <Text c="dimmed">No history available yet. Make some changes to your trip!</Text>
            </Box>
        ) : (
            <>
                <Box px="md">
                  <Text size="sm" fw={500} mb="lg" ta="center" c="dimmed">
                    Slide to travel back in time. New changes will overwrite the future from the current point.
                  </Text>
                  
                  <Slider
                    label={(val) => snapshots[val]?.label || `State ${val + 1}`}
                    min={0}
                    max={Math.max(0, totalStates - 1)}
                    value={currentIndex >= 0 ? currentIndex : 0}
                    onChange={onNavigate}
                    marks={snapshots.map((_, i) => ({ value: i }))}
                    step={1}
                    size="xl"
                    styles={{
                        markLabel: { display: 'none' }
                    }}
                  />
                </Box>

                <Paper withBorder p={0}>
                  <ScrollArea h={300}>
                    <Stack gap={0}>
                      {snapshots.map((s, i) => (
                        <Box
                          key={i}
                          p="sm"
                          style={{
                            cursor: 'pointer',
                            backgroundColor: i === currentIndex ? 'var(--mantine-color-blue-0)' : 'transparent',
                            borderBottom: '1px solid var(--mantine-color-gray-2)'
                          }}
                          onClick={() => onNavigate(i)}
                        >
                          <Group justify="space-between">
                            <Stack gap={0}>
                              <Text size="sm" fw={i === currentIndex ? 700 : 400}>
                                {s.label}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {new Date(s.timestamp).toLocaleTimeString()}
                              </Text>
                            </Stack>
                            {i === currentIndex && (
                              <Text size="xs" fw={700} c="blue" tt="uppercase">Current</Text>
                            )}
                          </Group>
                        </Box>
                      )).reverse()}
                    </Stack>
                  </ScrollArea>
                </Paper>

                <Group justify="center" gap="xl">
                    <Stack align="center" gap={4}>
                        <ActionIcon 
                            variant="light" 
                            size="xl" 
                            radius="xl" 
                            disabled={currentIndex <= 0}
                            onClick={() => onNavigate(currentIndex - 1)}
                        >
                            <Undo size={20} />
                        </ActionIcon>
                        <Text size="xs" fw={500}>Step Back</Text>
                    </Stack>

                    <Stack align="center" gap={4}>
                        <ActionIcon 
                            variant="light" 
                            size="xl" 
                            radius="xl" 
                            disabled={currentIndex >= totalStates - 1}
                            onClick={() => onNavigate(currentIndex + 1)}
                        >
                            <Redo size={20} />
                        </ActionIcon>
                        <Text size="xs" fw={500}>Step Forward</Text>
                    </Stack>
                </Group>
            </>
        )}
      </Stack>
    </Modal>
  );
}