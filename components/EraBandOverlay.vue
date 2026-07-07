<template>
  <div
    class="absolute left-0 right-0 cursor-pointer"
    :style="style"
    @click="showLabel ? store.toggleEraCollapsed(era.id) : undefined"
  >
    <div v-if="showLabel" class="flex h-full items-start gap-1 overflow-hidden px-2 pt-4">
      <span class="truncate text-[11px] font-medium text-ink-primary">
        {{ era.name }}<span v-if="era.isCollapsed" class="opacity-80"> — collapsed</span>
      </span>
    </div>
    <div v-else-if="era.isCollapsed && breakdown.count > 0" class="flex h-full items-center justify-center">
      <HiddenCountBadge :breakdown="breakdown" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { hexToRgba } from "~/lib/color";
import { spanGeometry } from "~/lib/coordinates";
import type { Era } from "~/lib/types";

const props = defineProps<{
  era: Era;
  showLabel?: boolean;
  /** Scopes the hidden-count badge to one region's column; omit for the unified view's combined count. */
  regionId?: string;
}>();

const store = useTimelineStore();
const breakdown = computed(() => store.hiddenEventBreakdown(props.era.id, props.regionId));
const geometry = computed(() =>
  spanGeometry(props.era, store.segments, store.config, store.eraLayerIndex(props.era.id))
);
const style = computed(() => ({
  top: `${geometry.value.top}px`,
  height: `${geometry.value.height}px`,
  backgroundColor: hexToRgba(props.era.color, props.era.isCollapsed ? 0.22 : 0.1),
}));
</script>
