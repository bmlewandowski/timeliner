<template>
  <DialogRoot :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-hairline bg-surface p-4 shadow-lg">
        <DialogTitle class="text-sm font-semibold text-ink-primary">Timeline Range &amp; Eras</DialogTitle>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="text-xs text-ink-secondary">
            Min year
            <input v-model.number="minYear" type="number" class="input w-full" @change="applyRange" />
          </label>
          <label class="text-xs text-ink-secondary">
            Max year
            <input v-model.number="maxYear" type="number" class="input w-full" @change="applyRange" />
          </label>
          <label class="text-xs text-ink-secondary">
            Negative suffix
            <input v-model="negativeSuffix" class="input w-full" @change="applySuffixes" />
          </label>
          <label class="text-xs text-ink-secondary">
            Positive suffix
            <input v-model="positiveSuffix" class="input w-full" @change="applySuffixes" />
          </label>
        </div>

        <label class="mt-3 flex items-center gap-2 text-xs text-ink-secondary">
          <input type="checkbox" :checked="store.config.includeYearZero" @change="onToggleYearZero" />
          Include year 0
        </label>
        <p v-if="yearZeroBlockedMessage" class="mt-1 text-[11px] text-series-6">{{ yearZeroBlockedMessage }}</p>

        <hr class="my-3 border-border-hairline" />

        <p class="text-xs font-medium text-ink-secondary">Eras</p>
        <div class="mt-2 max-h-48 space-y-2 overflow-auto">
          <div
            v-for="era in store.eraList"
            :key="era.id"
            class="flex items-center gap-2 rounded border border-border-hairline p-2 text-xs"
          >
            <input
              type="color"
              :value="era.color"
              class="h-5 w-5 flex-shrink-0"
              @input="store.updateEra(era.id, { color: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="era.name"
              class="input flex-1"
              @change="store.updateEra(era.id, { name: ($event.target as HTMLInputElement).value })"
            />
            <input
              type="number"
              :value="era.startYear"
              class="input w-16"
              @change="store.updateEra(era.id, { startYear: Number(($event.target as HTMLInputElement).value) })"
            />
            <span class="text-ink-muted">–</span>
            <input
              type="number"
              :value="era.endYear"
              class="input w-16"
              @change="store.updateEra(era.id, { endYear: Number(($event.target as HTMLInputElement).value) })"
            />
            <button type="button" class="text-ink-muted hover:text-ink-primary" @click="store.toggleEraCollapsed(era.id)">
              {{ era.isCollapsed ? "Expand" : "Collapse" }}
            </button>
            <button type="button" class="text-ink-muted hover:text-series-6" @click="store.deleteEra(era.id)">✕</button>
          </div>
          <p v-if="store.eraList.length === 0" class="text-xs text-ink-muted">No eras yet.</p>
        </div>

        <button type="button" class="toolbar-btn mt-3" @click="addEra">+ Add Era</button>

        <DialogClose as-child>
          <button type="button" class="absolute right-3 top-3 text-ink-muted hover:text-ink-primary">✕</button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
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

const minYear = ref(store.config.minYear);
const maxYear = ref(store.config.maxYear);
const negativeSuffix = ref(store.config.negativeSuffix);
const positiveSuffix = ref(store.config.positiveSuffix);
const yearZeroBlockedMessage = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    minYear.value = store.config.minYear;
    maxYear.value = store.config.maxYear;
    negativeSuffix.value = store.config.negativeSuffix;
    positiveSuffix.value = store.config.positiveSuffix;
    yearZeroBlockedMessage.value = "";
  }
);

function applyRange() {
  if (minYear.value < maxYear.value) {
    store.updateConfig({ minYear: minYear.value, maxYear: maxYear.value });
  }
}

function applySuffixes() {
  store.updateConfig({ negativeSuffix: negativeSuffix.value, positiveSuffix: positiveSuffix.value });
}

function onToggleYearZero(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (!checked && !store.canDisableYearZero()) {
    yearZeroBlockedMessage.value =
      "Move or delete the event(s)/era(s) sitting exactly on year 0 before disabling it.";
    (e.target as HTMLInputElement).checked = true;
    return;
  }
  yearZeroBlockedMessage.value = "";
  store.updateConfig({ includeYearZero: checked });
}

const ERA_PALETTE = ["#4a3aa7", "#eda100", "#2a78d6", "#e34948", "#1baf7a", "#e87ba4", "#eb6834", "#008300"];

function addEra() {
  const name = prompt("Era name?");
  if (!name) return;
  store.addEra({
    name,
    startYear: store.config.minYear,
    endYear: store.config.minYear + 50,
    color: ERA_PALETTE[store.eraList.length % ERA_PALETTE.length],
    isCollapsed: false,
  });
}
</script>
