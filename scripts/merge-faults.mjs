import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import flatten from "@turf/flatten";
import buffer from "@turf/buffer";
import dissolve from "@turf/dissolve";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "public", "data", "faults.json");

// Wide enough to solidly overlap same-fault age-classification duplicates
// (observed 0-75m apart) along their whole length rather than just partially,
// so they consolidate into one clean corridor instead of leaving thin "leaf"
// slivers wherever two near-duplicate paths diverge slightly.
const BUFFER_RADIUS_METERS = 175;
// Dropped after merging: minor/isolated fault segments not worth showing.
// Kept low -- this should only catch true noise slivers, not legitimate
// short fault sections.
const MIN_LENGTH_METERS = 1000;

function bboxDiagonalMeters(coordinates) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (function walk(c) {
    if (typeof c[0] === "number") {
      minX = Math.min(minX, c[0]);
      maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]);
      maxY = Math.max(maxY, c[1]);
    } else {
      for (const x of c) walk(x);
    }
  })(coordinates);
  return Math.hypot(maxX - minX, maxY - minY) * 111_000;
}

// polyclip-ts (used internally by @turf/dissolve) can throw on pathological
// floating-point intersections it computes mid-sweep, on real-world data at
// scale. Bisect and retry to isolate whatever pair triggers it, instead of
// losing the whole file's dissolve to one bad polygon pair.
function dissolveSafe(fc) {
  if (fc.features.length <= 1) return fc;
  try {
    return dissolve(fc);
  } catch {
    const mid = Math.floor(fc.features.length / 2);
    const left = dissolveSafe({ type: "FeatureCollection", features: fc.features.slice(0, mid) });
    const right = dissolveSafe({ type: "FeatureCollection", features: fc.features.slice(mid) });
    return { type: "FeatureCollection", features: [...left.features, ...right.features] };
  }
}

function bufferFeature(feature, radiusMeters) {
  // Flatten first: buffering a MultiLineString directly (dashed fault traces
  // are often stored as one MultiLineString per fault) can yield a
  // MultiPolygon, which @turf/dissolve can't merge correctly. Buffering each
  // dash on its own always yields a clean single Polygon per dash.
  const flat = flatten({ type: "FeatureCollection", features: [feature] });
  return flat.features.map((f) => ({
    type: "Feature",
    properties: {},
    geometry: buffer(f, radiusMeters, { units: "meters" }).geometry,
  }));
}

const fc = JSON.parse(readFileSync(filePath, "utf8"));
const before = fc.features.length;

// Union in two stages rather than one big all-features-at-once dissolve:
// first each feature's own dashes together (a small, internally-consistent
// union that rarely trips the pathological float bug), then the resulting
// per-feature shapes against each other. dissolveSafe's bisect-and-retry
// fallback never re-merges the two halves it splits apart, so avoiding it
// as much as possible matters for actually getting clean consolidation
// rather than just avoiding a crash.
//
// CGS records one trace per age-classification (Historic/Holocene/late
// Quaternary/Quaternary) for the same physical fault, overlapping or offset
// by as little as 0-75m -- plus genuinely distinct nearby strands. Buffer
// and merge everything rather than discarding any of it (different age
// classes sometimes cover different real extents of the same fault, so
// picking a single "best" trace per name can silently drop coverage); the
// wide buffer radius above is what consolidates near-duplicates into one
// clean corridor instead of a spiky mess of overlapping lines.
const perFeatureShapes = [];
for (const feature of fc.features) {
  const dashPolygons = bufferFeature(feature, BUFFER_RADIUS_METERS);
  const consolidated = dissolveSafe({ type: "FeatureCollection", features: dashPolygons });
  perFeatureShapes.push(...consolidated.features);
}

const merged = dissolveSafe({ type: "FeatureCollection", features: perFeatureShapes });

const result = {
  type: "FeatureCollection",
  features: merged.features.filter((f) => bboxDiagonalMeters(f.geometry.coordinates) >= MIN_LENGTH_METERS),
};

writeFileSync(filePath, JSON.stringify(result));
console.log(
  `faults: ${before} features -> ${perFeatureShapes.length} per-feature shapes -> ${merged.features.length} merged -> ${result.features.length} after dropping minor segments`,
);
