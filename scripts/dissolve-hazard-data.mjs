import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import flatten from "@turf/flatten";
import truncate from "@turf/truncate";
import dissolve from "@turf/dissolve";
import { LAYERS } from "../src/lib/layers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

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

for (const layer of LAYERS.filter((l) => l.kind === "fill")) {
  const filePath = path.join(publicDir, layer.dataUrl);
  const fc = JSON.parse(readFileSync(filePath, "utf8"));
  const before = fc.features.length;

  const flattened = truncate(flatten(fc), { precision: 6 });
  for (const feature of flattened.features) feature.properties = {};

  const result = dissolveSafe(flattened);

  writeFileSync(filePath, JSON.stringify(result));
  console.log(`${layer.id}: ${before} -> ${result.features.length} features`);
}
