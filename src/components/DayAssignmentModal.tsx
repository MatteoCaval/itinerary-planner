import React from 'react';
import { Modal, Button, Text, Box, Paper, Group, Checkbox, Stack, ScrollArea } from '@mantine/core';
import { Day, Location } from '../types';
import { Calendar } from 'lucide-react';

interface DayAssignmentModalProps {
    show: boolean;
    location: Location | null;
    days: Day[];
    onSave: (locationId: string, dayIds: string[]) => void;
    onClose: () => void;
}

// Format date for display
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

export function DayAssignmentModal({ show, location, days, onSave, onClose }: DayAssignmentModalProps) {
    const [selectedDays, setSelectedDays] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (location) {
            setSelectedDays(new Set(location.dayIds));
        }
    }, [location]);

    const toggleDay = (dayId: string) => {
        setSelectedDays(prev => {
            const next = new Set(prev);
            if (next.has(dayId)) {
                next.delete(dayId);
            } else {
                next.add(dayId);
            }
            return next;
        });
    };

    const handleSave = () => {
        if (location) {
            onSave(location.id, Array.from(selectedDays));
        }
    };

    const getDayNumber = (dateStr: string) => {
        if (days.length === 0) return 1;
        const startDate = days[0].date;
        const date = new Date(dateStr);
        const start = new Date(startDate);
        const diffTime = date.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    };

    return (
        <Modal opened={show} onClose={onClose} title={<Group gap="xs"><Calendar size={18} /> Assign to Days</Group>} centered zIndex={2000}>
            {location && (
                <Stack gap="md">
                    <Paper p="xs" bg="gray.0">
                        <Text size="xs" c="dimmed">Location</Text>
                        <Text fw={700}>{location.name}</Text>
                    </Paper>

                    <Box>
                        <Text size="sm" c="dimmed" mb="xs">Select days this location spans:</Text>
                        <ScrollArea.Autosize mah={300}>
                            <Stack gap="xs">
                                {days.map((day) => {
                                    const isSelected = selectedDays.has(day.id);
                                    const dayNum = getDayNumber(day.date);

                                    return (
                                        <Paper
                                            key={day.id}
                                            p="xs"
                                            withBorder
                                            onClick={() => toggleDay(day.id)}
                                            style={{
                                                cursor: 'pointer',
                                                borderColor: isSelected ? 'var(--mantine-color-blue-filled)' : undefined,
                                                backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined
                                            }}
                                        >
                                            <Group>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => { }}
                                                    tabIndex={-1}
                                                    style={{ pointerEvents: 'none' }}
                                                />
                                                <Box>
                                                    <Text size="sm" fw={700}>Day {dayNum}</Text>
                                                    <Text size="xs" c="dimmed">{formatDate(day.date)}</Text>
                                                </Box>
                                            </Group>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </ScrollArea.Autosize>
                        {days.length === 0 && (
                            <Text c="dimmed" ta="center" py="md">
                                No days available. Please set trip dates first.
                            </Text>
                        )}
                    </Box>

                    <Group justify="flex-end" mt="md">
                        <Button variant="default" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={days.length === 0}>Save Assignment</Button>
                    </Group>
                </Stack>
            )}
        </Modal>
    );
}
