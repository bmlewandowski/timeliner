<template>
  <div class="pointer-events-none absolute left-0 right-0" :style="style">
    <div class="flex h-full items-center gap-1.5 overflow-hidden px-2">
      <span class="truncate text-[11px] font-medium" :style="{ color: ink }">
        {{ span.name }}<span v-if="span.isCollapsed" class="opacity-80"> — collapsed</span>
      </span>
      <div v-if="span.isCollapsed && breakdown.count > 0" class="pointer-events-auto">
        <HiddenCountBadge :breakdown="breakdown" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { hexToRgba, inkForBackground } from "~/lib/color";
import { spanGeometry } from "~/lib/coordinates";
import type { RegionSpan } from "~/lib/types";

const props = defineProps<{ span: RegionSpan }>();

const store = useTimelineStore();
const ink = computed(() => inkForBackground(props.span.color));
const breakdown = computed(() => store.hiddenSpanBreakdown(props.span.id));
const geometry = computed(() => spanGeometry(props.span, store.segments, store.config));
const style = computed(() => ({
  top: `${geometry.value.top}px`,
  height: `${geometry.value.height}px`,
  backgroundColor: hexToRgba(props.span.color, props.span.isCollapsed ? 0.22 : 0.1),
}));
</script>
