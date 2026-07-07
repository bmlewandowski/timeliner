<template>
  <div class="flex flex-wrap items-center gap-2 bg-[#0b5d52] px-3 py-2">
    <span class="text-sm font-semibold text-white">Timeliner</span>

    <div class="ml-4 flex items-center gap-1">
      <button type="button" class="toolbar-btn" title="Zoom out" @click="zoom(-1)">&minus;</button>
      <span class="w-16 text-center text-xs tabular-nums text-white/80">{{ store.config.pixelsPerYear }}px/yr</span>
      <button type="button" class="toolbar-btn" title="Zoom in" @click="zoom(1)">+</button>
    </div>

    <form class="flex items-center gap-1" @submit.prevent="onGoToYear">
      <input
        v-model="goToYearInput"
        type="number"
        placeholder="Go to year…"
        class="input w-28"
        title="Type a year (e.g. 200, 0, -300) and press Enter"
      />
      <button type="submit" class="toolbar-btn">Go</button>
    </form>

    <button type="button" class="toolbar-btn" @click="openEraPanel?.()">Eras &amp; Range</button>
    <button type="button" class="toolbar-btn" @click="openTagPanel?.()">Tags</button>

    <PopoverRoot>
      <PopoverTrigger as-child>
        <button type="button" class="toolbar-btn">
          Filter{{ store.activeTagFilter.length ? ` (${store.activeTagFilter.length})` : "" }}
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent :side-offset="6" class="z-50 w-56 rounded-md border border-border-hairline bg-surface p-2 shadow-lg">
          <p class="mb-1 text-[11px] font-medium text-ink-secondary">Filter by tag</p>
          <label
            v-for="tag in allTags"
            :key="tag.id"
            class="flex items-center gap-2 py-1 text-xs text-ink-primary"
          >
            <input
              type="checkbox"
              :checked="store.activeTagFilter.includes(tag.id)"
              @change="toggleFilterTag(tag.id)"
            />
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: tag.color }" />
            {{ tag.label }}
          </label>
          <p v-if="allTags.length === 0" class="text-xs text-ink-muted">No tags yet.</p>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <input
      v-model="searchModel"
      type="search"
      placeholder="Search events…"
      class="input w-40"
    />

    <div class="ml-auto flex items-center gap-2">
      <button type="button" class="toolbar-btn" @click="onExportCsv">Export CSV</button>
      <button type="button" class="toolbar-btn" @click="onExportJson">Export JSON</button>
      <button type="button" class="toolbar-btn" @click="fileInputRef?.click()">Import JSON</button>
      <input
        ref="fileInputRef"
        type="file"
        accept="application/json"
        class="hidden"
        @change="onFileSelected"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "radix-vue";
import { useTimelineStore } from "~/stores/timeline";
import { downloadCsv, downloadJsonSnapshot, eventsToCsv, parseSnapshot } from "~/lib/export";

const store = useTimelineStore();
const openEraPanel = inject<() => void>("openEraPanel");
const openTagPanel = inject<() => void>("openTagPanel");
const scrollToYear = inject<(year: number) => void>("scrollToYear");
const fileInputRef = ref<HTMLInputElement | null>(null);
// Vue casts v-model to a number automatically for type="number" inputs, so this can be a number, "", or null.
const goToYearInput = ref<string | number | null>("");

const allTags = computed(() => store.tags.allIds.map((id) => store.tags.byId[id]));

const searchModel = computed({
  get: () => store.searchQuery,
  set: (value: string) => {
    store.searchQuery = value;
  },
});

function onGoToYear() {
  if (goToYearInput.value === "" || goToYearInput.value === null) return;
  const year = Number(goToYearInput.value);
  if (Number.isNaN(year)) return;
  scrollToYear?.(Math.round(year));
}

function zoom(direction: number) {
  const next = store.config.pixelsPerYear + direction * 2;
  store.updateConfig({ pixelsPerYear: Math.min(40, Math.max(2, next)) });
}

function toggleFilterTag(tagId: string) {
  const current = store.activeTagFilter;
  store.activeTagFilter = current.includes(tagId)
    ? current.filter((id) => id !== tagId)
    : [...current, tagId];
}

function onExportCsv() {
  const allEvents = store.events.allIds.map((id) => store.events.byId[id]);
  const csv = eventsToCsv(allEvents, store.regions.byId, store.tags.byId);
  downloadCsv(csv);
}

function onExportJson() {
  downloadJsonSnapshot(store.exportSnapshot());
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  try {
    const snapshot = parseSnapshot(await file.text());
    if (confirm("Importing will replace your current timeline. Continue?")) {
      store.importSnapshot(snapshot);
    }
  } catch (err) {
    alert(`Could not import file: ${(err as Error).message}`);
  }
}
</script>
