<template>
  <HoverCardRoot :open-delay="150" :close-delay="100">
    <HoverCardTrigger as-child>
      <button
        type="button"
        class="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-secondary dark:bg-white/10"
        @click.stop
      >
        {{ breakdown.count }}
      </button>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        :side-offset="6"
        class="z-50 min-w-[10rem] rounded-md border border-border-hairline bg-surface px-3 py-2 text-xs text-ink-primary shadow-lg"
      >
        <p class="mb-1 font-medium">
          {{ breakdown.count }} hidden event{{ breakdown.count === 1 ? "" : "s" }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="entry in breakdown.byTag" :key="entry.label" class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: entry.color }" />
            <span class="text-ink-secondary">{{ entry.label }}</span>
            <span class="ml-auto tabular-nums">{{ entry.count }}</span>
          </li>
        </ul>
        <HoverCardArrow class="fill-surface" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import {
  HoverCardArrow,
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
} from "radix-vue";

defineProps<{
  breakdown: { count: number; byTag: { label: string; color: string; count: number }[] };
}>();
</script>
