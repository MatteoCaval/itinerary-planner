import { useState, useEffect } from 'react';
import {
  ActionIcon,
  Text,
  Group,
  Stack,
  Box,
  Paper,
  Tooltip,
  Popover,
  TextInput,
  Button,
  Autocomplete,
  NumberInput,
  Skeleton,
} from '@mantine/core';
import { Plus, Bed, Search, MapPin, Euro, Trash } from 'lucide-react';
import { Day } from '../../types';
import { PlaceSearchResult, searchPlace } from '../../utils/geocoding';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

interface DayLabelProps {
  day: Day;
  startRow: number;
  dayNum: number;
  isEvenDay: boolean;
  onAdd: () => void;
  onUpdateDay: (id: string, updates: Partial<Day>) => void;
  existingAccommodations: string[];
  parentName?: string;
  dayNumberOffset?: number;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function DayLabel({
  day,
  startRow,
  dayNum,
  isEvenDay,
  onAdd,
  onUpdateDay,
  existingAccommodations,
  parentName,
  dayNumberOffset,
  isSelected,
  onSelect,
}: DayLabelProps) {
  const [opened, setOpened] = useState(false);
  const [tempName, setTempName] = useState(day.accommodation?.name || '');
  const [tempNotes, setTempNotes] = useState(day.accommodation?.notes || '');
  const [tempCost, setTempCost] = useState<number | undefined>(
    day.accommodation?.cost,
  );
  const [tempLat, setTempLat] = useState(day.accommodation?.lat);
  const [tempLng, setTempLng] = useState(day.accommodation?.lng);

  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    setTempName(day.accommodation?.name || '');
    setTempNotes(day.accommodation?.notes || '');
    setTempCost(day.accommodation?.cost);
    setTempLat(day.accommodation?.lat);
    setTempLng(day.accommodation?.lng);
  }, [day.accommodation]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (opened && tempName.trim().length > 2 && !tempLat) {
        setIsSuggesting(true);
        const results = await searchPlace(tempName);
        setSuggestions(results || []);
        setIsSuggesting(false);
      } else {
        setSuggestions([]);
        setIsSuggesting(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [tempName, opened, tempLat]);

  const selectSuggestion = (s: PlaceSearchResult) => {
    setTempName(s.display_name.split(',')[0]);
    setTempLat(parseFloat(s.lat));
    setTempLng(parseFloat(s.lon));
    setSuggestions([]);
  };

  const handleSave = () => {
    onUpdateDay(day.id, {
      accommodation: {
        ...day.accommodation,
        name: tempName,
        notes: tempNotes,
        cost: tempCost,
        lat: tempLat,
        lng: tempLng,
      },
    });
    setOpened(false);
  };

  const handleRemove = () => {
    onUpdateDay(day.id, { accommodation: undefined });
    setOpened(false);
  };

  return (
    <Box
      p="xs"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={onSelect ? 0 : -1}
      role={onSelect ? 'button' : undefined}
      aria-label={`Select day ${dayNum}`}
      className={`day-label-box ${isSelected ? 'day-label-selected' : ''}`}
      style={{
        gridColumn: '1 / span 1',
        gridRow: `${startRow} / span 3`,
        zIndex: 2,
        borderTop: '1px solid var(--mantine-color-gray-3)',
        borderRight: '1px solid var(--mantine-color-gray-3)',
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        borderLeft: isSelected
          ? '3px solid var(--mantine-color-blue-6)'
          : '3px solid transparent',
        boxShadow: isSelected
          ? 'inset 0 0 0 1px rgba(37, 99, 235, 0.15)'
          : undefined,
        backgroundColor: isSelected
          ? 'var(--mantine-color-blue-0)'
          : isEvenDay
            ? 'var(--mantine-color-gray-0)'
            : 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
      }}
    >
      <Stack gap={4} align="center">
        <Box>
          <Text size="sm" fw={700}>
            {parentName ? `${parentName} Day` : 'Day'}{' '}
            {parentName
              ? dayNum - (dayNumberOffset || 0) + 1
              : dayNum}
          </Text>
          {parentName && (
            <Text size="xs" c="blue.6" fw={500}>
              (Day {dayNum})
            </Text>
          )}
        </Box>
        <Text size="xs" c="dimmed">
          {formatDate(day.date)}
        </Text>

        <Popover
          opened={opened}
          onChange={setOpened}
          withArrow
          trapFocus
          width={300}
          position="right"
          shadow="md"
          zIndex={2100}
          withinPortal
        >
          <Tooltip
            label={
              day.accommodation?.name
                ? `Staying at: ${day.accommodation.name}`
                : 'Set Accommodation'
            }
          >
            <Popover.Target>
              <ActionIcon
                variant={day.accommodation?.name ? 'filled' : 'light'}
                color={day.accommodation?.name ? 'indigo' : 'gray'}
                size="sm"
                radius="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpened((o) => !o);
                }}
              >
                <Bed size={14} />
              </ActionIcon>
            </Popover.Target>
          </Tooltip>
          <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
            <Stack gap="xs">
              <Text size="sm" fw={700}>
                Accommodation
              </Text>
              <Box style={{ position: 'relative' }}>
                <Autocomplete
                  placeholder="Search Hotel / Address..."
                  value={tempName}
                  onChange={(val) => {
                    setTempName(val);
                  }}
                  size="xs"
                  label="Name / Location"
                  data={existingAccommodations}
                  comboboxProps={{ withinPortal: false }}
                  rightSection={
                    tempLat ? (
                      <MapPin size={14} color="green" />
                    ) : (
                      <Search size={14} />
                    )
                  }
                />
                {suggestions.length > 0 && (
                  <Paper
                    withBorder
                    shadow="md"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 2200,
                      maxHeight: 150,
                      overflowY: 'auto',
                    }}
                  >
                    {suggestions.map((s) => (
                      <Box
                        key={s.place_id}
                        p="xs"
                        style={{
                          cursor: 'pointer',
                          borderBottom:
                            '1px solid var(--mantine-color-gray-2)',
                        }}
                        className="hover-bg-light"
                        onClick={() => selectSuggestion(s)}
                      >
                        <Text size="xs" fw={500}>
                          {s.display_name.split(',')[0]}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {s.display_name}
                        </Text>
                      </Box>
                    ))}
                  </Paper>
                )}
                {isSuggesting && tempName.trim().length > 2 && (
                  <Paper
                    withBorder
                    shadow="sm"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 2200,
                    }}
                  >
                    <Stack p="xs" gap="xs">
                      <Skeleton height={12} radius="xl" />
                      <Skeleton height={12} radius="xl" width="88%" />
                    </Stack>
                  </Paper>
                )}
              </Box>

              {tempLat && (
                <Text size="xs" c="dimmed" fs="italic">
                  <MapPin
                    size={10}
                    style={{ display: 'inline', marginRight: 4 }}
                  />
                  Location set ({tempLat.toFixed(4)},{' '}
                  {tempLng?.toFixed(4)})
                </Text>
              )}

              <TextInput
                placeholder="Notes / Address"
                value={tempNotes}
                onChange={(e) => setTempNotes(e.currentTarget.value)}
                size="xs"
                label="Notes"
              />
              <NumberInput
                label="Nightly Cost"
                placeholder="0.00"
                leftSection={<Euro size={12} />}
                value={tempCost}
                onChange={(val) =>
                  setTempCost(Number(val) || undefined)
                }
                size="xs"
                min={0}
                decimalScale={2}
              />
              <Group justify="space-between" gap="xs">
                {day.accommodation?.name && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={handleRemove}
                    title="Remove Accommodation"
                  >
                    <Trash size={14} />
                  </ActionIcon>
                )}
                <Group
                  gap="xs"
                  style={{ flex: 1 }}
                  justify="flex-end"
                >
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => setOpened(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="xs" onClick={handleSave}>
                    Save
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>

        <Tooltip label="Add to Day">
          <ActionIcon
            variant="light"
            size="sm"
            radius="xl"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus size={14} />
          </ActionIcon>
        </Tooltip>
      </Stack>
    </Box>
  );
}
