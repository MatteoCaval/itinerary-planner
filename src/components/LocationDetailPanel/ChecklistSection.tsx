import React, { useState } from 'react';
import { Box, Group, Text, Badge, Stack, Checkbox, ActionIcon, TextInput } from '@mantine/core';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Location } from '../../types';

interface ChecklistSectionProps {
  location: Location;
  onUpdate: (id: string, updates: Partial<Location>) => void;
}

export const ChecklistSection = React.memo(function ChecklistSection({
  location,
  onUpdate,
}: ChecklistSectionProps) {
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    const newItem = { id: uuidv4(), text: newChecklistItem, completed: false };
    onUpdate(location.id, { checklist: [...(location.checklist || []), newItem] });
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    onUpdate(location.id, { checklist: updated });
  };

  const removeChecklistItem = (itemId: string) => {
    const updated = (location.checklist || []).filter((item) => item.id !== itemId);
    onUpdate(location.id, { checklist: updated });
  };

  return (
    <Box mb="xl">
      <Group justify="space-between" mb="xs">
        <Group gap={6}>
          <CheckSquare size={14} />
          <Text size="sm" fw={600} c="var(--app-ink)">
            Checklist
          </Text>
        </Group>
        <Badge color="gray" size="sm">
          {(location.checklist || []).filter((i) => i.completed).length}/
          {(location.checklist || []).length}
        </Badge>
      </Group>

      <Stack gap="xs" mb="sm">
        {(location.checklist || []).map((item) => (
          <Group key={item.id} gap="sm" align="center" wrap="nowrap">
            <Checkbox
              checked={item.completed}
              onChange={() => toggleChecklistItem(item.id)}
            />
            <Text
              size="sm"
              td={item.completed ? 'line-through' : undefined}
              c={item.completed ? 'dimmed' : undefined}
              style={{ flex: 1, lineHeight: 1.2 }}
            >
              {item.text}
            </Text>
            <ActionIcon
              variant="transparent"
              color="red"
              size="xs"
              onClick={() => removeChecklistItem(item.id)}
              opacity={0.5}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <form onSubmit={handleAddChecklistItem}>
        <Group gap="xs">
          <TextInput
            style={{ flex: 1 }}
            size="xs"
            placeholder="Add task..."
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
          />
          <ActionIcon type="submit" variant="filled" size="sm">
            <Plus size={16} />
          </ActionIcon>
        </Group>
      </form>
    </Box>
  );
});
