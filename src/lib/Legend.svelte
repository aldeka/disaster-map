<script>
  import { LAYERS } from "./layers.js";

  let { visibility = $bindable({}) } = $props();
</script>

<div class="legend">
  <h2>Hazard layers</h2>
  <ul>
    {#each LAYERS as layer (layer.id)}
      <li>
        <label>
          <input type="checkbox" bind:checked={visibility[layer.id]} />
          <span class="swatch" style:--layer-color="var({layer.colorVar})"></span>
          {layer.label}
        </label>
      </li>
    {/each}
  </ul>
</div>
