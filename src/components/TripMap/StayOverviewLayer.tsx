import { Marker, Polyline, Tooltip } from 'react-leaflet';
import { createStayMarkerIcon } from './markerFactories';

type TravelMode = 'train' | 'flight' | 'drive' | 'ferry' | 'bus' | 'walk';

export type OverviewStay = {
  id: string;
  name: string;
  color: string;
  centerLat: number;
  centerLng: number;
  travelModeToNext: TravelMode;
  travelDurationToNext?: string;
};

const TRAVEL_COLORS: Record<TravelMode, string> = {
  train: '#0f7a72',
  flight: '#ab3b61',
  drive: '#3567d6',
  ferry: '#3d8ec9',
  bus: '#a66318',
  walk: '#60713a',
};

const TRAVEL_LABELS: Record<TravelMode, string> = {
  train: 'Train',
  flight: 'Flight',
  drive: 'Drive',
  ferry: 'Ferry',
  bus: 'Bus',
  walk: 'Walk',
};

type StayOverviewLayerProps = {
  stays: OverviewStay[];
  onSelectStay: (stayId: string) => void;
};

export default function StayOverviewLayer({ stays, onSelectStay }: StayOverviewLayerProps) {
  return (
    <>
      {/* Travel polylines between consecutive stays */}
      {stays.map((stay, i) => {
        if (i >= stays.length - 1) return null;
        const next = stays[i + 1];
        const color = TRAVEL_COLORS[stay.travelModeToNext] ?? '#94a3b8';
        const positions: [number, number][] = [
          [stay.centerLat, stay.centerLng],
          [next.centerLat, next.centerLng],
        ];
        const label = [TRAVEL_LABELS[stay.travelModeToNext], stay.travelDurationToNext].filter(Boolean).join(' · ');

        return (
          <Polyline
            key={`travel-${stay.id}-${next.id}`}
            positions={positions}
            pathOptions={{ color, weight: 4, opacity: 0.7, dashArray: '8 5' }}
          >
            {label && (
              <Tooltip permanent direction="center" className="travel-tooltip">
                <span style={{ fontSize: 10, fontWeight: 700, color }}>{label}</span>
              </Tooltip>
            )}
          </Polyline>
        );
      })}

      {/* Stay markers */}
      {stays.map((stay) => (
        <Marker
          key={stay.id}
          position={[stay.centerLat, stay.centerLng]}
          icon={createStayMarkerIcon(stay.name, stay.color)}
          eventHandlers={{ click: () => onSelectStay(stay.id) }}
        />
      ))}
    </>
  );
}
