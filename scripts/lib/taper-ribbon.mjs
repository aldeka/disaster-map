// Builds a variable-width polygon "ribbon" along a line: constant
// widthMeters through the middle, tapering linearly to a point at each true
// end over taperLengthMeters. Tapering to a literal point falls straight
// out of the offset math (offset magnitude -> 0 at both endpoints, so the
// left/right offset points coincide there) -- no cap special-casing needed.
import { toLocalMeters, fromLocalMeters } from "./project.mjs";

// Bounds how far a sharp interior kink's offset can spike outward (a plain
// bisector bevels toward infinity as the angle approaches a full reversal).
// Past this limit, fall back to a bevel (use the outgoing segment's own
// normal) instead of an oversized miter point -- the standard SVG/Cairo
// miter-limit strategy, applied here as one more guard (alongside the
// pre-simplify pass in buildRibbonPolygon) against the offset ring
// self-intersecting at sharp real bends.
const MITER_LIMIT = 4;

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}
function scale(a, s) {
  return [a[0] * s, a[1] * s];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
function unit([x, y]) {
  const len = Math.hypot(x, y);
  return len === 0 ? [0, 0] : [x / len, y / len];
}
function perpendicular([x, y]) {
  return [-y, x];
}

function dedupeNearDuplicates(pointsXY, epsilonMeters) {
  const result = [pointsXY[0]];
  for (let i = 1; i < pointsXY.length; i++) {
    const prev = result[result.length - 1];
    if (Math.hypot(pointsXY[i][0] - prev[0], pointsXY[i][1] - prev[1]) > epsilonMeters) {
      result.push(pointsXY[i]);
    }
  }
  return result;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}

// Removes digitization jitter (the main source of spurious sharp local
// angles that could make the offset ring self-intersect) while preserving
// real geologic bends.
export function douglasPeucker(pointsXY, epsilonMeters) {
  if (pointsXY.length < 3) return pointsXY;
  let maxDist = 0;
  let maxIndex = 0;
  const start = pointsXY[0];
  const end = pointsXY[pointsXY.length - 1];
  for (let i = 1; i < pointsXY.length - 1; i++) {
    const d = perpendicularDistance(pointsXY[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }
  if (maxDist <= epsilonMeters) return [start, end];
  const left = douglasPeucker(pointsXY.slice(0, maxIndex + 1), epsilonMeters);
  const right = douglasPeucker(pointsXY.slice(maxIndex), epsilonMeters);
  return left.slice(0, -1).concat(right);
}

function cumulativeLengths(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return cum;
}

// Douglas-Peucker drops collinear interior vertices, so a straight (or
// straight-ish) dash can simplify down to just its two endpoints -- with no
// sample point left where the taper ramp reaches full width. Without one,
// the whole ribbon would compute as tapering the entire way and never reach
// widthMeters. Explicitly insert a vertex at each taper transition distance
// (interpolated onto whatever segment it falls on) so the per-vertex loop
// always has a point to anchor full width at.
function insertPointAtDistance(pts, cum, targetDist, epsilonMeters = 1) {
  for (const d of cum) {
    if (Math.abs(d - targetDist) <= epsilonMeters) return { pts, cum };
  }
  let k = 0;
  while (k < cum.length - 1 && cum[k + 1] < targetDist) k++;
  const segLen = cum[k + 1] - cum[k];
  const t = segLen === 0 ? 0 : (targetDist - cum[k]) / segLen;
  const inserted = [pts[k][0] + t * (pts[k + 1][0] - pts[k][0]), pts[k][1] + t * (pts[k + 1][1] - pts[k][1])];
  const newPts = pts.slice(0, k + 1).concat([inserted], pts.slice(k + 1));
  const newCum = cum.slice(0, k + 1).concat([targetDist], cum.slice(k + 1));
  return { pts: newPts, cum: newCum };
}

// Shared prep for both the fill ribbon and the stroke-segment fallback
// below: simplify, then guarantee a vertex sits exactly at each taper
// transition distance so both consumers agree on where "full width" starts.
function prepareProfile(lineCoordsLonLat, { taperLengthMeters, simplifyToleranceMeters }) {
  let pts = dedupeNearDuplicates(lineCoordsLonLat.map(toLocalMeters), 0.5);
  if (pts.length < 2) return null;
  pts = douglasPeucker(pts, simplifyToleranceMeters);
  if (pts.length < 2) return null;

  let cum = cumulativeLengths(pts);
  const length = cum[cum.length - 1];
  if (length === 0) return null;

  const effectiveTaper = Math.min(taperLengthMeters, length / 2);
  ({ pts, cum } = insertPointAtDistance(pts, cum, effectiveTaper));
  ({ pts, cum } = insertPointAtDistance(pts, cum, length - effectiveTaper));

  return { pts, cum, length, effectiveTaper };
}

function taperFactorAt(cumDistance, length, effectiveTaper) {
  const distFromNearestEnd = Math.min(cumDistance, length - cumDistance);
  return Math.min(Math.max(distFromNearestEnd / effectiveTaper, 0), 1);
}

export function buildRibbonPolygon(
  lineCoordsLonLat,
  { widthMeters, taperLengthMeters, simplifyToleranceMeters = 5 },
) {
  const profile = prepareProfile(lineCoordsLonLat, { taperLengthMeters, simplifyToleranceMeters });
  if (!profile) return null;
  const { pts, cum, length, effectiveTaper } = profile;
  const halfWidth = widthMeters / 2;
  const n = pts.length;

  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    let normal;
    let miter = 1;
    if (i === 0) {
      normal = perpendicular(unit(sub(pts[1], pts[0])));
    } else if (i === n - 1) {
      normal = perpendicular(unit(sub(pts[i], pts[i - 1])));
    } else {
      const nIn = perpendicular(unit(sub(pts[i], pts[i - 1])));
      const nOut = perpendicular(unit(sub(pts[i + 1], pts[i])));
      let bisector = unit(add(nIn, nOut));
      if (bisector[0] === 0 && bisector[1] === 0) {
        // dirIn/dirOut point directly opposite each other (a doubled-back
        // point) -- no well-defined bisector, fall back to the outgoing
        // segment's own normal.
        bisector = nOut;
      }
      const cosHalfAngle = dot(bisector, nOut);
      if (cosHalfAngle < 1 / MITER_LIMIT) {
        normal = nOut; // bevel
      } else {
        normal = bisector;
        miter = 1 / cosHalfAngle;
      }
    }

    const taperFactor = taperFactorAt(cum[i], length, effectiveTaper);
    const offset = halfWidth * taperFactor * miter;

    left.push(add(pts[i], scale(normal, offset)));
    right.push(add(pts[i], scale(normal, -offset)));
  }

  const ringXY = left.concat(right.reverse());
  ringXY.push(ringXY[0]);
  return { type: "Polygon", coordinates: [ringXY.map(fromLocalMeters)] };
}

// The ribbon's own tapered-to-a-point shape is real-world-meter geometry,
// so it (correctly) shrinks toward invisible at low zoom, same as the fill
// -- a screen-pixel-width line stroke is needed to stay visible zoomed out
// (see Map.svelte's border-line layer). But MapLibre's line-width can't
// vary along a single feature's length, so stroking the ribbon polygon's
// own outline just traces its full boundary including the 180-degree
// doubling-back at each tapered tip, which a line renderer draws as a
// round/blunt cap -- reintroducing the exact blunt-end look the taper was
// built to avoid, just via the stroke instead of the fill.
//
// Approximates the taper on the stroke side instead: breaks each taper zone
// into taperSteps short LineStrings, tagging each with a widthFraction
// (0..1) sampled from the same taper ramp used for the fill ribbon, and
// folds the constant-width middle into a single widthFraction:1 segment. A
// paint expression multiplies widthFraction by the zoom-based screen width,
// so the stroke ramps thin-to-thick-to-thin same as the fill, just via many
// discretely-sized segments rather than a continuously tapering polygon --
// close enough at the pixel scale where the stroke actually matters (low
// zoom, taper zones only a few px wide).
//
// Explicitly subdivides each taper zone into evenly spaced steps rather
// than reusing whatever vertices simplification happened to leave nearby:
// most real stitched fault paths simplify down to just 2-4 points total
// (they're mostly straight after Douglas-Peucker), which without this
// leaves only one or two vertices anywhere near a tip -- collapsing the
// "ramp" into a single crude half-width block instead of an actual taper.
export function buildTaperStrokeSegments(
  lineCoordsLonLat,
  { taperLengthMeters, simplifyToleranceMeters = 5, taperSteps = 8 },
) {
  const profile = prepareProfile(lineCoordsLonLat, { taperLengthMeters, simplifyToleranceMeters });
  if (!profile) return [];
  let { pts, cum, length, effectiveTaper } = profile;

  if (effectiveTaper > 0) {
    for (let s = 1; s < taperSteps; s++) {
      ({ pts, cum } = insertPointAtDistance(pts, cum, (effectiveTaper * s) / taperSteps));
    }
    for (let s = 1; s < taperSteps; s++) {
      ({ pts, cum } = insertPointAtDistance(pts, cum, length - (effectiveTaper * s) / taperSteps));
    }
  }

  const factors = cum.map((c) => taperFactorAt(c, length, effectiveTaper));

  const segments = [];
  let plateauPts = null;
  for (let i = 0; i < pts.length - 1; i++) {
    if (factors[i] === 1 && factors[i + 1] === 1) {
      if (!plateauPts) plateauPts = [pts[i]];
      plateauPts.push(pts[i + 1]);
      continue;
    }
    if (plateauPts) {
      segments.push({ coordinates: plateauPts.map(fromLocalMeters), widthFraction: 1 });
      plateauPts = null;
    }
    segments.push({
      coordinates: [pts[i], pts[i + 1]].map(fromLocalMeters),
      widthFraction: (factors[i] + factors[i + 1]) / 2,
    });
  }
  if (plateauPts) segments.push({ coordinates: plateauPts.map(fromLocalMeters), widthFraction: 1 });
  return segments;
}
