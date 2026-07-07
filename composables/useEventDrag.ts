import { ref } from "vue";
import { useTimelineStore } from "~/stores/timeline";
import { pixelToYear, yearToPixel } from "~/lib/coordinates";

interface DragState {
  eventId: string;
  pointerStartX: number;
  pointerStartY: number;
  originYear: number;
  originEndYear?: number;
  originRegionId: string;
  currentYear: number;
  currentEndYear?: number;
  hoveredRegionId: string | null;
}

export function useEventDrag() {
  const store = useTimelineStore();
  const state = ref<DragState | null>(null);
  const lastDragHadMovement = ref(false);

  function onPointerMove(e: PointerEvent) {
    if (!state.value) return;
    const dx = e.clientX - state.value.pointerStartX;
    const dy = e.clientY - state.value.pointerStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) lastDragHadMovement.value = true;

    const originTop = yearToPixel(state.value.originYear, store.segments, store.config);
    const snappedYear = pixelToYear(originTop + dy, store.segments, store.config);
    const yearDelta = snappedYear - state.value.originYear;

    state.value.currentYear = state.value.originYear + yearDelta;
    state.value.currentEndYear =
      state.value.originEndYear !== undefined ? state.value.originEndYear + yearDelta : undefined;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const regionEl = el?.closest<HTMLElement>("[data-region-id]");
    if (regionEl?.dataset.regionId) state.value.hoveredRegionId = regionEl.dataset.regionId;
  }

  function onPointerUp() {
    if (state.value) {
      const { eventId, currentYear, currentEndYear, hoveredRegionId, originRegionId } = state.value;
      store.updateEvent(eventId, {
        year: currentYear,
        endYear: currentEndYear,
        regionId: hoveredRegionId ?? originRegionId,
      });
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    state.value = null;
  }

  function startDrag(eventId: string, pointerEvent: PointerEvent) {
    const event = store.events.byId[eventId];
    if (!event) return;
    pointerEvent.preventDefault();
    lastDragHadMovement.value = false;
    state.value = {
      eventId,
      pointerStartX: pointerEvent.clientX,
      pointerStartY: pointerEvent.clientY,
      originYear: event.year,
      originEndYear: event.endYear,
      originRegionId: event.regionId,
      currentYear: event.year,
      currentEndYear: event.endYear,
      hoveredRegionId: event.regionId,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return { state, lastDragHadMovement, startDrag };
}

export type EventDrag = ReturnType<typeof useEventDrag>;
