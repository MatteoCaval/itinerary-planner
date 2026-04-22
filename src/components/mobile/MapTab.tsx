import type React from 'react';
import { MarkerPeekSheet } from './MarkerPeekSheet';

export interface MapTabPeek {
  name: string;
  subtitle?: string;
  openLabel?: string;
  stripeColor?: string;
}

interface MapTabProps {
  renderMap: () => React.ReactNode;
  peek: MapTabPeek | null;
  onOpenPeek: () => void;
  onDismissPeek: () => void;
}

export function MapTab({ renderMap, peek, onOpenPeek, onDismissPeek }: MapTabProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="flex-1 min-h-0 relative">{renderMap()}</div>
      <MarkerPeekSheet
        open={!!peek}
        name={peek?.name ?? ''}
        subtitle={peek?.subtitle}
        openLabel={peek?.openLabel}
        stripeColor={peek?.stripeColor}
        onOpen={onOpenPeek}
        onDismiss={onDismissPeek}
      />
    </div>
  );
}
