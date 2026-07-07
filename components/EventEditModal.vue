<template>
  <DialogRoot :open="!!eventId" @update:open="(value) => !value && emit('close')">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40" />
      <DialogContent
        v-if="event"
        class="fixed left-1/2 top-1/2 z-50 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-hairline bg-surface p-4 shadow-lg"
      >
        <DialogTitle class="text-sm font-semibold text-ink-primary">Edit Event</DialogTitle>

        <label class="mt-3 block text-xs text-ink-secondary">
          Title
          <input v-model="form.title" class="input w-full" />
        </label>
        <label class="mt-2 block text-xs text-ink-secondary">
          Description
          <textarea v-model="form.description" rows="3" class="input w-full resize-none" />
        </label>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <label class="text-xs text-ink-secondary">
            Year
            <input v-model.number="form.year" type="number" class="input w-full" />
          </label>
          <label class="text-xs text-ink-secondary">
            End year (optional)
            <input v-model.number="form.endYear" type="number" class="input w-full" placeholder="—" />
          </label>
        </div>
        <label class="mt-2 block text-xs text-ink-secondary">
          Region
          <select v-model="form.regionId" class="input w-full">
            <option v-for="region in store.regionList" :key="region.id" :value="region.id">
              {{ region.name }}
            </option>
          </select>
        </label>

        <p class="mt-2 text-xs text-ink-secondary">Tags</p>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="tag in allTags"
            :key="tag.id"
            class="flex items-center gap-1 rounded-full border border-border-hairline px-2 py-0.5 text-[11px] text-ink-primary"
          >
            <input type="checkbox" :checked="form.tagIds.includes(tag.id)" @change="toggleTag(tag.id)" />
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: tag.color }" />
            {{ tag.label }}
          </label>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <button type="button" class="text-xs text-series-6" @click="onDelete">Delete event</button>
          <div class="flex gap-2">
            <DialogClose as-child>
              <button type="button" class="toolbar-btn">Cancel</button>
            </DialogClose>
            <button type="button" class="toolbar-btn" style="background-color: var(--series-1); color: white" @click="onSave">
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "radix-vue";
import { useTimelineStore } from "~/stores/timeline";

const props = defineProps<{ eventId: string | null }>();
const emit = defineEmits<{ close: [] }>();
const store = useTimelineStore();

const event = computed(() => (props.eventId ? store.events.byId[props.eventId] : undefined));
const allTags = computed(() => store.tags.allIds.map((id) => store.tags.byId[id]));

const form = reactive<{
  title: string;
  description: string;
  year: number;
  endYear: number | undefined;
  regionId: string;
  tagIds: string[];
}>({
  title: "",
  description: "",
  year: 0,
  endYear: undefined,
  regionId: "",
  tagIds: [],
});

watch(
  () => props.eventId,
  () => {
    if (!event.value) return;
    form.title = event.value.title;
    form.description = event.value.description;
    form.year = event.value.year;
    form.endYear = event.value.endYear;
    form.regionId = event.value.regionId;
    form.tagIds = [...event.value.tagIds];
  },
  { immediate: true }
);

function toggleTag(tagId: string) {
  form.tagIds = form.tagIds.includes(tagId)
    ? form.tagIds.filter((id) => id !== tagId)
    : [...form.tagIds, tagId];
}

function onSave() {
  if (!props.eventId) return;
  store.updateEvent(props.eventId, {
    title: form.title,
    description: form.description,
    year: form.year,
    endYear: form.endYear === undefined || Number.isNaN(form.endYear) ? undefined : form.endYear,
    regionId: form.regionId,
    tagIds: form.tagIds,
  });
  emit("close");
}

function onDelete() {
  if (props.eventId && confirm("Delete this event?")) {
    store.deleteEvent(props.eventId);
    emit("close");
  }
}
</script>
