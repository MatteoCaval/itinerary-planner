import L from 'leaflet';
import { UtensilsCrossed, Landmark, MapPin, Hotel, Compass, ShoppingBag } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';

export type VisitType = 'area' | 'landmark' | 'museum' | 'food' | 'walk' | 'hotel' | 'shopping';
export type LatLngTuple = [number, number];

const VISIT_TYPE_COLORS: Record<VisitType, string> = {
  food: '#059669',
  landmark: '#ec5b13',
  museum: '#2563eb',
  walk: '#0d9488',
  hotel: '#475569',
  area: '#7c3aed',
  shopping: '#db2777',
};

const VISIT_TYPE_ICONS: Record<VisitType, LucideIcon> = {
  food: UtensilsCrossed,
  landmark: Landmark,
  museum: Landmark,
  walk: MapPin,
  hotel: Hotel,
  area: Compass,
  shopping: ShoppingBag,
};

export const getVisitTypeColor = (type: VisitType): string =>
  VISIT_TYPE_COLORS[type] || VISIT_TYPE_COLORS.area;

export const createIcon = (type: VisitType, index: number, isSelected: boolean) => {
  const IconComponent = VISIT_TYPE_ICONS[type] || Compass;
  const baseColor = VISIT_TYPE_COLORS[type] || VISIT_TYPE_COLORS.area;
  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div class="map-marker-container ${isSelected ? 'hovered' : ''}">
        <div class="marker-circle" style="background-color: ${isSelected ? '#0d6efd' : baseColor}">
          ${renderToStaticMarkup(<IconComponent size={12} color="white" />)}
        </div>
        <div class="marker-number">${index + 1}</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

export const createAccommodationIcon = () =>
  L.divIcon({
    className: 'custom-marker-wrapper accommodation-marker',
    html: `
      <div class="map-marker-container">
        <div class="marker-circle" style="background-color: #7c3aed;">
          ${renderToStaticMarkup(<Hotel size={12} color="white" />)}
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

export const createStayMarkerIcon = (name: string, color: string, highlighted = false) =>
  L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:${highlighted ? 'scale(1.35)' : 'scale(1)'};transition:transform 0.18s ease;z-index:${highlighted ? 1000 : 1};">
      ${highlighted ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);width:40px;height:40px;border-radius:50%;background:${color};opacity:0.18;animation:stay-marker-pulse 1.5s ease-in-out infinite;"></div>` : ''}
      <div style="width:26px;height:26px;border-radius:50%;background:${color};border:${highlighted ? '3px solid white' : '2.5px solid white'};box-shadow:${highlighted ? `0 0 0 3px ${color}, 0 4px 16px rgba(0,0,0,0.35)` : '0 2px 6px rgba(0,0,0,0.25)'};display:flex;align-items:center;justify-content:center;">
        ${renderToStaticMarkup(<MapPin size={12} color="white" />)}
      </div>
      <div style="margin-top:3px;background:${highlighted ? color : 'white'};padding:1px 5px;border-radius:4px;font-size:9px;font-weight:800;color:${highlighted ? 'white' : color};white-space:nowrap;box-shadow:${highlighted ? `0 2px 8px rgba(0,0,0,0.2)` : '0 1px 3px rgba(0,0,0,0.12)'};">
        ${name}
      </div>
    </div>`,
    iconSize: [60, 46],
    iconAnchor: [30, 15],
  });

export const createClusterIcon = (count: number) =>
  L.divIcon({
    className: 'custom-marker-wrapper cluster-marker-wrapper',
    html: `<div class="cluster-marker-circle">${count}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });

export const distanceBetween = (a: LatLngTuple, b: LatLngTuple) => {
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

export const getPointAt = (positions: LatLngTuple[], t: number): LatLngTuple => {
  if (positions.length === 0) return [0, 0];
  if (positions.length === 1) return positions[0];
  if (t <= 0) return positions[0];
  if (t >= 1) return positions[positions.length - 1];

  const segmentDistances: number[] = [];
  let total = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const dist = distanceBetween(positions[i], positions[i + 1]);
    segmentDistances.push(dist);
    total += dist;
  }

  if (total === 0) return positions[0];

  let target = t * total;
  for (let i = 0; i < segmentDistances.length; i++) {
    const seg = segmentDistances[i];
    if (target > seg) {
      target -= seg;
      continue;
    }
    const ratio = seg === 0 ? 0 : target / seg;
    const start = positions[i];
    const end = positions[i + 1];
    return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
  }

  return positions[positions.length - 1];
};

export const getAngleAt = (positions: LatLngTuple[], t: number) => {
  const before = getPointAt(positions, Math.max(0, t - 0.02));
  const after = getPointAt(positions, Math.min(1, t + 0.02));
  return Math.atan2(after[0] - before[0], after[1] - before[1]) * (180 / Math.PI);
};

/** Haversine distance in km between two lat/lng points */
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
