<template>
  <div
    class="relative flex-shrink-0 border-r border-border-hairline bg-surface"
    :style="{ width: `${width}px`, height: `${store.totalPx}px` }"
  >
    <!-- Clipping lives on this inner wrapper, not the outer column, so the sticky title row below
         keeps sticking to the real scroll container instead of this (non-scrolling) element. -->
    <div class="absolute inset-0 overflow-hidden">
      <EraBandOverlay v-for="era in store.eraList" :key="era.id" :era="era" />

      <EventCard
        v-for="event in store.unifiedEvents"
        :key="event.id"
        :event="event"
        :lane-index="store.unifiedLaneLayout.laneByEventId[event.id] ?? 0"
      />
    </div>

    <div
      class="sticky top-0 z-10 flex items-center border-b border-border-hairline bg-surface px-2 py-1.5"
      :style="{ height: `${HEADER_ROW_HEIGHT_PX}px` }"
    >
      <span class="text-sm font-medium text-ink-primary">All Regions</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { BASE_REGION_WIDTH_PX, HEADER_ROW_HEIGHT_PX, LANE_WIDTH_PX } from "~/lib/constants";

const store = useTimelineStore();
const width = computed(() =>
  Math.max(BASE_REGION_WIDTH_PX, store.unifiedLaneLayout.laneCount * LANE_WIDTH_PX)
);
</script>
