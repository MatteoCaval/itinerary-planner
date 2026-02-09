import { useState, useEffect } from 'react';
import { Modal, Button, NumberInput, Textarea, Group, Stack, Text, Paper, Badge, Grid, Box } from '@mantine/core';
import { Route, TransportType, TRANSPORT_LABELS } from '../types';
import { Clock, Euro, FileText, ArrowRight } from 'lucide-react';

interface RouteEditorProps {
    show: boolean;
    route: Route | null;
    fromName: string;
    toName: string;
    onSave: (route: Route) => void;
    onClose: () => void;
}

const TRANSPORT_OPTIONS: TransportType[] = ['walk', 'car', 'bus', 'train', 'flight', 'ferry', 'other'];
const QUICK_DURATIONS = [15, 30, 60, 120, 240]; // minutes

export function RouteEditor({ show, route, fromName, toName, onSave, onClose }: RouteEditorProps) {
    const [transportType, setTransportType] = useState<TransportType>('car');

    // Structured Duration State
    const [hours, setHours] = useState<number>(0);
    const [minutes, setMinutes] = useState<number>(0);

    const [cost, setCost] = useState<number | undefined>(undefined);
    const [notes, setNotes] = useState('');

    // Helper to parse duration string "1h 30m" -> { h: 1, m: 30 }
    const parseDuration = (str: string) => {
        let h = 0, m = 0;
        if (!str) return { h, m };

        // Match "Xh"
        const hMatch = str.match(/(\d+)\s*h/);
        if (hMatch) h = parseInt(hMatch[1]);

        // Match "Xm"
        const mMatch = str.match(/(\d+)\s*m/);
        if (mMatch) m = parseInt(mMatch[1]);

        return { h, m };
    };

    useEffect(() => {
        if (route) {
            setTransportType(route.transportType);
            const { h, m } = parseDuration(route.duration || '');
            setHours(h);
            setMinutes(m);
            setCost(route.cost);
            setNotes(route.notes || '');
        } else {
            // Reset to defaults
            setTransportType('car');
            setHours(0);
            setMinutes(0);
            setCost(undefined);
            setNotes('');
        }
    }, [route, show]); // Reset when modal opens

    const handleQuickDuration = (totalMins: number) => {
        setHours(Math.floor(totalMins / 60));
        setMinutes(totalMins % 60);
    };

    const handleSave = () => {
        if (!route) return;

        // Format duration string
        let durationStr = '';
        if (hours > 0) durationStr += `${hours}h`;
        if (minutes > 0) durationStr += `${hours > 0 ? ' ' : ''}${minutes}m`;

        onSave({
            ...route,
            transportType,
            duration: durationStr || undefined,
            cost: cost,
            notes: notes || undefined,
        });
    };

    return (
        <Modal
            opened={show}
            onClose={onClose}
            title="Edit Route Details"
            size="lg"
            centered
            zIndex={2000}
            transitionProps={{ transition: 'slide-up', duration: 180, timingFunction: 'ease' }}
        >
            <Paper withBorder p="sm" bg="gray.0" mb="md" className="route-editor-summary">
                <Group justify="center" align="center" gap="md">
                    <Stack gap={2} align="center" style={{ flex: 1 }}>
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">From</Text>
                        <Text fw={600} ta="center" size="sm" lineClamp={1}>{fromName}</Text>
                    </Stack>
                    <ArrowRight size={16} className="text-muted" />
                    <Stack gap={2} align="center" style={{ flex: 1 }}>
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">To</Text>
                        <Text fw={600} ta="center" size="sm" lineClamp={1}>{toName}</Text>
                    </Stack>
                </Group>
            </Paper>

            <Grid gutter="xl">
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="md">
                        <Box>
                            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Transportation Method</Text>
                            <Group gap={8}>
                                {TRANSPORT_OPTIONS.map(type => (
                                    <Button
                                        key={type}
                                        className="route-transport-button"
                                        variant={transportType === type ? 'filled' : 'default'}
                                        size="xs"
                                        onClick={() => setTransportType(type)}
                                        tt="capitalize"
                                    >
                                        {TRANSPORT_LABELS[type]}
                                    </Button>
                                ))}
                            </Group>
                        </Box>

                        <NumberInput
                            label={
                                <Group gap={4} mb={4}>
                                    <Euro size={14} />
                                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">Estimated Cost</Text>
                                </Group>
                            }
                            leftSection="€"
                            placeholder="0.00"
                            value={cost}
                            onChange={(val) => setCost(Number(val) || undefined)}
                            min={0}
                            decimalScale={2}
                        />
                    </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="md">
                        <Box>
                            <Group gap={4} mb={4}>
                                <Clock size={14} />
                                <Text size="xs" fw={700} tt="uppercase" c="dimmed">Duration</Text>
                            </Group>
                            <Group align="end" gap="xs" mb="xs">
                                <NumberInput
                                    min={0}
                                    value={hours}
                                    onChange={(val) => setHours(Number(val) || 0)}
                                    rightSection={<Text size="xs" c="dimmed" mr="xs">hr</Text>}
                                    style={{ flex: 1 }}
                                />
                                <NumberInput
                                    min={0}
                                    max={59}
                                    value={minutes}
                                    onChange={(val) => setMinutes(Number(val) || 0)}
                                    rightSection={<Text size="xs" c="dimmed" mr="xs">min</Text>}
                                    style={{ flex: 1 }}
                                />
                            </Group>
                            <Group gap={4}>
                                {QUICK_DURATIONS.map(m => (
                                    <Badge
                                        key={m}
                                        className="route-duration-chip"
                                        variant="outline"
                                        color="gray"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleQuickDuration(m)}
                                    >
                                        {m >= 60 ? `${m / 60}h` : `${m}m`}
                                    </Badge>
                                ))}
                            </Group>
                        </Box>

                        <Textarea
                            label={
                                <Group gap={4} mb={4}>
                                    <FileText size={14} />
                                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">Notes</Text>
                                </Group>
                            }
                            placeholder="Route details, booking ref..."
                            minRows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Stack>
                </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="xl">
                <Button variant="default" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Save Route</Button>
            </Group>
        </Modal>
    );
}
