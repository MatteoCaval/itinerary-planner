import { useEffect, useState } from 'react';
import { Box, Text } from '@mantine/core';
import { Map as SightseeingIcon, Utensils, Bed, Train, Globe, type LucideIcon } from 'lucide-react';
import { LocationCategory } from '../types';

interface LocationThumbnailProps {
  name: string;
  category?: LocationCategory;
  imageUrl?: string;
  subLocationCount?: number;
  size?: number;
  radius?: number;
  showSubLocationCount?: boolean;
  showIconFallback?: boolean;
  className?: string;
}

const CATEGORY_ICONS: Record<LocationCategory, LucideIcon> = {
  sightseeing: SightseeingIcon,
  dining: Utensils,
  hotel: Bed,
  transit: Train,
  other: Globe,
};

const CATEGORY_BACKGROUNDS: Record<LocationCategory, string> = {
  sightseeing: 'linear-gradient(135deg, rgba(59, 130, 246, 0.22), rgba(37, 99, 235, 0.4))',
  dining: 'linear-gradient(135deg, rgba(249, 115, 22, 0.24), rgba(194, 65, 12, 0.4))',
  hotel: 'linear-gradient(135deg, rgba(99, 102, 241, 0.24), rgba(79, 70, 229, 0.4))',
  transit: 'linear-gradient(135deg, rgba(34, 197, 94, 0.24), rgba(21, 128, 61, 0.4))',
  other: 'linear-gradient(135deg, rgba(107, 114, 128, 0.24), rgba(75, 85, 99, 0.4))',
};

export function LocationThumbnail({
  name,
  category = 'sightseeing',
  imageUrl,
  subLocationCount = 0,
  size = 44,
  radius = 10,
  showSubLocationCount = false,
  showIconFallback = true,
  className,
}: LocationThumbnailProps) {
  const [primaryImageFailed, setPrimaryImageFailed] = useState(false);
  const Icon = CATEGORY_ICONS[category];
  const resolvedImageUrl = !primaryImageFailed && imageUrl ? imageUrl : null;

  const hasImage = Boolean(resolvedImageUrl);

  useEffect(() => {
    setPrimaryImageFailed(false);
  }, [imageUrl]);

  return (
    <Box
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: radius,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-gray-3)',
        background: hasImage ? 'var(--mantine-color-gray-1)' : CATEGORY_BACKGROUNDS[category],
      }}
      title={name}
    >
      {hasImage ? (
        <Box
          component="img"
          src={resolvedImageUrl || undefined}
          alt={name}
          loading="lazy"
          w="100%"
          h="100%"
          style={{ objectFit: 'cover', display: 'block' }}
          onError={() => {
            if (!primaryImageFailed && imageUrl) setPrimaryImageFailed(true);
          }}
        />
      ) : showIconFallback ? (
        <Box
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <Icon size={Math.max(14, Math.floor(size * 0.42))} />
        </Box>
      ) : null}

      {showSubLocationCount && subLocationCount > 0 && (
        <Text
          size="10px"
          fw={700}
          c="white"
          style={{
            position: 'absolute',
            right: 3,
            bottom: 3,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 999,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
          }}
        >
          +{subLocationCount}
        </Text>
      )}
    </Box>
  );
}
