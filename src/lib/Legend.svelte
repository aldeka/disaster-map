<script>
  import { LAYERS } from "./layers.js";
  import ToggleSwitch from "./ToggleSwitch.svelte";

  let { visibility = $bindable({}) } = $props();
</script>

<div class="legend">
  <h2>Show/hide hazard zones</h2>
  <ul>
    {#each LAYERS as layer (layer.id)}
      <li>
        <label style:font-weight={visibility[layer.id] ? "600" : "400"}>
          <ToggleSwitch bind:value={visibility[layer.id]} fontSize="1rem" label={layer.label} accentColor="var({layer.colorVar})"/>
        </label>
      </li>
    {/each}
  </ul>
  <small>Sources: CAL FIRE, FEMA, California State Geoportal, US Census TIGERWeb</small>
</div>
