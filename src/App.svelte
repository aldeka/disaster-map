<script>
  import Map from "./lib/Map.svelte";
  import Legend from "./lib/Legend.svelte";
  import { LAYERS } from "./lib/layers.js";

  let visibility = $state(Object.fromEntries(LAYERS.map((l) => [l.id, l.defaultVisible])));
</script>

<div class="title-box">Bay Area Hazard Map</div>
<Map bind:visibility />
<Legend bind:visibility />
