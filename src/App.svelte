<script>
  import Map from "./lib/Map.svelte";
  import Legend from "./lib/Legend.svelte";
  import { LAYERS } from "./lib/layers.js";

  let visibility = $state(Object.fromEntries(LAYERS.map((l) => [l.id, l.defaultVisible])));
</script>

<div class="title-box">San Francisco Bay Area</div>
<Map bind:visibility />
<Legend bind:visibility />
