import L from 'leaflet';
import { Map as SightseeingIcon, Utensils, Bed, Train, Globe, LucideIcon } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Location, LocationCategory, CATEGORY_COLORS } from '../../types';
import { LatLngTuple } from '../../utils/routing';

export const CATEGORY_ICONS: Record<LocationCategory, LucideIcon> = {
  sightseeing: SightseeingIcon, dining: Utensils, hotel: Bed, transit: Train, other: Globe
};

export const createIcon = (loc: Location, index: number, isHovered: boolean) => {
  const IconComponent = CATEGORY_ICONS[loc.category || 'sightseeing'];
  const baseColor = CATEGORY_COLORS[loc.category || 'sightseeing'];
  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div class="map-marker-container ${isHovered ? 'hovered' : ''}">
        <div class="marker-circle" style="background-color: ${isHovered ? '#0d6efd' : baseColor}">
          ${renderToStaticMarkup(<IconComponent size={12} color="white" />)}
        </div>
        <div class="marker-number">${index + 1}</div>
      </div>
    `,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
};

export const createAccommodationIcon = () => L.divIcon({
  className: 'custom-marker-wrapper accommodation-marker',
  html: `
    <div class="map-marker-container">
      <div class="marker-circle" style="background-color: #6610f2;">
        ${renderToStaticMarkup(<Bed size={12} color="white" />)}
      </div>
    </div>
  `,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

export const createClusterIcon = (count: number) => L.divIcon({
  className: 'custom-marker-wrapper cluster-marker-wrapper',
  html: `<div class="cluster-marker-circle">${count}</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

export const distanceBetween = (a: LatLngTuple, b: LatLngTuple) => {
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  return Math.sqrt((dLat * dLat) + (dLng * dLng));
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
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }

  return positions[positions.length - 1];
};

export const getAngleAt = (positions: LatLngTuple[], t: number) => {
  const before = getPointAt(positions, Math.max(0, t - 0.02));
  const after = getPointAt(positions, Math.min(1, t + 0.02));
  return Math.atan2(after[0] - before[0], after[1] - before[1]) * (180 / Math.PI);
};
