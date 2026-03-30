/** Great-circle distance between two lat/lng points in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Add random jitter to a number. */
export function jitter(base: number, mag: number) { return base + (Math.random() - 0.5) * mag; }

/** Constrain a number to [min, max]. */
export function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
