// Fixed-reference-latitude equirectangular projection, good enough at Bay
// Area scale for local distance/offset math. Matches Map.svelte's map
// center latitude.
const REFERENCE_LATITUDE = 37.6;
const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LON = 111_320 * Math.cos((REFERENCE_LATITUDE * Math.PI) / 180);

export function toLocalMeters([lon, lat]) {
  return [lon * METERS_PER_DEG_LON, lat * METERS_PER_DEG_LAT];
}

export function fromLocalMeters([x, y]) {
  return [x / METERS_PER_DEG_LON, y / METERS_PER_DEG_LAT];
}

export function distanceMeters(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function arcLengthMeters(lineCoordsLonLat) {
  let length = 0;
  for (let i = 1; i < lineCoordsLonLat.length; i++) {
    length += distanceMeters(toLocalMeters(lineCoordsLonLat[i - 1]), toLocalMeters(lineCoordsLonLat[i]));
  }
  return length;
}
