<template>
  <div class="w-40 flex-shrink-0 p-2">
    <button
      type="button"
      class="w-full rounded-md border border-dashed border-border-hairline px-3 py-2 text-xs text-ink-secondary hover:border-series-1 hover:text-series-1"
      @click="onAdd"
    >
      + Add Region
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTimelineStore } from "~/stores/timeline";

const store = useTimelineStore();

const REGION_PALETTE = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

function onAdd() {
  const name = prompt("Region name?");
  if (!name) return;
  const color = REGION_PALETTE[store.regionList.length % REGION_PALETTE.length];
  store.addRegion({ name, color });
}
</script>
