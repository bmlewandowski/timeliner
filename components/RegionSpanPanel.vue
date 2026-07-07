<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-hairline bg-surface p-4 shadow-lg">
        <DialogTitle class="text-sm font-semibold text-ink-primary">{{ region.name }} — Spans</DialogTitle>
        <p class="mt-1 text-xs text-ink-secondary">
          Collapsible spans of time (e.g. dynasties) scoped to this region. Collapsing one folds that
          year range for every timeline, the same way a global Era does.
        </p>

        <div class="mt-3 max-h-64 space-y-2 overflow-auto">
          <div
            v-for="span in spans"
            :key="span.id"
            class="flex items-center gap-2 rounded border border-border-hairline p-2 text-xs"
          >
            <input
              type="color"
              :value="span.color"
              class="h-5 w-5 flex-shrink-0"
              @input="store.updateRegionSpan(span.id, { color: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="span.name"
              class="input flex-1"
              @change="store.updateRegionSpan(span.id, { name: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="number"
              :value="span.startYear"
              class="input w-16"
              @change="store.updateRegionSpan(span.id, { startYear: Number(($event.target as HTMLInputElement).value) })"
            />
            <span class="text-ink-muted">–</span>
            <input
              type="number"
              :value="span.endYear"
              class="input w-16"
              @change="store.updateRegionSpan(span.id, { endYear: Number(($event.target as HTMLInputElement).value) })"
            />
            <button
              type="button"
              class="text-ink-muted hover:text-ink-primary"
              @click="store.toggleRegionSpanCollapsed(span.id)"
            >
              {{ span.isCollapsed ? "Expand" : "Collapse" }}
            </button>
            <button type="button" class="text-ink-muted hover:text-series-6" @click="store.deleteRegionSpan(span.id)">
              ✕
            </button>
          </div>
          <p v-if="spans.length === 0" class="text-xs text-ink-muted">No spans yet.</p>
        </div>

        <button type="button" class="toolbar-btn mt-3" @click="addSpan">+ Add Span</button>

        <DialogClose as-child>
          <button type="button" class="absolute right-3 top-3 text-ink-muted hover:text-ink-primary">✕</button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "radix-vue";
import { useTimelineStore } from "~/stores/timeline";
import type { Region } from "~/lib/types";

const props = defineProps<{ region: Region; open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const store = useTimelineStore();

const spans = computed(() => store.regionSpansForRegion(props.region.id));

const SPAN_PALETTE = ["#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#2a78d6", "#e87ba4", "#eb6834", "#008300"];

function addSpan() {
  const name = prompt("Span name?");
  if (!name) return;
  store.addRegionSpan({
    regionId: props.region.id,
    name,
    startYear: store.config.minYear,
    endYear: store.config.minYear + 50,
    color: SPAN_PALETTE[spans.value.length % SPAN_PALETTE.length],
    isCollapsed: false,
  });
}
</script>
