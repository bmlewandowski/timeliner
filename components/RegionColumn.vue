<template>
  <div
    :data-region-id="region.id"
    class="relative flex-shrink-0 border-r border-border-hairline bg-surface"
    :class="isDropTarget ? 'ring-2 ring-inset ring-series-1' : ''"
    :style="{ width: `${width}px`, height: `${store.totalPx}px` }"
    @dblclick="onBackgroundDblClick"
  >
    <!-- Clipping lives on this inner wrapper, not the outer column, so the sticky RegionHeader below
         keeps sticking to the real scroll container instead of this (non-scrolling) element. -->
    <div class="absolute inset-0 overflow-hidden">
      <EraBandOverlay v-for="era in store.eraList" :key="era.id" :era="era" :region-id="region.id" />

      <DynastySpanBand v-for="span in ownSpans" :key="span.id" :span="span" />

      <EventCard
        v-for="event in visibleEvents"
        :key="event.id"
        :event="event"
        :lane-index="laneLayout.laneByEventId[event.id] ?? 0"
      />
    </div>

    <RegionHeader :region="region" />

    <div
      class="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-series-1/40"
      title="Drag to resize column"
      @pointerdown="onResizeStart"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { pixelToYear } from "~/lib/coordinates";
import { BASE_REGION_WIDTH_PX, LANE_WIDTH_PX, MIN_REGION_WIDTH_PX } from "~/lib/constants";
import type { EventDrag } from "~/composables/useEventDrag";
import type { Region } from "~/lib/types";

const props = defineProps<{ region: Region }>();
const store = useTimelineStore();
const drag = inject<EventDrag>("eventDrag")!;
const openEventDetail = inject<(id: string) => void>("openEventDetail");

const ownSpans = computed(() => store.regionSpansForRegion(props.region.id));
const visibleEvents = computed(() => store.eventsByRegion(props.region.id));
const laneLayout = computed(() => store.laneLayoutForRegion(props.region.id));
const autoWidth = computed(() => Math.max(BASE_REGION_WIDTH_PX, laneLayout.value.laneCount * LANE_WIDTH_PX));
const width = computed(() => Math.max(MIN_REGION_WIDTH_PX, props.region.width ?? autoWidth.value));
const isDropTarget = computed(
  () => drag.state.value !== null && drag.state.value.hoveredRegionId === props.region.id
);

function onResizeStart(e: PointerEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = width.value;
  document.body.style.cursor = "col-resize";

  function onMove(moveEvent: PointerEvent) {
    const nextWidth = Math.max(MIN_REGION_WIDTH_PX, startWidth + (moveEvent.clientX - startX));
    store.updateRegion(props.region.id, { width: nextWidth });
  }
  function onUp() {
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onBackgroundDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("[data-event-card], [data-region-header]")) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const year = Math.round(pixelToYear(e.clientY - rect.top, store.segments, store.config));
  const id = store.addEvent({
    title: "New Event",
    description: "",
    year,
    regionId: props.region.id,
    tagIds: [],
  });
  openEventDetail?.(id);
}
</script>
