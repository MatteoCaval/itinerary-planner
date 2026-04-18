import { useMemo } from 'react';
import { Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ChevronRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createStayMarkerIcon, getPointAt, getAngleAt } from './markerFactories';
import { useRouteGeometry } from '../../hooks/useRouteGeometry';
import type { TravelMode as TransportType } from '../../domain/types';

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

export type OverviewCandidate = {
  id: string;
  name: string;
  color: string;
  centerLat: number;
  centerLng: number;
};

const TRAVEL_COLORS: Record<TravelMode, string> = {
  train: '#0f7a72',
  flight: '#ab3b61',
  drive: '#3567d6',
  ferry: '#3d8ec9',
  bus: '#a66318',
  walk: '#60713a',
};

const TRAVEL_EMOJI: Record<TravelMode, string> = {
  train: '🚆',
  flight: '✈️',
  drive: '🚗',
  ferry: '⛴️',
  bus: '🚌',
  walk: '🚶',
};

// flight/ferry use straight lines — OSRM road routing doesn't apply
const STRAIGHT_LINE_MODES = new Set<TravelMode>(['flight', 'ferry']);

function toTransportType(mode: TravelMode): TransportType {
  return mode;
}

type StayOverviewLayerProps = {
  stays: OverviewStay[];
  candidateStays?: OverviewCandidate[];
  onSelectStay: (stayId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  expanded?: boolean;
  highlightedStayId?: string | null;
  highlightedCandidateId?: string | null;
  showRouteIcons?: boolean;
};

export default function StayOverviewLayer({
  stays,
  candidateStays,
  onSelectStay,
  onSelectCandidate,
  expanded = false,
  highlightedStayId,
  highlightedCandidateId: _highlightedCandidateId,
  showRouteIcons = false,
}: StayOverviewLayerProps) {
  const map = useMap();
  const segments = useMemo(
    () =>
      stays
        .slice(0, -1)
        .map((stay, i) => ({
          key: `${stay.id}|${stays[i + 1].id}`,
          from: { lat: stay.centerLat, lng: stay.centerLng },
          to: { lat: stays[i + 1].centerLat, lng: stays[i + 1].centerLng },
          transportType: toTransportType(stay.travelModeToNext),
        }))
        .filter((_, i) => !STRAIGHT_LINE_MODES.has(stays[i].travelModeToNext)),
    [stays],
  );

  const routeShapes = useRouteGeometry(segments);

  return (
    <>
      {stays.slice(0, -1).map((stay, i) => {
        const next = stays[i + 1];
        const color = TRAVEL_COLORS[stay.travelModeToNext] ?? '#94a3b8';
        const segKey = `${stay.id}|${next.id}`;
        const straight: [number, number][] = [
          [stay.centerLat, stay.centerLng],
          [next.centerLat, next.centerLng],
        ];
        const positions: [number, number][] = STRAIGHT_LINE_MODES.has(stay.travelModeToNext)
          ? straight
          : (routeShapes[segKey] ?? straight);

        const emoji = TRAVEL_EMOJI[stay.travelModeToNext];
        const chipLabel =
          expanded && stay.travelDurationToNext ? `${emoji} ${stay.travelDurationToNext}` : emoji;

        return (
          <Polyline
            key={segKey}
            positions={positions}
            pathOptions={{
              color,
              weight: 3,
              opacity: 0.7,
              dashArray: STRAIGHT_LINE_MODES.has(stay.travelModeToNext) ? '8 6' : undefined,
            }}
          >
            {stay.travelDurationToNext && (
              <Tooltip sticky className="route-tooltip">
                <div className="route-tooltip-content">
                  {emoji} {stay.travelDurationToNext}
                </div>
              </Tooltip>
            )}
            {[0.25, 0.75].map((t) => {
              const point = getPointAt(positions, t);
              const angle = getAngleAt(positions, t);
              return (
                <Marker
                  key={t}
                  position={point}
                  icon={L.divIcon({
                    className: 'route-arrow-icon',
                    html: `<div style="transform:rotate(${-angle}deg);color:${color};display:flex;align-items:center;justify-content:center;opacity:0.85;">${renderToStaticMarkup(<ChevronRight size={20} strokeWidth={5} />)}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                  })}
                  interactive={false}
                />
              );
            })}
            {showRouteIcons && (
              <Marker
                position={getPointAt(positions, 0.5)}
                icon={L.divIcon({
                  className: 'transport-midpoint-icon',
                  html: `<div style="position:absolute;transform:translate(-50%,-50%);background:white;border:1.5px solid ${color};border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;color:${color};white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.12);">${chipLabel}</div>`,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0],
                })}
                interactive={false}
              />
            )}
          </Polyline>
        );
      })}

      {stays.map((stay) => (
        <Marker
          key={stay.id}
          position={[stay.centerLat, stay.centerLng]}
          icon={createStayMarkerIcon(stay.name, stay.color, highlightedStayId === stay.id)}
          eventHandlers={{
            click: () => {
              map.flyTo([stay.centerLat, stay.centerLng], 11, { duration: 0.5 });
              onSelectStay(stay.id);
            },
          }}
        />
      ))}

      {(candidateStays ?? []).map((c) => (
        <Marker
          key={`candidate-${c.id}`}
          position={[c.centerLat, c.centerLng]}
          icon={L.divIcon({
            className: 'candidate-marker',
            html: `<div style="width:28px;height:28px;border-radius:50%;border:2px dashed ${c.color};background:white;opacity:0.75;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.15);"><span style="font-size:10px;font-weight:700;color:${c.color};">${c.name.slice(0, 2).toUpperCase()}</span></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })}
          eventHandlers={{
            click: () => {
              map.flyTo([c.centerLat, c.centerLng], 11, { duration: 0.5 });
              onSelectCandidate?.(c.id);
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            <strong>{c.name}</strong> · in inbox
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
