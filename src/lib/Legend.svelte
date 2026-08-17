<script>
  import { LAYERS } from "./layers.js";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import { createPatternTileDataUrl, resolveColor } from "./patterns.js";

  let { visibility = $bindable({}) } = $props();

  // Same tiles the map itself renders, so a toggle's swatch matches its
  // layer's fill pattern rather than just its color. Computed once since
  // LAYERS and the CSS custom properties are both static.
  const patternUrls = Object.fromEntries(
    LAYERS.filter((l) => l.pattern).map((l) => [
      l.id,
      createPatternTileDataUrl(l.pattern, resolveColor(l.colorVar)),
    ]),
  );
</script>

<div class="legend">
  <h2>Show/hide hazard zones</h2>
  <ul>
    {#each LAYERS as layer (layer.id)}
      <li>
        <label style:font-weight={visibility[layer.id] ? "700" : "500"}>
          <ToggleSwitch
            bind:value={visibility[layer.id]}
            label={layer.label}
            accentColor="var({layer.colorVar})"
            patternUrl={patternUrls[layer.id]}
          />
        </label>
      </li>
    {/each}
  </ul>
  <small>Sources: CAL FIRE, FEMA, California State Geoportal, US Census TIGERWeb</small>
  <small><a href="https://github.com/aldeka/hazard-map-source">Source code</a> | CC-0 <a href="https://fogwave.design">Karen Rustad Tolva</a></small>
</div>
