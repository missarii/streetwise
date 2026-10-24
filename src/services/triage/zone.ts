// src/services/triage/zone.ts
// Point-in-polygon zone assignment for Colombo's 6 zones.
// Returns the zone ID whose polygon contains the point,
// or the nearest zone centroid if none contains it.

export interface ZoneRecord {
  id: string;
  polygon: [number, number][]; // [lng, lat]
}

/** Ray-casting algorithm to test if (lng, lat) is inside a polygon. */
function pointInPolygon(lng: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Euclidean distance squared between point and polygon centroid. */
function distanceSquared(lng: number, lat: number, polygon: [number, number][]): number {
  const centLng = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const centLat = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
  return (lng - centLng) ** 2 + (lat - centLat) ** 2;
}

/**
 * Given a lat/lng and the zone records (with parsed polygons),
 * returns the best-matching zone ID.
 */
export function findZone(lat: number, lng: number, zones: ZoneRecord[]): string {
  // First: exact containment
  for (const zone of zones) {
    if (pointInPolygon(lng, lat, zone.polygon)) return zone.id;
  }
  // Fallback: nearest centroid
  let nearest = zones[0];
  let minDist = distanceSquared(lng, lat, zones[0].polygon);
  for (const zone of zones.slice(1)) {
    const d = distanceSquared(lng, lat, zone.polygon);
    if (d < minDist) { minDist = d; nearest = zone; }
  }
  return nearest.id;
}

/** Parse zone polygon from the JSON string stored in D1. */
export function parseZonePolygon(polygonJson: string): [number, number][] {
  return JSON.parse(polygonJson) as [number, number][];
}
