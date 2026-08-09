// Rebuilds public/data/faults.json as tapered, variable-width polygon
// "ribbons": one merged shape per physical fault strand (main trace wider
// than branches), stitched from many dashed/near-duplicate raw traces into
// as few continuous shapes as possible, tapering to a point at both true
// ends instead of the old fixed-radius buffer's rounded blob caps.
//
// Source: data/faults_raw.json, extracted via
// `git show fa3ae51:public/data/faults.json` -- the CGS fault-trace fetch
// output (NAME/AGE properties, real LineString/MultiLineString geometry)
// from before an earlier commit destructively replaced faults.json with
// flat, propertyless buffered-polygon blobs. To refresh with newer CGS
// data instead, re-run the fault-fetching portion of data/fetch_data.py
// (MAJOR_FAULT_NAMES / FAULT_BASE) and overwrite data/faults_raw.json.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import flatten from "@turf/flatten";
import { parseFaultName } from "./lib/parse-fault-name.mjs";
import { stitchGroup } from "./lib/stitch-lines.mjs";
import { buildRibbonPolygon, buildTaperStrokeSegments } from "./lib/taper-ribbon.mjs";
import { arcLengthMeters } from "./lib/project.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(__dirname, "..", "data", "faults_raw.json");
const outPath = path.join(__dirname, "..", "public", "data", "faults.json");

// Gap between two dashes' nearest endpoints that still counts as "the same
// dashed line, just a gap in the cartographic dash pattern" and gets
// stitched together. Sized from the empirical gap distribution on a dense
// group (Hayward main): most real dash gaps are well under this, while
// genuine section breaks run into the hundreds/thousands of meters.
const ENDPOINT_SNAP_METERS = 300;
// Ribbon widths for a zone's primary named trace vs. its branch strands.
const MAIN_WIDTH_METERS = 275;
const BRANCH_WIDTH_METERS = 120;
// Distance over which each ribbon tapers from full width to a point at
// both true ends.
const TAPER_LENGTH_METERS = 1500;
// Dropped after stitching: leftover single-dash debris/slivers too short to
// be a meaningful shape. Sparser branch groups (few dashes, wider real gaps
// between them) leave more short leftover fragments than dense groups like
// Hayward/San Andreas main -- this threshold trades away the very smallest
// of those (a few hundred meters) since they mostly read as stray flecks
// next to their group's much longer stitched paths (median ~1.3km).
const MIN_LENGTH_METERS = 300;

const raw = JSON.parse(readFileSync(rawPath, "utf8"));

const groups = new Map();
for (const feature of raw.features) {
  const { zone, isMain, groupKey } = parseFaultName(feature.properties.NAME);
  if (!groups.has(groupKey)) groups.set(groupKey, { zone, isMain, dashes: [] });
  const flat = flatten({ type: "FeatureCollection", features: [feature] });
  for (const dash of flat.features) groups.get(groupKey).dashes.push(dash.geometry.coordinates);
}

let dashCount = 0;
let stitchedCount = 0;
let strokeCount = 0;
const outFeatures = [];
let mainCount = 0;
let branchCount = 0;

for (const { zone, isMain, dashes } of groups.values()) {
  dashCount += dashes.length;
  const paths = stitchGroup(dashes, { snapToleranceMeters: ENDPOINT_SNAP_METERS });
  stitchedCount += paths.length;
  for (const path of paths) {
    if (arcLengthMeters(path) < MIN_LENGTH_METERS) continue;
    const polygon = buildRibbonPolygon(path, {
      widthMeters: isMain ? MAIN_WIDTH_METERS : BRANCH_WIDTH_METERS,
      taperLengthMeters: TAPER_LENGTH_METERS,
    });
    if (!polygon) continue;
    outFeatures.push({ type: "Feature", properties: { zone, isMain }, geometry: polygon });
    if (isMain) mainCount++;
    else branchCount++;

    // Companion low-zoom stroke: see buildTaperStrokeSegments for why the
    // ribbon polygon's own outline can't be stroked directly.
    for (const segment of buildTaperStrokeSegments(path, { taperLengthMeters: TAPER_LENGTH_METERS })) {
      outFeatures.push({
        type: "Feature",
        properties: { zone, isMain, widthFraction: segment.widthFraction },
        geometry: { type: "LineString", coordinates: segment.coordinates },
      });
      strokeCount++;
    }
  }
}

writeFileSync(outPath, JSON.stringify({ type: "FeatureCollection", features: outFeatures }));
console.log(
  `faults: ${raw.features.length} raw features -> ${dashCount} dashes -> ${groups.size} groups -> ` +
    `${stitchedCount} stitched paths -> ${mainCount + branchCount} ribbons (${mainCount} main / ${branchCount} branch) ` +
    `+ ${strokeCount} low-zoom stroke segments`,
);
