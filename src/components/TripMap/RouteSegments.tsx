import React, { useMemo } from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ChevronRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getPointAt, getAngleAt, haversineKm } from './markerFactories';
import type { LatLngTuple } from './markerFactories';
import { useRouteGeometry } from '../../hooks/useRouteGeometry';
import type { TravelMode as TransportType } from '../../domain/types';

interface VisitPoint {
  id: string;
  lat: number;
  lng: number;
}

interface AccommodationPoint {
  lat: number;
  lng: number;
}

interface RouteSegmentsProps {
  visits: VisitPoint[];
  accommodation?: AccommodationPoint | null;
  showArrows: boolean;
}

interface SegmentData {
  key: string;
  from: VisitPoint;
  to: VisitPoint;
  isAccommodationSegment: boolean;
  transportType: TransportType;
}

const SingleSegment = React.memo(function SingleSegment({
  positions,
  isAccommodationSegment,
  showArrows,
}: {
  positions: LatLngTuple[];
  isAccommodationSegment: boolean;
  showArrows: boolean;
}) {
  const color = isAccommodationSegment ? '#7c3aed' : '#94a3b8';
  return (
    <>
      <Polyline positions={positions} color={color} weight={3} opacity={0.6} dashArray="5, 10">
        <Tooltip permanent={false} direction="center" className="route-tooltip">
          <div className="route-tooltip-content">
            {isAccommodationSegment ? 'Hotel route' : 'Walking route'}
          </div>
        </Tooltip>
      </Polyline>
      {/* Midpoint dot */}
      <Marker
        position={getPointAt(positions, 0.5)}
        icon={L.divIcon({
          className: 'transport-midpoint-icon',
          html: `<div class="midpoint-badge" style="width:8px;height:8px;border-radius:50%;background:${color}"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        })}
        interactive={false}
      />
      {showArrows &&
        [0.2, 0.4, 0.6, 0.8].map((offset) => {
          const point = getPointAt(positions, offset);
          const segmentAngle = getAngleAt(positions, offset);
          return (
            <Marker
              key={offset}
              position={point}
              icon={L.divIcon({
                className: 'route-arrow-icon',
                html: `<div style="transform: rotate(${-segmentAngle}deg); color: ${color}; display: flex; align-items: center; justify-content: center; opacity: 0.9;">${renderToStaticMarkup(<ChevronRight size={20} strokeWidth={5} />)}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
              interactive={false}
            />
          );
        })}
    </>
  );
});

export function RouteSegments({ visits, accommodation, showArrows }: RouteSegmentsProps) {
  const segments = useMemo<SegmentData[]>(() => {
    const result: SegmentData[] = [];

    // Accommodation → first visit
    if (accommodation && visits.length > 0) {
      const first = visits[0];
      if (accommodation.lat !== first.lat || accommodation.lng !== first.lng) {
        result.push({
          key: `acc-start|${first.id}`,
          from: { id: 'acc-start', lat: accommodation.lat, lng: accommodation.lng },
          to: first,
          isAccommodationSegment: true,
          transportType: 'walk' as TransportType,
        });
      }
    }

    // Visit-to-visit segments
    for (let i = 0; i < visits.length - 1; i++) {
      const from = visits[i];
      const to = visits[i + 1];
      if (from.lat === to.lat && from.lng === to.lng) continue;
      const dist = haversineKm(from.lat, from.lng, to.lat, to.lng);
      result.push({
        key: `${from.id}|${to.id}`,
        from,
        to,
        isAccommodationSegment: false,
        transportType: (dist > 2 ? 'car' : 'walk') as TransportType,
      });
    }

    // Last visit → accommodation
    if (accommodation && visits.length > 0) {
      const last = visits[visits.length - 1];
      if (accommodation.lat !== last.lat || accommodation.lng !== last.lng) {
        result.push({
          key: `${last.id}|acc-end`,
          from: last,
          to: { id: 'acc-end', lat: accommodation.lat, lng: accommodation.lng },
          isAccommodationSegment: true,
          transportType: 'walk' as TransportType,
        });
      }
    }

    return result;
  }, [visits, accommodation]);

  const routeGeometryInput = useMemo(
    () =>
      segments.map((s) => ({
        key: s.key,
        from: { lat: s.from.lat, lng: s.from.lng },
        to: { lat: s.to.lat, lng: s.to.lng },
        transportType: s.transportType,
      })),
    [segments],
  );

  const routeShapes = useRouteGeometry(routeGeometryInput);

  return (
    <>
      {segments.map((segment) => {
        const path = routeShapes[segment.key];
        const positions: LatLngTuple[] =
          path && path.length > 1
            ? path
            : [
                [segment.from.lat, segment.from.lng],
                [segment.to.lat, segment.to.lng],
              ];
        return (
          <SingleSegment
            key={segment.key}
            positions={positions}
            isAccommodationSegment={segment.isAccommodationSegment}
            showArrows={showArrows}
          />
        );
      })}
    </>
  );
}
