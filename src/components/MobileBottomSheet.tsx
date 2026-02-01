import React, { useState } from 'react';
import { Box, Paper, ActionIcon, Group, Text } from '@mantine/core';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MobileBottomSheetProps {
  children: React.ReactNode;
  opened: boolean;
}

type SheetState = 'peek' | 'half' | 'full';

export function MobileBottomSheet({ children, opened }: MobileBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('half');

  React.useEffect(() => {
    if (opened) {
        setSheetState('half');
    }
  }, [opened]);

  const getHeight = () => {
    if (!opened) return '0px';
    switch (sheetState) {
      case 'peek': return '200px';
      case 'half': return '60vh';
      case 'full': return '95vh';
    }
  };

  const cycleState = () => {
    if (sheetState === 'half') setSheetState('full');
    else if (sheetState === 'full') setSheetState('half');
    else setSheetState('half');
  };

  return (
    <Box
      hiddenFrom="sm"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1050,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: getHeight(),
        transform: opened ? 'translateY(0)' : 'translateY(100%)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Paper
        shadow="xl"
        withBorder
        style={{
          height: '100%',
          borderBottom: 0,
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white'
        }}
      >
        {/* Handle / Header */}
        <Box 
          p={0} 
          onClick={cycleState}
          style={{ 
            cursor: 'pointer',
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            flexShrink: 0
          }}
        >
          <Stack gap={0} align="center" py={8}>
            <Box mb={4} style={{ width: 40, height: 4, backgroundColor: 'var(--mantine-color-gray-3)', borderRadius: 2 }} />
            <Group gap="xs" px="md" w="100%" justify="space-between">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">Itinerary</Text>
                <Group gap={4}>
                    <ActionIcon variant="subtle" color="gray" size="sm">
                        {sheetState === 'full' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </ActionIcon>
                </Group>
            </Group>
          </Stack>
        </Box>

        {/* Content */}
        <Box style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </Box>
      </Paper>
    </Box>
  );
}

// Re-importing Stack to avoid error
import { Stack } from '@mantine/core';
