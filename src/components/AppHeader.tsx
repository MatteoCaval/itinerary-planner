import React from 'react';
import { Group, Button, ActionIcon, Text, Box, Menu } from '@mantine/core';
import { Burger } from '@mantine/core';
import { Map as MapIcon, Download, Upload, Cloud, FileText, MoreHorizontal, History, Undo, Redo, Sparkles } from 'lucide-react';
import { ACTION_LABELS } from '../constants/actionLabels';

interface AppHeaderProps {
  opened: boolean;
  toggle: () => void;
  historyIndex: number;
  historyLength: number;
  navigateHistory: (index: number) => void;
  onOpenHistory: () => void;
  onOpenAI: () => void;
  onOpenCloud: () => void;
  onExportMarkdown: () => void;
  onImport: React.ChangeEventHandler<HTMLInputElement>;
  onExport: () => void;
  importFileInputRef: React.RefObject<HTMLInputElement>;
}

export function AppHeader({
  opened,
  toggle,
  historyIndex,
  historyLength,
  navigateHistory,
  onOpenHistory,
  onOpenAI,
  onOpenCloud,
  onExportMarkdown,
  onImport,
  onExport,
  importFileInputRef,
}: AppHeaderProps) {
  const openImportPicker = () => importFileInputRef.current?.click();

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group wrap="nowrap">
        <Burger opened={opened} onClick={toggle} size="sm" color="blue" hiddenFrom="sm" />
        <Text fw={700} fz="lg" c="blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapIcon size={20} /> <Box visibleFrom="xs">Itinerary Planner</Box>
        </Text>
      </Group>
      <Group gap="xs" visibleFrom="lg" wrap="nowrap">
        <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex - 1)} disabled={historyIndex <= 0}>
          <Undo size={18} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex + 1)} disabled={historyIndex >= historyLength - 1}>
          <Redo size={18} />
        </ActionIcon>
        <Button variant="default" size="xs" leftSection={<History size={16} />} onClick={onOpenHistory}>{ACTION_LABELS.history}</Button>
        <Button variant="light" color="blue" size="xs" leftSection={<Sparkles size={16} />} onClick={onOpenAI}>{ACTION_LABELS.aiPlanner}</Button>
        <Button variant="default" size="xs" leftSection={<FileText size={16} />} onClick={onExportMarkdown}>{ACTION_LABELS.exportMarkdown}</Button>
        <Button variant="default" size="xs" leftSection={<Upload size={16} />} onClick={openImportPicker}>{ACTION_LABELS.importJson}</Button>
        <Button variant="default" size="xs" leftSection={<Download size={16} />} onClick={onExport}>{ACTION_LABELS.exportJson}</Button>
        <Button variant="filled" color="blue" size="xs" leftSection={<Cloud size={16} />} onClick={onOpenCloud}>{ACTION_LABELS.cloudSync}</Button>
      </Group>

      <Box hiddenFrom="lg">
        <Menu shadow="md" width={220} position="bottom-end" withinPortal zIndex={4000}>
          <Menu.Target>
            <ActionIcon variant="light" size="lg">
              <MoreHorizontal size={20} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Actions</Menu.Label>
            <Menu.Item leftSection={<History size={16} />} onClick={onOpenHistory}>{ACTION_LABELS.history}</Menu.Item>
            <Menu.Item leftSection={<Sparkles size={16} />} onClick={onOpenAI} color="blue">{ACTION_LABELS.aiPlanner}</Menu.Item>
            <Menu.Item leftSection={<Cloud size={16} />} onClick={onOpenCloud}>{ACTION_LABELS.cloudSync}</Menu.Item>
            <Menu.Item leftSection={<FileText size={16} />} onClick={onExportMarkdown}>
              {ACTION_LABELS.exportMarkdown}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Data</Menu.Label>
            <Menu.Item leftSection={<Upload size={16} />} onClick={openImportPicker}>
              {ACTION_LABELS.importJson}
            </Menu.Item>
            <Menu.Item leftSection={<Download size={16} />} onClick={onExport}>
              {ACTION_LABELS.exportJson}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
      <input
        ref={importFileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onImport}
        accept=".json"
      />
    </Group>
  );
}
