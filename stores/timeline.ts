import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import type {
  Era,
  EventEntity,
  EventTag,
  NormalizedCollection,
  Region,
  RegionSpan,
  TimelineConfig,
} from "~/lib/types";
import {
  buildSegments,
  computeCollapsedEraLayers,
  computeLaneLayout,
  eventOverlapsRange,
  expandedConfigBounds,
  isEventFullyCollapsed,
  totalTimelinePx,
} from "~/lib/coordinates";
import { CARD_HEIGHT_PX } from "~/lib/constants";
import { SNAPSHOT_VERSION, type TimelineSnapshot } from "~/lib/export";

function uuid(): string {
  return crypto.randomUUID();
}

function collection<T>(): NormalizedCollection<T> {
  return { byId: {}, allIds: [] };
}

function insert<T extends { id: string }>(col: NormalizedCollection<T>, item: T) {
  col.byId[item.id] = item;
  col.allIds.push(item.id);
}

function remove<T>(col: NormalizedCollection<T>, id: string) {
  delete col.byId[id];
  col.allIds = col.allIds.filter((existingId) => existingId !== id);
}

const SEED_IDS = {
  elvenKingdom: uuid(),
  westernEmpire: uuid(),
  battleTag: uuid(),
  treatyTag: uuid(),
};

function seedRegions(): NormalizedCollection<Region> {
  const col = collection<Region>();
  insert(col, { id: SEED_IDS.elvenKingdom, name: "Elven Kingdom", order: 0, color: "#2a78d6" });
  insert(col, { id: SEED_IDS.westernEmpire, name: "Western Empire", order: 1, color: "#e34948" });
  return col;
}

function seedTags(): NormalizedCollection<EventTag> {
  const col = collection<EventTag>();
  insert(col, { id: SEED_IDS.battleTag, label: "Battle", color: "#e34948" });
  insert(col, { id: SEED_IDS.treatyTag, label: "Treaty", color: "#1baf7a" });
  return col;
}

function seedEras(): NormalizedCollection<Era> {
  const col = collection<Era>();
  insert(col, {
    id: uuid(),
    name: "The Dark Age",
    startYear: -500,
    endYear: -100,
    color: "#4a3aa7",
    isCollapsed: false,
  });
  insert(col, {
    id: uuid(),
    name: "Age of Ascension",
    startYear: 0,
    endYear: 400,
    color: "#eda100",
    isCollapsed: false,
  });
  return col;
}

function seedRegionSpans(): NormalizedCollection<RegionSpan> {
  const col = collection<RegionSpan>();
  insert(col, {
    id: uuid(),
    regionId: SEED_IDS.elvenKingdom,
    name: "Silverleaf Dynasty",
    startYear: -400,
    endYear: -250,
    color: "#1baf7a",
    isCollapsed: false,
  });
  return col;
}

function seedEvents(): NormalizedCollection<EventEntity> {
  const col = collection<EventEntity>();
  insert(col, {
    id: uuid(),
    title: "The Long Winter",
    description: "A harsh season that reshaped elven settlements.",
    year: -420,
    regionId: SEED_IDS.elvenKingdom,
    tagIds: [],
  });
  insert(col, {
    id: uuid(),
    title: "War of Ashes",
    description: "A prolonged conflict spanning three decades.",
    year: -60,
    endYear: -30,
    regionId: SEED_IDS.elvenKingdom,
    tagIds: [SEED_IDS.battleTag],
  });
  insert(col, {
    id: uuid(),
    title: "Founding of the Empire",
    description: "The Western Empire's first capital is established.",
    year: 20,
    regionId: SEED_IDS.westernEmpire,
    tagIds: [SEED_IDS.treatyTag],
  });
  return col;
}

export const useTimelineStore = defineStore(
  "timeline",
  () => {
    const regions = reactive<NormalizedCollection<Region>>(seedRegions());
    const tags = reactive<NormalizedCollection<EventTag>>(seedTags());
    const eras = reactive<NormalizedCollection<Era>>(seedEras());
    const regionSpans = reactive<NormalizedCollection<RegionSpan>>(seedRegionSpans());
    const events = reactive<NormalizedCollection<EventEntity>>(seedEvents());
    const config = reactive<TimelineConfig>({
      negativeSuffix: "BF",
      positiveSuffix: "AF",
      pixelsPerYear: 6,
      collapsedEraBandHeight: 48,
      gridlineIntervalYears: 20,
      minYear: -600,
      maxYear: 600,
      includeYearZero: true,
    });

    // Ephemeral view state — persisted separately from the data above.
    const activeTagFilter = ref<string[]>([]);
    const searchQuery = ref("");
    const viewMode = ref<"byRegion" | "unified">("byRegion");

    // ---- derived, never stored ----

    const regionList = computed<Region[]>(() =>
      regions.allIds.map((id) => regions.byId[id]).sort((a, b) => a.order - b.order)
    );

    const eraList = computed<Era[]>(() => eras.allIds.map((id) => eras.byId[id]));
    const regionSpanList = computed<RegionSpan[]>(() =>
      regionSpans.allIds.map((id) => regionSpans.byId[id])
    );

    const segments = computed(() => buildSegments(eraList.value, regionSpanList.value, config));
    const totalPx = computed(() => totalTimelinePx(segments.value));
    const eraLayerByEraId = computed(() => computeCollapsedEraLayers(eraList.value, config));

    function eraLayerIndex(eraId: string): number {
      return eraLayerByEraId.value[eraId] ?? 0;
    }

    const visibleEventIds = computed<Set<string>>(() => {
      const query = searchQuery.value.trim().toLowerCase();
      const filterTags = activeTagFilter.value;
      const result = new Set<string>();
      for (const id of events.allIds) {
        const event = events.byId[id];
        if (filterTags.length > 0 && !event.tagIds.some((tagId) => filterTags.includes(tagId))) {
          continue;
        }
        if (query) {
          const haystack = `${event.title} ${event.description}`.toLowerCase();
          if (!haystack.includes(query)) continue;
        }
        result.add(id);
      }
      return result;
    });

    /** Filter/search-aware, but NOT collapse-aware — the base set hidden-count math draws from. */
    function visibleEventsInRegion(regionId: string): EventEntity[] {
      return events.allIds
        .filter((id) => events.byId[id].regionId === regionId && visibleEventIds.value.has(id))
        .map((id) => events.byId[id]);
    }

    /** Same as `visibleEventsInRegion`, but across every region — the base set for the unified view. */
    function visibleEventsAll(): EventEntity[] {
      return events.allIds.filter((id) => visibleEventIds.value.has(id)).map((id) => events.byId[id]);
    }

    function eventsByRegion(regionId: string): EventEntity[] {
      return visibleEventsInRegion(regionId).filter(
        (event) => !isEventFullyCollapsed(event, segments.value, config)
      );
    }

    function laneLayoutForRegion(regionId: string) {
      return computeLaneLayout(eventsByRegion(regionId), config.pixelsPerYear, CARD_HEIGHT_PX);
    }

    /** All regions' events combined onto one shared lane layout, for the unified view. */
    const unifiedEvents = computed<EventEntity[]>(() =>
      visibleEventsAll().filter((event) => !isEventFullyCollapsed(event, segments.value, config))
    );
    const unifiedLaneLayout = computed(() =>
      computeLaneLayout(unifiedEvents.value, config.pixelsPerYear, CARD_HEIGHT_PX)
    );

    function eraById(eraId: string): Era | undefined {
      return eras.byId[eraId];
    }

    function regionSpanById(spanId: string): RegionSpan | undefined {
      return regionSpans.byId[spanId];
    }

    function regionSpansForRegion(regionId: string): RegionSpan[] {
      return regionSpanList.value.filter((span) => span.regionId === regionId);
    }

    function tagBreakdown(hidden: EventEntity[]) {
      const counts = new Map<string, number>();
      let untagged = 0;
      for (const event of hidden) {
        if (event.tagIds.length === 0) {
          untagged += 1;
          continue;
        }
        for (const tagId of event.tagIds) {
          counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
        }
      }

      const byTag = Array.from(counts.entries())
        .map(([tagId, count]) => {
          const tag = tags.byId[tagId];
          return tag ? { label: tag.label, color: tag.color, count } : null;
        })
        .filter((entry): entry is { label: string; color: string; count: number } => Boolean(entry));

      if (untagged > 0) byTag.push({ label: "untagged", color: "var(--series-neutral)", count: untagged });

      return { count: hidden.length, byTag };
    }

    /**
     * For a given collapsed era: hidden event count and a per-tag breakdown, filter-aware. Pass a
     * `regionId` to scope to one region's column, or omit it for the combined count across every
     * region (the unified view's single column has no region of its own to scope to).
     */
    function hiddenEventBreakdown(eraId: string, regionId?: string) {
      const era = eras.byId[eraId];
      if (!era) return { count: 0, byTag: [] as { label: string; color: string; count: number }[] };

      const candidates = regionId ? visibleEventsInRegion(regionId) : visibleEventsAll();
      const hidden = candidates.filter((event) => eventOverlapsRange(event.year, event.endYear, era));
      return tagBreakdown(hidden);
    }

    /** Same idea as hiddenEventBreakdown, but for a region-owned span — already scoped to its own region. */
    function hiddenSpanBreakdown(spanId: string) {
      const span = regionSpans.byId[spanId];
      if (!span) return { count: 0, byTag: [] as { label: string; color: string; count: number }[] };

      const hidden = visibleEventsInRegion(span.regionId).filter((event) =>
        eventOverlapsRange(event.year, event.endYear, span)
      );
      return tagBreakdown(hidden);
    }

    function resolveEventColor(event: EventEntity): string {
      if (event.color) return event.color;
      const primaryTag = event.tagIds.map((id) => tags.byId[id]).find(Boolean);
      if (primaryTag) return primaryTag.color;
      const region = regions.byId[event.regionId];
      if (region?.color) return region.color;
      return "var(--series-neutral)";
    }

    // ---- actions ----

    function addEvent(input: Omit<EventEntity, "id">): string {
      const id = uuid();
      insert(events, { ...input, id });
      const bounds = expandedConfigBounds(config, input.year);
      Object.assign(config, bounds);
      if (input.endYear !== undefined) {
        Object.assign(config, expandedConfigBounds(config, input.endYear));
      }
      return id;
    }

    function updateEvent(id: string, patch: Partial<Omit<EventEntity, "id">>) {
      const existing = events.byId[id];
      if (!existing) return;
      Object.assign(existing, patch);
      if (patch.year !== undefined) Object.assign(config, expandedConfigBounds(config, patch.year));
      if (patch.endYear !== undefined) Object.assign(config, expandedConfigBounds(config, patch.endYear));
    }

    function deleteEvent(id: string) {
      remove(events, id);
    }

    function addEra(input: Omit<Era, "id">): string {
      const id = uuid();
      insert(eras, { ...input, id });
      Object.assign(config, expandedConfigBounds(config, input.startYear));
      Object.assign(config, expandedConfigBounds(config, input.endYear));
      return id;
    }

    function updateEra(id: string, patch: Partial<Omit<Era, "id">>) {
      const existing = eras.byId[id];
      if (!existing) return;
      Object.assign(existing, patch);
    }

    function deleteEra(id: string) {
      remove(eras, id);
    }

    function toggleEraCollapsed(id: string) {
      const era = eras.byId[id];
      if (era) era.isCollapsed = !era.isCollapsed;
    }

    function addRegionSpan(input: Omit<RegionSpan, "id">): string {
      const id = uuid();
      insert(regionSpans, { ...input, id });
      Object.assign(config, expandedConfigBounds(config, input.startYear));
      Object.assign(config, expandedConfigBounds(config, input.endYear));
      return id;
    }

    function updateRegionSpan(id: string, patch: Partial<Omit<RegionSpan, "id" | "regionId">>) {
      const existing = regionSpans.byId[id];
      if (!existing) return;
      Object.assign(existing, patch);
    }

    function deleteRegionSpan(id: string) {
      remove(regionSpans, id);
    }

    function toggleRegionSpanCollapsed(id: string) {
      const span = regionSpans.byId[id];
      if (span) span.isCollapsed = !span.isCollapsed;
    }

    function addRegion(input: Omit<Region, "id" | "order">): string {
      const id = uuid();
      const order = regions.allIds.length;
      insert(regions, { ...input, id, order });
      return id;
    }

    function updateRegion(id: string, patch: Partial<Omit<Region, "id">>) {
      const existing = regions.byId[id];
      if (!existing) return;
      Object.assign(existing, patch);
    }

    function deleteRegion(id: string) {
      const eventIdsToDelete = events.allIds.filter((eventId) => events.byId[eventId].regionId === id);
      for (const eventId of eventIdsToDelete) remove(events, eventId);
      const spanIdsToDelete = regionSpans.allIds.filter((spanId) => regionSpans.byId[spanId].regionId === id);
      for (const spanId of spanIdsToDelete) remove(regionSpans, spanId);
      remove(regions, id);
    }

    function reorderRegions(newOrderedIds: string[]) {
      newOrderedIds.forEach((id, index) => {
        const region = regions.byId[id];
        if (region) region.order = index;
      });
    }

    function addTag(input: Omit<EventTag, "id">): string {
      const id = uuid();
      insert(tags, { ...input, id });
      return id;
    }

    function updateTag(id: string, patch: Partial<Omit<EventTag, "id">>) {
      const existing = tags.byId[id];
      if (!existing) return;
      Object.assign(existing, patch);
    }

    function deleteTag(id: string) {
      for (const eventId of events.allIds) {
        const event = events.byId[eventId];
        if (event.tagIds.includes(id)) {
          event.tagIds = event.tagIds.filter((tagId) => tagId !== id);
        }
      }
      remove(tags, id);
      activeTagFilter.value = activeTagFilter.value.filter((tagId) => tagId !== id);
    }

    function updateConfig(patch: Partial<TimelineConfig>) {
      Object.assign(config, patch);
    }

    /** Blocks disabling includeYearZero while any event/era sits exactly on year 0. */
    function canDisableYearZero(): boolean {
      const onYearZero = (year: number) => year === 0;
      const eventConflict = events.allIds.some((id) => {
        const event = events.byId[id];
        return onYearZero(event.year) || (event.endYear !== undefined && onYearZero(event.endYear));
      });
      const eraConflict = eras.allIds.some((id) => {
        const era = eras.byId[id];
        return onYearZero(era.startYear) || onYearZero(era.endYear);
      });
      const spanConflict = regionSpans.allIds.some((id) => {
        const span = regionSpans.byId[id];
        return onYearZero(span.startYear) || onYearZero(span.endYear);
      });
      return !eventConflict && !eraConflict && !spanConflict;
    }

    /** Full-fidelity dump for backup/restore/sharing — deep-cloned so later store mutations can't leak into it. */
    function exportSnapshot(): TimelineSnapshot {
      return JSON.parse(
        JSON.stringify({ version: SNAPSHOT_VERSION, events, eras, regionSpans, regions, tags, config })
      );
    }

    function importSnapshot(snapshot: TimelineSnapshot) {
      events.byId = snapshot.events.byId;
      events.allIds = snapshot.events.allIds;
      eras.byId = snapshot.eras.byId;
      eras.allIds = snapshot.eras.allIds;
      regionSpans.byId = snapshot.regionSpans?.byId ?? {};
      regionSpans.allIds = snapshot.regionSpans?.allIds ?? [];
      regions.byId = snapshot.regions.byId;
      regions.allIds = snapshot.regions.allIds;
      tags.byId = snapshot.tags.byId;
      tags.allIds = snapshot.tags.allIds;
      Object.assign(config, snapshot.config);
      activeTagFilter.value = [];
      searchQuery.value = "";
    }

    return {
      // state
      regions,
      tags,
      eras,
      regionSpans,
      events,
      config,
      activeTagFilter,
      searchQuery,
      viewMode,
      // derived
      regionList,
      eraList,
      regionSpanList,
      segments,
      totalPx,
      eraLayerIndex,
      visibleEventIds,
      eventsByRegion,
      laneLayoutForRegion,
      unifiedEvents,
      unifiedLaneLayout,
      eraById,
      regionSpanById,
      regionSpansForRegion,
      hiddenEventBreakdown,
      hiddenSpanBreakdown,
      resolveEventColor,
      canDisableYearZero,
      // actions
      addEvent,
      updateEvent,
      deleteEvent,
      addEra,
      updateEra,
      deleteEra,
      toggleEraCollapsed,
      addRegionSpan,
      updateRegionSpan,
      deleteRegionSpan,
      toggleRegionSpanCollapsed,
      addRegion,
      updateRegion,
      deleteRegion,
      reorderRegions,
      addTag,
      updateTag,
      deleteTag,
      updateConfig,
      exportSnapshot,
      importSnapshot,
    };
  },
  {
    persist: {
      key: "timeliner-store-v1",
      paths: ["events", "eras", "regionSpans", "regions", "tags", "config"],
    },
  } as any
);
