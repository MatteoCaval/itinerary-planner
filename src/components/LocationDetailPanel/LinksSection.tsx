import React, { useState } from 'react';
import { Box, Group, Text, Stack, ActionIcon, TextInput, Anchor } from '@mantine/core';
import { Link as LinkIcon, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Location } from '../../types';

interface LinksSectionProps {
  location: Location;
  onUpdate: (id: string, updates: Partial<Location>) => void;
}

export const LinksSection = React.memo(function LinksSection({
  location,
  onUpdate,
}: LinksSectionProps) {
  const [newLink, setNewLink] = useState({ label: '', url: '' });

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.url.trim()) return;
    const newItem = {
      id: uuidv4(),
      label: newLink.label || newLink.url,
      url: newLink.url,
    };
    onUpdate(location.id, { links: [...(location.links || []), newItem] });
    setNewLink({ label: '', url: '' });
  };

  const removeLink = (linkId: string) => {
    const updated = (location.links || []).filter((item) => item.id !== linkId);
    onUpdate(location.id, { links: updated });
  };

  return (
    <Box mb="xl">
      <Group gap={6} mb="xs">
        <LinkIcon size={12} />
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Helpful Links
        </Text>
      </Group>

      <Stack gap="xs" mb="sm">
        {(location.links || []).map((link) => (
          <Group key={link.id} gap="sm" align="center" wrap="nowrap">
            <ExternalLink size={14} className="text-muted" />
            <Anchor
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              truncate
              style={{ flex: 1 }}
            >
              {link.label}
            </Anchor>
            <ActionIcon
              variant="transparent"
              color="red"
              size="xs"
              onClick={() => removeLink(link.id)}
              opacity={0.5}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <form onSubmit={handleAddLink}>
        <Stack gap="xs">
          <TextInput
            size="xs"
            placeholder="Link Label (e.g. Booking.com)"
            value={newLink.label}
            onChange={(e) =>
              setNewLink({ ...newLink, label: e.target.value })
            }
          />
          <Group gap="xs">
            <TextInput
              style={{ flex: 1 }}
              size="xs"
              placeholder="URL..."
              value={newLink.url}
              onChange={(e) =>
                setNewLink({ ...newLink, url: e.target.value })
              }
            />
            <ActionIcon type="submit" variant="filled" size="sm">
              <Plus size={16} />
            </ActionIcon>
          </Group>
        </Stack>
      </form>
    </Box>
  );
});
