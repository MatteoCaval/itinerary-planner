import { TextInput, Group, Badge, Grid, Stack, Text } from '@mantine/core';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onDateRangeChange: (startDate: string, endDate: string) => void;
}

export function DateRangePicker({ startDate, endDate, onDateRangeChange }: DateRangePickerProps) {
    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStart = e.target.value;
        const adjustedEnd = endDate && newStart > endDate ? newStart : endDate;
        onDateRangeChange(newStart, adjustedEnd);
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEnd = e.target.value;
        const adjustedStart = startDate && newEnd < startDate ? newEnd : startDate;
        onDateRangeChange(adjustedStart, newEnd);
    };

    // Calculate number of days
    const getDayCount = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const dayCount = getDayCount();

    return (
        <Stack gap="xs" mb="md">
            <Group justify="space-between">
                <Group gap="xs">
                    <Calendar size={18} style={{ color: 'var(--mantine-color-blue-6)' }} />
                    <Text fw={700} size="sm">Trip Dates</Text>
                </Group>
                {dayCount > 0 && (
                    <Badge variant="filled">{dayCount} day{dayCount !== 1 ? 's' : ''}</Badge>
                )}
            </Group>
            <Grid gutter="xs">
                <Grid.Col span={6}>
                    <TextInput
                        label="Start"
                        type="date"
                        size="xs"
                        value={startDate}
                        onChange={handleStartChange}
                    />
                </Grid.Col>
                <Grid.Col span={6}>
                    <TextInput
                        label="End"
                        type="date"
                        size="xs"
                        value={endDate}
                        onChange={handleEndChange}
                        min={startDate}
                    />
                </Grid.Col>
            </Grid>
        </Stack>
    );
}
