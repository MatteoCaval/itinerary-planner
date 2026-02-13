import React, { useState, useEffect } from 'react';
import { Box } from '@mantine/core';
import { Day } from '../../types';

export const CurrentTimeLine = React.memo(function CurrentTimeLine({
  days,
}: {
  days: Day[];
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const nowStr = now.toISOString().split('T')[0];
  const dayIndex = days.findIndex((d) => d.date === nowStr);

  if (dayIndex === -1) return null;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  let slotOffset = 0;
  let percentInSlot = 0;

  if (totalMinutes < 480) {
    slotOffset = 0;
    percentInSlot = 0;
  } else if (totalMinutes < 720) {
    slotOffset = 0;
    percentInSlot = (totalMinutes - 480) / 240;
  } else if (totalMinutes < 1080) {
    slotOffset = 1;
    percentInSlot = (totalMinutes - 720) / 360;
  } else {
    slotOffset = 2;
    percentInSlot = (totalMinutes - 1080) / 360;
  }

  const startRow = dayIndex * 3 + 1 + slotOffset;

  return (
    <Box
      style={{
        gridColumn: '2 / -1',
        gridRow: `${startRow} / span 1`,
        top: `${percentInSlot * 100}%`,
        zIndex: 15,
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'var(--mantine-color-red-filled)',
        pointerEvents: 'none',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          left: -45,
          top: -10,
          backgroundColor: 'var(--mantine-color-red-filled)',
          color: 'white',
          fontSize: 10,
          padding: '2px 4px',
          borderRadius: 4,
          fontWeight: 'bold',
        }}
      >
        {now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Box>
      <Box
        style={{
          position: 'absolute',
          left: 0,
          top: -4,
          width: 10,
          height: 10,
          backgroundColor: 'var(--mantine-color-red-filled)',
          borderRadius: '50%',
        }}
      />
    </Box>
  );
});
