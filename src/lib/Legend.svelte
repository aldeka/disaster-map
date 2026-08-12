<script>
  import { LAYERS } from "./layers.js";

  let { visibility = $bindable({}) } = $props();
</script>

<div class="legend">
  <h2>Hazard zones</h2>
  <ul>
    {#each LAYERS as layer (layer.id)}
      <li>
        <label style:font-weight={visibility[layer.id] ? "500" : "300"}>
          <input type="checkbox" bind:checked={visibility[layer.id]} />
          <span class="swatch" style:--layer-color="var({layer.colorVar})"></span>
          {layer.label}
        </label>
      </li>
    {/each}
  </ul>
  <small>Sources: CAL FIRE, FEMA, California State Geoportal, US Census TIGERWeb</small>
</div>
