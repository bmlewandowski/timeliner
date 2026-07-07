<template>
  <div
    data-region-header
    class="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border-hairline bg-surface/95 px-2 py-1.5 backdrop-blur-sm"
  >
    <span class="region-drag-handle cursor-grab select-none text-ink-muted" title="Drag to reorder">⠿</span>
    <input
      type="color"
      :value="region.color || '#898781'"
      title="Region color"
      class="h-4 w-4 flex-shrink-0 cursor-pointer"
      @input="store.updateRegion(region.id, { color: ($event.target as HTMLInputElement).value })"
    />
    <input
      v-if="isEditing"
      ref="inputRef"
      v-model="draftName"
      class="input min-w-0 flex-1 py-0 text-sm font-medium"
      @keydown.enter="commitRename"
      @keydown.escape="cancelRename"
      @blur="commitRename"
    />
    <span
      v-else
      class="truncate text-sm font-medium text-ink-primary"
      title="Double-click to rename"
      @dblclick.stop="startRename"
    >
      {{ region.name }}
    </span>
    <button
      type="button"
      class="ml-auto text-[10px] text-ink-muted hover:text-ink-primary"
      title="Manage this region's collapsible spans (e.g. dynasties)"
      @click="isSpanPanelOpen = true"
    >
      Spans
    </button>
    <button
      type="button"
      class="text-xs text-ink-muted hover:text-ink-primary"
      title="Delete region"
      @click="confirmDelete"
    >
      ✕
    </button>
  </div>

  <RegionSpanPanel :region="region" :open="isSpanPanelOpen" @update:open="isSpanPanelOpen = $event" />
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import type { Region } from "~/lib/types";

const props = defineProps<{ region: Region }>();
const store = useTimelineStore();

const isEditing = ref(false);
const draftName = ref(props.region.name);
const inputRef = ref<HTMLInputElement | null>(null);
const isSpanPanelOpen = ref(false);

async function startRename() {
  draftName.value = props.region.name;
  isEditing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function commitRename() {
  if (!isEditing.value) return;
  const trimmed = draftName.value.trim();
  if (trimmed && trimmed !== props.region.name) {
    store.updateRegion(props.region.id, { name: trimmed });
  }
  isEditing.value = false;
}

function cancelRename() {
  isEditing.value = false;
}

function confirmDelete() {
  if (confirm(`Delete "${props.region.name}" and all its events?`)) {
    store.deleteRegion(props.region.id);
  }
}
</script>
