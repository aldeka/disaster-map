<script>
  import { Map as MapTilerMap, config as maptilerConfig } from "@maptiler/sdk";
  import "@maptiler/sdk/dist/maptiler-sdk.css";
  import { onMount } from "svelte";
  import { LAYERS } from "./layers.js";
  import { createPatternTile, resolveColor } from "./patterns.js";

  let { visibility = $bindable({}) } = $props();

  const MAP_STYLE = "019fdda7-f399-7e8f-9c4a-7914e40cbe3f"; // DisasterDataviz
  // Approx. midpoint of the San Mateo Bridge.
  const CENTER = [-122.22, 37.6];
  const RADIUS_MILES = 30;
  const MILES_PER_DEG_LAT = 69;

  function boundsForRadius([lon, lat], miles) {
    const latDelta = miles / MILES_PER_DEG_LAT;
    const lonDelta = miles / (MILES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
    return [
      [lon - lonDelta, lat - latDelta],
      [lon + lonDelta, lat + latDelta],
    ];
  }

  let mapContainer;
  let map;
  let mapLoaded = $state(false);
  // Insertion point so hazard layers draw above basemap fills/lines but
  // below all place/road/water labels -- computed once the style loads.
  let firstSymbolLayerId;
  const pendingLoads = new Set();

  const sourceId = (layer) => `src-${layer.id}`;
  const fillLayerId = (layer) => `layer-${layer.id}-fill`;
  const lineLayerId = (layer) => `layer-${layer.id}-line`;
  const FAULTS_TOP_ID = "layer-faults-fill";

  function setVisibleIfExists(layer, visible) {
    const vis = visible ? "visible" : "none";
    if (map.getLayer(fillLayerId(layer))) map.setLayoutProperty(fillLayerId(layer), "visibility", vis);
    if (map.getLayer(lineLayerId(layer))) map.setLayoutProperty(lineLayerId(layer), "visibility", vis);
  }

  function addLayerForHazard(layer, geojson) {
    map.addSource(sourceId(layer), { type: "geojson", data: geojson });
    const initialVis = visibility[layer.id] ? "visible" : "none";

    if (layer.kind === "line") {
      map.addLayer(
        {
          id: lineLayerId(layer),
          type: "line",
          source: sourceId(layer),
          paint: {
            "line-color": resolveColor(layer.colorVar),
            "line-opacity": layer.lineOpacity ?? 0.3,
            "line-width": layer.width ?? 1,
          },
          layout: { visibility: initialVis },
        },
        firstSymbolLayerId,
      );
      return;
    }

    // Keep the always-on-top faults shape above every fill layer added after
    // it, and everything below the label layers so place names stay legible.
    const beforeId =
      layer.id !== "faults" && map.getLayer(FAULTS_TOP_ID) ? FAULTS_TOP_ID : firstSymbolLayerId;

    const fillPaint = { "fill-opacity": layer.fillOpacity ?? 0.5 };
    if (layer.pattern) {
      const patternId = `pattern-${layer.id}`;
      if (!map.hasImage(patternId)) {
        map.addImage(patternId, createPatternTile(layer.pattern, resolveColor(layer.colorVar)), {
          pixelRatio: 2,
        });
      }
      fillPaint["fill-pattern"] = patternId;
    } else {
      fillPaint["fill-color"] = resolveColor(layer.colorVar);
    }

    map.addLayer(
      {
        id: fillLayerId(layer),
        type: "fill",
        source: sourceId(layer),
        paint: fillPaint,
        layout: { visibility: initialVis },
      },
      beforeId,
    );

    if (!layer.noBorder) {
      const borderLayer = {
        id: lineLayerId(layer),
        type: "line",
        source: sourceId(layer),
        paint: {
          "line-color": resolveColor(layer.colorVar),
          "line-opacity": 0.66,
          "line-width": layer.borderWidth ?? 1,
        },
        layout: { visibility: initialVis },
      };
      if (layer.taperedBorder) {
        // Only stroke the companion LineString "taper stroke" features, not
        // the fill polygons' own outlines -- see buildTaperStrokeSegments
        // for why tracing the ribbon polygon's outline draws a blunt cap at
        // each tapered tip instead of a point.
        borderLayer.filter = ["==", ["geometry-type"], "LineString"];
        borderLayer.paint["line-width"] = ["*", ["coalesce", ["get", "widthFraction"], 1], layer.borderWidth ?? 1];
      }
      map.addLayer(borderLayer, beforeId);
    }
  }

  async function ensureLayerLoaded(layer) {
    if (map.getSource(sourceId(layer)) || pendingLoads.has(layer.id)) return;
    pendingLoads.add(layer.id);
    try {
      const res = await fetch(layer.dataUrl);
      const geojson = await res.json();
      addLayerForHazard(layer, geojson);
    } finally {
      pendingLoads.delete(layer.id);
    }
  }

  $effect(() => {
    if (!mapLoaded) return;
    for (const layer of LAYERS) {
      const visible = visibility[layer.id];
      if (visible && !map.getSource(sourceId(layer))) {
        ensureLayerLoaded(layer);
      } else {
        setVisibleIfExists(layer, visible);
      }
    }
  });

  onMount(() => {
    maptilerConfig.apiKey = import.meta.env.VITE_MAPTILER_KEY;
    map = new MapTilerMap({
      container: mapContainer,
      style: MAP_STYLE,
      bounds: boundsForRadius(CENTER, RADIUS_MILES),
      navigationControl: "top-right",
    });
    map.on("load", () => {
      firstSymbolLayerId = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      mapLoaded = true;
    });

    if (import.meta.env.DEV) {
      window.__map = map;
      window.__LAYERS = LAYERS;
    }

    return () => map.remove();
  });
</script>

<div id="map" bind:this={mapContainer}></div>
