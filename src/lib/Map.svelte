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
  const pendingLoads = new Set();

  const sourceId = (layer) => `src-${layer.id}`;
  const fillLayerId = (layer) => `layer-${layer.id}-fill`;
  const lineLayerId = (layer) => `layer-${layer.id}-line`;
  const FAULTS_LINE_ID = "layer-faults-line";

  function setVisibleIfExists(layer, visible) {
    const vis = visible ? "visible" : "none";
    if (map.getLayer(fillLayerId(layer))) map.setLayoutProperty(fillLayerId(layer), "visibility", vis);
    if (map.getLayer(lineLayerId(layer))) map.setLayoutProperty(lineLayerId(layer), "visibility", vis);
  }

  function addLayerForHazard(layer, geojson) {
    map.addSource(sourceId(layer), { type: "geojson", data: geojson });
    const initialVis = visibility[layer.id] ? "visible" : "none";

    if (layer.kind === "line") {
      map.addLayer({
        id: lineLayerId(layer),
        type: "line",
        source: sourceId(layer),
        paint: {
          "line-color": resolveColor(layer.colorVar),
          "line-opacity": layer.lineOpacity ?? 0.66,
          "line-width": 1.5,
        },
        layout: { visibility: initialVis },
      });
      return;
    }

    // Keep the always-on-top fault lines above every fill layer added after them.
    const beforeId = layer.id !== "faults" && map.getLayer(FAULTS_LINE_ID) ? FAULTS_LINE_ID : undefined;

    const fillPaint = { "fill-opacity": 0.33 };
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
      map.addLayer(
        {
          id: lineLayerId(layer),
          type: "line",
          source: sourceId(layer),
          paint: {
            "line-color": resolveColor(layer.colorVar),
            "line-opacity": 0.66,
          },
          layout: { visibility: initialVis },
        },
        beforeId,
      );
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
