<template>
  <div ref="scrollContainerRef" data-testid="timeline-scroll" class="relative h-full flex-1 overflow-auto bg-surface-page">
    <div class="flex" style="width: max-content">
      <MasterTimelineColumn />
      <UnifiedTimelineColumn v-if="store.viewMode === 'unified'" />
      <template v-else>
        <draggable
          v-model="regionListModel"
          item-key="id"
          tag="div"
          class="flex"
          handle=".region-drag-handle"
          :animation="150"
        >
          <template #item="{ element }">
            <RegionColumn :region="element" />
          </template>
        </draggable>
        <AddRegionColumn />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref } from "vue";
import draggable from "vuedraggable";
import { useTimelineStore } from "~/stores/timeline";
import { useEventDrag } from "~/composables/useEventDrag";
import { yearToPixel } from "~/lib/coordinates";
import type { Region } from "~/lib/types";

const store = useTimelineStore();
const drag = useEventDrag();
provide("eventDrag", drag);

const scrollContainerRef = ref<HTMLElement | null>(null);

function scrollToYear(year: number) {
  const el = scrollContainerRef.value;
  if (!el) return;
  const targetPx = yearToPixel(year, store.segments, store.config);
  const centered = targetPx - el.clientHeight / 2;
  el.scrollTo({ top: Math.max(0, centered), behavior: "smooth" });
}
defineExpose({ scrollToYear });

onMounted(async () => {
  await nextTick();
  scrollToYear(store.config.includeYearZero ? 0 : 1);
});

const regionListModel = computed({
  get: () => store.regionList,
  set: (newList: Region[]) => store.reorderRegions(newList.map((region) => region.id)),
});
</script>
