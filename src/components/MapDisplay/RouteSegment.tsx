import React from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ChevronRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Route, TRANSPORT_COLORS, TRANSPORT_LABELS } from '../../types';
import { LatLngTuple } from '../../utils/routing';
import { getPointAt, getAngleAt } from './markerFactories';

export interface PathPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isAccommodation: boolean;
  sortValue: number;
}

interface RouteSegmentProps {
  from: PathPoint;
  to: PathPoint;
  route?: Route;
  path?: LatLngTuple[] | null;
  onEditRoute: () => void;
  isHovered: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  showArrows?: boolean;
}

export const RouteSegment = React.memo(function RouteSegment({
  from,
  to,
  route,
  path,
  onEditRoute,
  isHovered,
  isHighlighted = false,
  isDimmed = false,
  showArrows = true,
}: RouteSegmentProps) {
  const positions: LatLngTuple[] = (path && path.length > 1)
    ? path
    : [[from.lat, from.lng], [to.lat, to.lng]];
  const color = isHighlighted ? '#c2410c' : route ? TRANSPORT_COLORS[route.transportType] : '#6b7280';
  const label = route ? TRANSPORT_LABELS[route.transportType].split(' ')[0] : '\u{1F517}';
  const buildTooltip = () => {
    const parts = [route ? TRANSPORT_LABELS[route.transportType] : '\u{1F517}'];
    if (route?.duration) parts.push(`\u23F1 ${route.duration}`);
    return parts.join(' \u2022 ');
  };
  return (
    <>
      <Polyline
        positions={positions}
        color={isHovered ? '#0d6efd' : color}
        weight={isHighlighted ? 6 : 4}
        opacity={isDimmed ? 0.2 : isHovered ? 1 : isHighlighted ? 0.95 : 0.6}
        dashArray={route ? undefined : '5, 10'}
        eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onEditRoute(); } }}
      >
        <Tooltip permanent={false} direction="center" className="route-tooltip"><div className="route-tooltip-content">{buildTooltip()}</div></Tooltip>
      </Polyline>
      <Marker
        position={getPointAt(positions, 0.5)}
        icon={L.divIcon({
          className: 'transport-midpoint-icon',
          html: `<div class="midpoint-badge ${isHovered ? 'hovered' : ''}" style="opacity:${isDimmed ? '0.35' : '1'}">${label}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })}
        eventHandlers={{ click: onEditRoute }}
      />
      {showArrows && [0.2, 0.4, 0.6, 0.8].map(offset => {
        const point = getPointAt(positions, offset);
        const segmentAngle = getAngleAt(positions, offset);
        return (
          <Marker
            key={offset}
            position={point}
            icon={L.divIcon({
              className: 'route-arrow-icon',
              html: `<div style="transform: rotate(${-segmentAngle}deg); color: ${isHovered ? '#0d6efd' : color}; display: flex; align-items: center; justify-content: center; opacity: ${isDimmed ? '0.25' : '0.9'};">${renderToStaticMarkup(<ChevronRight size={isHovered ? 24 : 20} strokeWidth={5} />)}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
            interactive={false}
          />
        );
      })}
    </>
  );
});
