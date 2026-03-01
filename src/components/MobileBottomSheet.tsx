import React, { useState } from 'react';
import { Box, Paper, ActionIcon, Group, Text, Stack, Button } from '@mantine/core';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface MobileBottomSheetTab {
  key: string;
  label: string;
}

interface MobileBottomSheetProps {
  children: React.ReactNode;
  opened: boolean;
  title?: string;
  tabs?: MobileBottomSheetTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

type SheetState = 'peek' | 'half' | 'full';

export function MobileBottomSheet({
  children,
  opened,
  title = 'Itinerary',
  tabs,
  activeTab,
  onTabChange,
}: MobileBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null);

  React.useEffect(() => {
    if (opened) {
      setSheetState('half');
    }
  }, [opened]);

  React.useEffect(() => {
    if (!opened || !activeTab) return;
    if (activeTab === 'details') {
      setSheetState('full');
    }
  }, [activeTab, opened]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientY;
    const delta = touchStart - touchEnd; // Positive means swipe up

    if (Math.abs(delta) > 50) { // Threshold for swipe
      if (delta > 0) {
        // Swiped Up
        if (sheetState === 'half') setSheetState('full');
      } else {
        // Swiped Down
        if (sheetState === 'full') setSheetState('half');
        else if (sheetState === 'half') setSheetState('peek');
      }
    }
    setTouchStart(null);
    setTouchCurrent(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setTouchCurrent(e.touches[0].clientY);
  };

  const currentDelta = touchStart !== null && touchCurrent !== null ? touchStart - touchCurrent : 0;

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
        opacity: opened ? 1 : 0,
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
          onClick={() => {
            if (Math.abs(currentDelta) < 12) cycleState();
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          aria-label="Resize itinerary sheet"
          tabIndex={0}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              cycleState();
            }
          }}
          style={{ 
            cursor: 'pointer',
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            flexShrink: 0,
            touchAction: 'none',
            minHeight: 64,
          }}
        >
          <Stack gap={6} align="center" py={10}>
            <Box mb={2} style={{ width: 52, height: 6, backgroundColor: 'var(--mantine-color-gray-4)', borderRadius: 99 }} />
            <Group gap="xs" px="md" w="100%" justify="space-between">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                {title}
              </Text>
              <Group gap={6}>
                {tabs && tabs.length > 0 && (
                  <Group gap={4} wrap="nowrap">
                    {tabs.map((tab) => (
                      <Button
                        key={tab.key}
                        size="compact-xs"
                        variant={activeTab === tab.key ? 'filled' : 'light'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onTabChange?.(tab.key);
                        }}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </Group>
                )}
                <Button
                  size="compact-xs"
                  variant={sheetState === 'peek' ? 'filled' : 'light'}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSheetState('peek');
                  }}
                >
                  Peek
                </Button>
                <Button
                  size="compact-xs"
                  variant={sheetState === 'half' ? 'filled' : 'light'}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSheetState('half');
                  }}
                >
                  Half
                </Button>
                <Button
                  size="compact-xs"
                  variant={sheetState === 'full' ? 'filled' : 'light'}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSheetState('full');
                  }}
                >
                  Full
                </Button>
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
