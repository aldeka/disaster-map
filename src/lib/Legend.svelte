<script>
  import { LAYERS } from "./layers.js";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import { createPatternTileDataUrl, resolveColor } from "./patterns.js";

  let { visibility = $bindable({}) } = $props();

  let showLegend = $state(true);

  // Same tiles the map itself renders, so a toggle's swatch matches its
  // layer's fill pattern rather than just its color. Computed once since
  // LAYERS and the CSS custom properties are both static.
  const patternUrls = Object.fromEntries(
    LAYERS.filter((l) => l.pattern).map((l) => [
      l.id,
      createPatternTileDataUrl(l.pattern, resolveColor(l.colorVar)),
    ]),
  );

  function handleClick(){
      showLegend = !showLegend;
    }
</script>

<div class="legend">
  <div class="header">
    <h2>Hazard zones</h2>
    <button id="legend-show-hide" title="Show/hide legend" onclick={() => showLegend = !showLegend}>
      {showLegend ? "▼" : "▲"}
    </button>
  </div>
  <div class="contents" class:hidden={!showLegend}>
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
</div>

<style>
  .header {
    display: flex;
    width: 100%;
    justify-content: space-between;
  }

  .header h2 {
    margin: 0;
  }

  .header button {
    border-radius: 0.25rem;
    color: black;
    background-color: var(--safety);
    border: 1px solid #c7a600;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    height: 1.75em;
    width: 3em;
    margin: -.25em -.5em;
    cursor: pointer;
  }
</style>