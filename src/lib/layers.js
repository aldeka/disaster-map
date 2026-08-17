// Layer registry: drives both the map layers and the legend rows.
// Order matches plan.md.
export const LAYERS = [
  {
    id: "fire-veryhigh",
    label: "Very high wildfire risk",
    dataUrl: "./data/fire_hazard_veryhigh.json",
    colorVar: "--fire-veryhigh",
    kind: "fill",
    pattern: { type: "stripes", width: 3, gap: 0.5, angle: -65 },
    defaultVisible: true,
  },
  {
    id: "fire-high",
    label: "High wildfire risk",
    dataUrl: "./data/fire_hazard_high.json",
    colorVar: "--fire-high",
    kind: "fill",
    pattern: { type: "stripes", width: 2, angle: -65 },
    defaultVisible: false,
  },
  {
    id: "liquefaction",
    label: "Liquefaction zone",
    dataUrl: "./data/liquefaction.json",
    colorVar: "--liquefaction",
    kind: "fill",
    pattern: { type: "dots" },
    defaultVisible: true,
  },
  {
    id: "landslide",
    label: "Landslide zone",
    dataUrl: "./data/landslide.json",
    colorVar: "--landslide",
    kind: "fill",
    pattern: { type: "dots" },
    noBorder: true,
    defaultVisible: false,
  },
  {
    id: "flood-100",
    label: "100 year flood risk",
    dataUrl: "./data/flood_100yr.json",
    colorVar: "--flood-100",
    kind: "fill",
    pattern: { type: "stripes", width: 4, gap: 1, angle: 0 },
    defaultVisible: true,
  },
  {
    id: "flood-500",
    label: "500 year flood risk",
    dataUrl: "./data/flood_500yr.json",
    colorVar: "--flood-500",
    kind: "fill",
    pattern: { type: "stripes", width: 4, gap: 4, angle: 0 },
    defaultVisible: false,
  },
  {
    id: "faults",
    label: "Major earthquake faults",
    dataUrl: "./data/faults.json",
    colorVar: "--fault",
    kind: "fill",
    fillOpacity: 0.9,
    // Ribbon polygons are real-world-meter widths, so they shrink toward
    // sub-pixel at low zoom no matter how wide they're drawn up close. A
    // border stroke (constant screen pixels, unlike the fill) keeps faults
    // visible zoomed out without changing the tuned close-up thickness --
    // wide at the initial ~30-mile-radius view, fading out by the zoom
    // level where the fill itself is already legible.
    borderWidth: [
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      3,
      10,
      2,
      13,
      0.5,
      15,
      0,
    ],
    // faults.json also carries LineString "stroke" features (see
    // buildTaperStrokeSegments) approximating the ribbon's taper via a
    // widthFraction property, since a stroke traced along the ribbon
    // polygon's own outline draws a blunt/round cap at each tapered tip.
    // taperedBorder tells Map.svelte to stroke only those LineStrings
    // (not the fill polygons' outlines) and scale each by widthFraction.
    taperedBorder: true,
    defaultVisible: true,
  },
  {
    id: "tsunami",
    label: "Tsunami hazard area",
    dataUrl: "./data/tsunami.json",
    colorVar: "--tsunami",
    kind: "fill",
    defaultVisible: false,
  },
  {
    id: "dam-failure",
    label: "Dam failure inundation area",
    dataUrl: "./data/dam_inundation.json",
    colorVar: "--dam-failure",
    kind: "fill",
    fillOpacity: 0.7,
    defaultVisible: false,
  },
];
