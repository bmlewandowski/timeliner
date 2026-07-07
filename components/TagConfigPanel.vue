<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-hairline bg-surface p-4 shadow-lg">
        <DialogTitle class="text-sm font-semibold text-ink-primary">Event Tags</DialogTitle>
        <div class="mt-3 space-y-2">
          <div v-for="tag in allTags" :key="tag.id" class="flex items-center gap-2 text-xs">
            <input
              type="color"
              :value="tag.color"
              class="h-5 w-5 flex-shrink-0"
              @input="store.updateTag(tag.id, { color: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="tag.label"
              class="input flex-1"
              @change="store.updateTag(tag.id, { label: ($event.target as HTMLInputElement).value })"
            />
            <button type="button" class="text-ink-muted hover:text-series-6" @click="store.deleteTag(tag.id)">✕</button>
          </div>
          <p v-if="allTags.length === 0" class="text-xs text-ink-muted">No tags yet.</p>
        </div>
        <button type="button" class="toolbar-btn mt-3" @click="addTag">+ Add Tag</button>
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

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const store = useTimelineStore();

const allTags = computed(() => store.tags.allIds.map((id) => store.tags.byId[id]));

const PALETTE = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

function addTag() {
  const nextColor = PALETTE[store.tags.allIds.length % PALETTE.length];
  store.addTag({ label: "New Tag", color: nextColor });
}
</script>
