<template>
  <div
    class="sticky left-0 z-20 w-36 flex-shrink-0 border-r border-border-hairline bg-surface-page"
    :style="{ height: `${store.totalPx}px` }"
  >
    <div class="relative h-full">
      <EraBandOverlay v-for="era in store.eraList" :key="era.id" :era="era" show-label />

      <div
        v-for="tick in ticks"
        :key="tick.year"
        class="absolute left-0 right-0 flex items-center gap-1.5 px-2"
        :style="{ top: `${tick.px}px` }"
      >
        <span class="whitespace-nowrap text-sm tabular-nums text-ink-secondary">{{ tick.label }}</span>
        <div
          class="flex-1"
          :class="tick.isOrigin ? 'h-[2px] bg-baseline' : 'h-px bg-gridline'"
        />
      </div>

      <!-- Sticky, opaque spacer matching RegionHeader's row so era shading/ticks scrolling past never
           show through at the same height as the region title row (they render behind this, not under it). -->
      <div
        class="sticky top-0 z-10 border-b border-border-hairline bg-surface-page"
        :style="{ height: `${HEADER_ROW_HEIGHT_PX}px` }"
      />

      <button
        type="button"
        class="absolute right-1 top-1 z-10 rounded border border-border-hairline bg-surface px-1.5 py-0.5 text-[10px] text-ink-secondary hover:text-ink-primary"
        @click="openEraPanel?.()"
      >
        Edit
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { segmentForYear, yearToPixel } from "~/lib/coordinates";
import { HEADER_ROW_HEIGHT_PX } from "~/lib/constants";

const store = useTimelineStore();
const openEraPanel = inject<() => void>("openEraPanel");

const ticks = computed(() => {
  const { minYear, maxYear, includeYearZero, gridlineIntervalYears, pixelsPerYear } = store.config;
  const interval = gridlineIntervalYears ?? Math.max(5, Math.round(60 / pixelsPerYear));
  const start = Math.ceil(minYear / interval) * interval;
  const result: { year: number; px: number; label: string; isOrigin: boolean }[] = [];
  for (let year = start; year <= maxYear; year += interval) {
    if (year === 0 && !includeYearZero) continue;
    const seg = segmentForYear(year, store.segments, store.config);
    if (seg?.isCollapsed) continue;
    result.push({
      year,
      px: yearToPixel(year, store.segments, store.config),
      label: formatYear(year),
      isOrigin: year === 0,
    });
  }
  return result;
});

function formatYear(year: number): string {
  if (year < 0) return `${-year} ${store.config.negativeSuffix}`;
  if (year > 0) return `${year} ${store.config.positiveSuffix}`;
  return "0";
}
</script>
