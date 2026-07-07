<template>
  <TooltipProvider :delay-duration="200">
    <div class="flex h-screen flex-col">
      <TimelineToolbar />
      <TimelineMatrix ref="matrixRef" class="min-h-0 flex-1" />
      <EraConfigPanel :open="isEraPanelOpen" @update:open="isEraPanelOpen = $event" />
      <TagConfigPanel :open="isTagPanelOpen" @update:open="isTagPanelOpen = $event" />
      <EventEditModal :event-id="openEventId" @close="openEventId = null" />
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { provide, ref } from "vue";
import { TooltipProvider } from "radix-vue";

const isEraPanelOpen = ref(false);
const isTagPanelOpen = ref(false);
const openEventId = ref<string | null>(null);
const matrixRef = ref<{ scrollToYear: (year: number) => void } | null>(null);

provide("openEraPanel", () => {
  isEraPanelOpen.value = true;
});
provide("openTagPanel", () => {
  isTagPanelOpen.value = true;
});
provide("openEventDetail", (id: string) => {
  openEventId.value = id;
});
provide("scrollToYear", (year: number) => {
  matrixRef.value?.scrollToYear(year);
});
</script>
