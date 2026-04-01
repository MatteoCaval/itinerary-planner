import React from 'react';
import {
  Train,
  Plane,
  Car,
  Ship,
  Bus,
  Footprints,
  Landmark,
  Palette,
  UtensilsCrossed,
  ShoppingBag,
  MapPin,
} from 'lucide-react';
import type { TravelMode, VisitType } from '@/domain/types';

export default function TransportIcon({
  mode,
  className = 'w-3.5 h-3.5',
}: {
  mode: TravelMode;
  className?: string;
}) {
  const icons: Record<TravelMode, React.ReactNode> = {
    train: <Train className={className} />,
    flight: <Plane className={className} />,
    drive: <Car className={className} />,
    ferry: <Ship className={className} />,
    bus: <Bus className={className} />,
    walk: <Footprints className={className} />,
  };
  return <>{icons[mode]}</>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getVisitTypeIcon(type: VisitType, cls = 'w-4 h-4') {
  switch (type) {
    case 'landmark':
      return <Landmark className={cls} />;
    case 'museum':
      return <Palette className={cls} />;
    case 'food':
      return <UtensilsCrossed className={cls} />;
    case 'walk':
      return <Footprints className={cls} />;
    case 'shopping':
      return <ShoppingBag className={cls} />;
    default:
      return <MapPin className={cls} />;
  }
}
