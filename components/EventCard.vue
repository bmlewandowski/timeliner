<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <div
        data-event-card
        class="absolute cursor-grab select-none rounded-md border border-border-hairline bg-surface shadow-sm active:cursor-grabbing"
        :class="[isDragging ? 'z-30 shadow-md' : 'z-0', clippedTopClass, clippedBottomClass]"
        :style="cardStyle"
        @pointerdown="onPointerDown"
        @click="onClick"
      >
        <div
          class="flex h-full flex-col overflow-hidden rounded-[inherit]"
          :style="{ borderLeft: `4px solid ${accentColor}`, backgroundColor: accentWash }"
        >
          <div class="flex items-center gap-1 px-1.5 pt-1">
            <span class="truncate text-[11px] font-medium text-ink-primary">{{ event.title }}</span>
            <span
              v-for="tagId in secondaryTagIds"
              :key="tagId"
              class="h-2 w-2 flex-shrink-0 rounded-full"
              :style="{ backgroundColor: tagColor(tagId) }"
            />
          </div>
          <p class="mt-auto truncate px-1.5 pb-1 text-[9px] tabular-nums text-ink-muted">{{ yearLabel }}</p>
        </div>
      </div>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side-offset="6"
        class="z-50 max-w-xs rounded-md border border-border-hairline bg-surface px-3 py-2 text-xs shadow-lg"
      >
        <p class="font-medium text-ink-primary">{{ event.title }}</p>
        <p v-if="event.description" class="mt-1 text-ink-secondary">{{ event.description }}</p>
        <p class="mt-1 tabular-nums text-ink-muted">{{ yearLabel }}</p>
        <div v-if="event.tagIds.length" class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="tagId in event.tagIds"
            :key="tagId"
            class="inline-flex items-center gap-1 rounded-full border border-border-hairline px-1.5 py-0.5 text-[10px] text-ink-secondary"
          >
            <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: tagColor(tagId) }" />
            {{ store.tags.byId[tagId]?.label }}
          </span>
        </div>
        <TooltipArrow class="fill-surface" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
} from "radix-vue";
import { useTimelineStore } from "~/stores/timeline";
import { hexToRgba } from "~/lib/color";
import { segmentForYear, yearToPixel } from "~/lib/coordinates";
import { CARD_HEIGHT_PX, LANE_GAP_PX, LANE_WIDTH_PX, MIN_BAR_HEIGHT_PX } from "~/lib/constants";
import type { EventDrag } from "~/composables/useEventDrag";
import type { EventEntity } from "~/lib/types";

const props = defineProps<{ event: EventEntity; laneIndex: number }>();
const store = useTimelineStore();
const drag = inject<EventDrag>("eventDrag")!;
const openEventDetail = inject<(id: string) => void>("openEventDetail");

const isDragging = computed(() => drag.state.value?.eventId === props.event.id);
const liveYear = computed(() => (isDragging.value ? drag.state.value!.currentYear : props.event.year));
const liveEndYear = computed(() =>
  isDragging.value ? drag.state.value!.currentEndYear : props.event.endYear
);

const isBar = computed(() => liveEndYear.value !== undefined);
const top = computed(() => yearToPixel(liveYear.value, store.segments, store.config));
const bottom = computed(() =>
  yearToPixel(liveEndYear.value ?? liveYear.value, store.segments, store.config)
);
const height = computed(() =>
  isBar.value ? Math.max(bottom.value - top.value, MIN_BAR_HEIGHT_PX) : CARD_HEIGHT_PX
);

const startSeg = computed(() => segmentForYear(liveYear.value, store.segments, store.config));
const endSeg = computed(() =>
  segmentForYear(liveEndYear.value ?? liveYear.value, store.segments, store.config)
);
const clippedTopClass = computed(() =>
  isBar.value && startSeg.value?.isCollapsed && startSeg.value !== endSeg.value
    ? "rounded-t-none bg-gradient-to-t from-transparent to-transparent"
    : ""
);
const clippedBottomClass = computed(() =>
  isBar.value && endSeg.value?.isCollapsed && startSeg.value !== endSeg.value
    ? "rounded-b-none"
    : ""
);

const accentColor = computed(() => store.resolveEventColor(props.event));
// Only tint when accentColor is a real hex (the neutral fallback is a CSS var and would render as a solid fill, not a wash).
const accentWash = computed(() =>
  accentColor.value.startsWith("#") ? hexToRgba(accentColor.value, 0.1) : undefined
);
const secondaryTagIds = computed(() => props.event.tagIds.slice(1));
function tagColor(tagId: string) {
  return store.tags.byId[tagId]?.color ?? "var(--series-neutral)";
}

const yearLabel = computed(() => {
  const format = (year: number) =>
    year < 0
      ? `${-year} ${store.config.negativeSuffix}`
      : year > 0
        ? `${year} ${store.config.positiveSuffix}`
        : "0";
  return liveEndYear.value !== undefined
    ? `${format(liveYear.value)} – ${format(liveEndYear.value)}`
    : format(liveYear.value);
});

const cardStyle = computed(() => ({
  top: `${top.value}px`,
  height: `${height.value}px`,
  left: `${props.laneIndex * LANE_WIDTH_PX + LANE_GAP_PX}px`,
  width: `${LANE_WIDTH_PX - LANE_GAP_PX * 2}px`,
}));

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  drag.startDrag(props.event.id, e);
}

function onClick() {
  if (!drag.lastDragHadMovement.value) openEventDetail?.(props.event.id);
}
</script>
