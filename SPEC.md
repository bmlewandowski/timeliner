# Timeliner — Architecture Specification

Timeliner is a parallel-track vertical timeline builder for fictional history and worldbuilding. It renders a master timeline (universal year scale) on the far left and any number of user-defined regional timelines as columns to its right, all sharing one vertical scroll and one pixel-per-year scale.

This document is the spec for the initial architecture. It is written to be followed literally by an implementation phase — no application code exists yet.

## 1. Overview

- **Stack:** Nuxt 3, Vue 3 (Composition API), TypeScript, Tailwind CSS, Pinia (+ `pinia-plugin-persistedstate`), `@vueuse/core`, Radix Vue, `vuedraggable`.
- **Rendering mode:** the app runs with `ssr: false` (app-wide or per-page). All state is client-only — normalized entities persisted to `localStorage`, positions and drag state computed from pointer events — so there is no content that benefits from server rendering, and disabling SSR avoids hydration-mismatch issues with persisted state loaded after mount.
- **Core interaction model:** a single shared vertical scroll container holds the master column and every regional column. Scrolling moves everything in sync because they all share one coordinate system (§4), not because of any explicit scroll-sync code.

## 2. Data Models

`lib/types.ts` — pure TypeScript, no framework dependency.

**Naming rule:** organizational/container entities (`Era`, `Region`) use `name`; content entities (`Event`) use `title`. One rule applied consistently, rather than deciding per-entity.

```ts
export interface EventTag {
  id: string;
  label: string;
  color: string;
}

export interface EventEntity {
  id: string;
  title: string;
  description: string;
  year: number;             // anchor year — always defines the event's rendered position
  endYear?: number;          // optional; present → renders as a spanning duration bar (§5)
  regionId: string;
  tagIds: string[];          // many-to-many; an event can carry multiple tags
  color?: string;            // optional manual override, takes precedence over tag color
}

export interface Era {
  id: string;
  name: string;
  startYear: number;         // inclusive
  endYear: number;           // inclusive
  color: string;             // required — used for band background/accent
  isCollapsed: boolean;
}

export interface Region {
  id: string;
  name: string;
  order: number;             // display index; left-to-right column order, mutated only by reorderRegions (§7.1)
  color?: string;
}

/** A collapsible span scoped to one region (e.g. a dynasty) — same collapse mechanics as Era, region-owned. See §5.1. */
export interface RegionSpan {
  id: string;
  regionId: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  isCollapsed: boolean;
}

export interface TimelineConfig {
  negativeSuffix: string;        // e.g. "BCE", "BF"
  positiveSuffix: string;        // e.g. "CE", "AF"
  pixelsPerYear: number;         // base zoom scale, e.g. 24
  collapsedEraBandHeight: number; // fixed px height of a collapsed banner, e.g. 48
  gridlineIntervalYears?: number; // adaptive default computed from pixelsPerYear if omitted
  minYear: number;               // explicit lower bound of the master timeline
  maxYear: number;               // explicit upper bound of the master timeline
  includeYearZero: boolean;      // toggle — see below
}
```

**Year range is explicit, not derived.** `minYear`/`maxYear` are user-set fields, edited from a control on the Master Timeline column itself (`MasterTimelineColumn.vue`, alongside Era creation — §6), not auto-computed from whatever events/eras happen to exist yet. This lets a user block out "this world's timeline runs from -5000 to 5000" before adding any content. If an event or era is later created with a year outside the current `[minYear, maxYear]`, the relevant bound auto-expands by a small padding constant (e.g. 10 years) to fit it — so content creation is never blocked — but the field itself remains the authoritative, directly editable source of truth rather than a value silently recomputed from content on every render.

**Year 0 is toggleable.** `includeYearZero` defaults to `true` (plain signed integers, no skip — the original simplifying assumption). Setting it to `false` makes the timeline behave like a real BCE/CE calendar: year -1 is immediately followed by year 1, and year 0 does not exist at all. This is not just a validation rule — it changes the coordinate math (§4), because removing year 0 from the sequence introduces a one-year gap that a naive linear mapping would render as an extra blank year on the master timeline. `negativeSuffix`/`positiveSuffix` remain purely cosmetic display labels (e.g. `year < 0 ? \`${-year} ${negativeSuffix}\` : \`${year} ${positiveSuffix}\``) applied independently of this toggle.

**Disabling `includeYearZero` is blocked if any event or era boundary currently sits exactly at year 0** — the UI surfaces which entities to move or delete first, rather than silently shifting or corrupting existing data. Once disabled, year 0 becomes structurally unreachable (see §4's ordinal mapping), so no such conflict can be created going forward.

**Color precedence** for rendering an `EventCard`/bar: `event.color` → first tag's `color` (in `tagIds` order) → `region.color` → a neutral default. This keeps the common case (color comes from tagging) simple while still allowing a one-off manual override.

**Normalized store shape** (Redux-normalizr style):

```ts
interface NormalizedState {
  events:      { byId: Record<string, EventEntity>; allIds: string[] };
  eras:        { byId: Record<string, Era>;         allIds: string[] };
  regionSpans: { byId: Record<string, RegionSpan>;  allIds: string[] };
  regions:     { byId: Record<string, Region>;      allIds: string[] };
  tags:        { byId: Record<string, EventTag>;    allIds: string[] };
  config: TimelineConfig;
}
```

Events do **not** store an `eraId`. Era membership is always derived from `year`/`endYear` against era bounds at read time — storing it would go stale the moment an era's boundaries are edited.

## 3. State Management — Pinia

`stores/timeline.ts` — a single `defineStore('timeline', ...)` using the Composition API (`setup` store) form.

Vue's reactivity gives fine-grained, dependency-tracked updates natively: a component reading a `computed()` only re-renders when that computation's actual inputs change. This is what would otherwise require careful selector design in a less reactive store — here it's the default, so no extra subscription pattern is needed.

- **State:** normalized `events`, `eras`, `regions`, `tags` (each `{ byId, allIds }`) plus `config`, as reactive store state.
- **Actions:**
  - `addEvent / updateEvent / deleteEvent`
  - `addEra / updateEra / deleteEra / toggleEraCollapsed`
  - `addRegion / updateRegion / deleteRegion` — deleting a region deletes its events after a confirmation dialog; events are never silently reassigned to another region.
  - `reorderRegions(newOrderedIds: string[])` — rewrites each region's `order` to match its new index (§7.1). This is the only place `order` is written.
  - `addTag / updateTag / deleteTag` — deleting a tag strips it from every event's `tagIds`; it never deletes the events themselves.
  - `updateConfig`
- **Persistence:** `pinia-plugin-persistedstate` persists `{ events, eras, regionSpans, regions, tags, config }` to `localStorage` under a versioned key (e.g. `timeliner-store-v1`), with the plugin's `paths` option scoped to exclude ephemeral fields below.
- **Derived, never stored:** pixel positions, the coordinate segment list (§4), per-region lane layouts (§8), collapsed-era hidden-event breakdowns (§5) — all exposed as store getters / `computed()` derived from `(events, eras, regions, tags, config)`. Storing any of these would require manual invalidation and risks going stale after a zoom or collapse change.
- **Ephemeral, in-store but not persisted:** `activeTagFilter: string[]`, `searchQuery: string` — view preferences, not data; they reset on reload.
- **Ephemeral, component-local (not in the store at all):** hover state, in-progress form values, active-drag event id, hovered-region-during-drag — owned by the drag composable (§7).
- **Drag commit model:** pointer-move only updates local refs for live visual feedback. On pointer-up, a single `updateEvent(id, { year, regionId, endYear? })` call commits the gesture once (shifting both ends of a duration event by the same year-delta).

## 4. Coordinate System — Piecewise Segments

`lib/coordinates.ts` — pure functions, no framework dependency.

A naive linear formula `pixel = year * pixelsPerYear` breaks for two independent reasons: a collapsed era compresses a variable year-range into a fixed banner height, and — when `includeYearZero` is `false` — year 0 doesn't exist, leaving a one-year gap in the raw year sequence that plain arithmetic would render as a phantom blank year. Both are handled by converting years to a continuous **ordinal** before any pixel math, then building the same segment list as before over ordinals rather than raw years.

**Year ↔ ordinal mapping** (only meaningful when `includeYearZero` is `false`; the identity function otherwise):

```ts
function yearToOrdinal(year: number, cfg: TimelineConfig): number {
  if (cfg.includeYearZero) return year;
  return year > 0 ? year - 1 : year; // year 0 is unreachable input when this branch is taken
}

function ordinalToYear(ordinal: number, cfg: TimelineConfig): number {
  if (cfg.includeYearZero) return ordinal;
  return ordinal >= 0 ? ordinal + 1 : ordinal; // ordinal 0 maps to year 1 — 0 can never be produced
}
```

These two functions are exact inverses and, critically, `ordinalToYear` can never produce `0` when the toggle is off — year 0 is structurally unreachable via drag-snapping or pixel math, not merely rejected by a runtime check. Every year value coming from stored data (`event.year`, `event.endYear`, `era.startYear`, `era.endYear`, `config.minYear`, `config.maxYear`) is converted to its ordinal at the boundary of `lib/coordinates.ts` before segment building; segments themselves are expressed in ordinal space throughout.

```ts
interface TimelineSegment {
  startOrdinal: number;
  endOrdinal: number;
  startPx: number;       // cumulative offset
  heightPx: number;
  isCollapsed: boolean;
}
```

Note there is no `eraId`/`spanId` on a segment. Collapse can now come from either a global Era or any region's `RegionSpan` (§5.1), and two overlapping collapsed spans must compress the shared axis exactly once — so segments carry no entity reference at all; they are purely a coordinate-math structure. Rendering a band (era or dynasty) is done directly from that entity's own `startYear`/`endYear` via `spanGeometry` (§5.1), never by matching against a segment.

**Build algorithm (union-collapse over eras + region spans):**
1. Collect every **collapsed** Era and every **collapsed** RegionSpan (from any region) into one list of `{start, end}` ordinal ranges — expanded, non-collapsed spans contribute nothing here, since they don't warp the axis (see §5.1 for how they still render correctly).
2. Sort and merge overlapping/touching ranges into a minimal set of disjoint collapsed ranges (classic interval-merge). This is the union rule: if a global Era and one region's dynasty both cover part of the same years and either is collapsed, that stretch collapses once, not twice and not partially.
3. Walk `config.minYear` → `config.maxYear` in ordinal space, alternating implicit linear gaps (`isCollapsed: false`) with the merged collapsed ranges (`isCollapsed: true`).
4. For each segment: `heightPx = isCollapsed ? config.collapsedEraBandHeight : (endOrdinal - startOrdinal) * pixelsPerYear`; `startPx = previous.startPx + previous.heightPx` (0 for the first).

**`yearToPixel(year)`:** convert to ordinal via `yearToOrdinal`, then binary-search the containing segment. Collapsed → `segment.startPx`. Normal → `segment.startPx + (ordinal - segment.startOrdinal) * pixelsPerYear`.

**`pixelToYear(px)`:** inverse binary search by `startPx` to get an ordinal, then `ordinalToYear` to get back to a real year.

**Master-timeline gridlines/labels:** generated by iterating real years (not ordinals) from `minYear` to `maxYear` at `gridlineIntervalYears` steps — skipping the literal value `0` when `includeYearZero` is `false` so no gridline or label is ever drawn for it — with each line positioned via `yearToPixel` and labeled with the real year plus its suffix (§2).

**Snapping during drag:** the dragged card's rendered position is `yearToPixel(round(pixelToYear(rawY)))`, recomputed reactively via a `computed()` off the live pointer position inside the drag composable (§7) — this produces discrete magnetic jumps to integer year lines rather than free float.

`totalTimelinePx` (the last segment's `startPx + heightPx`) is the fixed height applied to the master column and every region column. This single shared height is what makes vertical scroll sync free — there is no scroll-event synchronization code anywhere in the app.

## 5. Duration Bars & the Collapsed-Era Straddling Edge Case

- **Bar geometry:** `top = yearToPixel(event.year)`, `bottom = yearToPixel(event.endYear ?? event.year)`, height clamped to a minimum readable size for near-zero-duration events. When `endYear` is absent, the event renders as a compact point card instead of a bar.
- **Why straddling resolves almost for free:** every pixel inside a collapsed segment collapses to that segment's `startPx` (§4). So a bar that runs into a collapsed era naturally flattens at the collapse boundary — no special clipping logic is needed beyond using the segment-aware `yearToPixel` for both endpoints.
- **Full absorption rule:** if `year` and `endYear` resolve into the **same** collapsed segment, the event is not rendered as a bar at all — it's fully absorbed into that era's hidden-count badge, exactly like a point event fully inside a collapsed era.
- **Straddling rule:** if the bar starts in an expanded segment and ends in a collapsed one (or vice versa), it renders using the piecewise coordinates as-is, with a tapered/faded edge at the collapsed boundary as a visual affordance that it continues into a folded era. The event is also added to that era's hidden-count badge so nothing is silently lost from the count.
- **Dropping onto a collapsed banner:** an event dragged so its endpoint lands fully inside a collapsed era snaps that endpoint to the era's `startYear` — an exact year is visually meaningless once collapsed.
- **Hover count popup:** the collapsed banner shows a small always-visible number chip per region (count of hidden events for that region). Hovering or focusing it opens a popover — via Radix Vue's `HoverCard` primitives, chosen for built-in accessible positioning and hover-timing over a hand-rolled tooltip — with a breakdown by tag, e.g. "12 events — 5 Battle, 4 Treaty, 3 untagged." This is computed by a `hiddenEventBreakdown(eraId, regionId)` store getter, never stored state, and rendered by a reusable `HiddenCountBadge.vue` that just takes the computed breakdown as a prop (shared with §5.1's region-span badges, which compute their own breakdown the same way). If a tag filter or search query is active (§9), the badge and popover reflect only the currently-matching hidden events, so the numbers stay consistent with whatever is filtered elsewhere on screen.

## 5.1 Region-Scoped Collapsible Spans ("Dynasties")

The main timeline's Eras aren't the only thing that can fold a stretch of years. Any individual region can define its own collapsible spans (e.g. a dynasty) — same underlying collapse mechanism as an Era (§4's union-merge), but authored and displayed per-region rather than globally.

**Data model:** `RegionSpan { id, regionId, name, startYear, endYear, color, isCollapsed }` (§2) — structurally identical to `Era` plus an owning `regionId`. Normalized in its own `regionSpans` collection, included in persistence and JSON export/import (§10) as an optional field for backward compatibility with exports taken before this existed.

**Overlap rule — union collapse, not exclusivity:** unlike Eras (validated non-overlapping with each other), a `RegionSpan` can freely overlap another region's span or a global Era. Nothing about authoring one requires coordinating with any other region. The tradeoff this accepts: if Region A's dynasty and Region B's dynasty happen to cover the same years, and only one is collapsed, that range still collapses for **both** regions and the master column, because the shared vertical axis has no way to be "collapsed for one column but not another." A region's own layout can visibly change because of an action taken in a different region's panel — a deliberate flexibility/predictability tradeoff, not an oversight.

**Band visibility — owning region only:** a `RegionSpan`'s colored band, name label, and collapsed hidden-count badge render **exclusively** inside the region that owns it (`RegionColumn.vue`, via `DynastySpanBand.vue`). The master column and every other region still compress correctly when it's collapsed — they just do so silently, with no band or label of their own, since a compressed range with no visual explanation is preferable to a band appearing in a column that doesn't own it. This is why segments themselves no longer carry an era/span id (§4): band geometry is computed straight from `spanGeometry(entity, segments, config)` — `top = yearToPixel(startYear)`; if collapsed, height comes from the actual merged segment (`segmentForYear(startYear).heightPx`, since two years inside one collapsed segment both map to the same pixel and a naive top/bottom subtraction would read as zero height); if expanded, height is simply `yearToPixel(endYear) - top`, which naturally reflects any internal compression from an overlapping collapsed span with no special-casing. `EraBandOverlay.vue` uses the exact same helper, now iterating `store.eraList` directly rather than filtering segments by an id that no longer exists.

**UI home — a per-region panel, not the global Eras panel:** each `RegionColumn`'s header (`RegionHeader.vue`) gets a small "Spans" button opening `RegionSpanPanel.vue`, scoped to that region's own spans only — the same list/edit/collapse/delete layout as `EraConfigPanel.vue`'s era rows, just filtered to one `regionId` and creating via `addRegionSpan` instead of `addEra`. Creation prompts for a name up front (matching the Era/Region/Tag creation pattern elsewhere in the app), cycling through the categorical palette for a default color.

**Keeping normal event actions unambiguous — the actual design constraint driving this section:** a `RegionColumn` already has a double-click-empty-space-to-add-event gesture. Two choices keep a dynasty band from colliding with it:
1. `DynastySpanBand.vue` has **no click handler of its own** — the entire band is `pointer-events-none` except for the small hidden-count badge (re-enabled via `pointer-events-auto` on just that child), which needs its own hover/click for the popover. Collapsing/expanding a span happens **only** through the panel's Collapse/Expand button, never by clicking the band directly. A double-click anywhere on a dynasty band passes straight through to the region column's own dblclick handler and adds an event there, exactly as if the band weren't present.
2. Where a click handler on header content genuinely is needed (the region name's double-click-to-rename, §-adjacent), it uses `@dblclick.stop` — discovered as a real bug during implementation: a handler that synchronously swaps its own element out of the DOM (e.g. replacing a label with an input) can detach the double-click's `event.target` before the event finishes bubbling, silently defeating a `closest()`-based guard on the parent. Stopping propagation at the source is the reliable fix; excluding by selector downstream is not.

## 6. Component Tree & Scroll Sync

```
pages/index.vue                — Nuxt page shell, ssr:false
 └─ TimelineApp.vue
     ├─ TimelineToolbar.vue     — zoom, add-region, era-config trigger, export button, tag-filter + search
     ├─ EraConfigPanel.vue      — create/edit eras, the timeline's minYear/maxYear range, includeYearZero toggle, and suffixes/base scale — opened both from the toolbar and from an affordance on MasterTimelineColumn.vue itself
     ├─ TagConfigPanel.vue      — create/edit event tags (label + color)
     ├─ TimelineMatrix.vue      — single scroll container; owns the event-drag composable (§7)
     │   ├─ MasterTimelineColumn.vue     — sticky-left, fixed position; year labels/gridlines from segments; entry point for editing the year range and eras
     │   ├─ <draggable> (vuedraggable, §7.1)  — sortable wrapper; reorders columns via a RegionHeader grip handle
     │   │   └─ RegionColumn.vue (×N)         — drop target for events; sticky-top header; absolutely-positioned EventCards
     │   │       ├─ RegionHeader.vue              — includes the drag-handle grip used by §7.1
     │   │       └─ EventCard.vue (×N)            — draggable; point card or duration bar depending on endYear; tag color accent + chips; dimmed/hidden when filtered out
     │   ├─ AddRegionColumn.vue         — trailing affordance, outside the sortable wrapper
     │   └─ EraBandOverlay.vue (×N)     — full-width band per era segment, aligned via the same segment math; collapsed variant shows the hover-count popover (§5)
     └─ EventDetailPanel.vue / EventEditModal.vue — manual edit alternative to drag; also where an event's tags are assigned
```

**One shared scroll container**, not N synced containers: every column is given `height: totalTimelinePx` inside a single `overflow-auto` div, so vertical scroll moves everything together with zero sync code. CSS `position: sticky` handles the master column (surviving horizontal scroll) and region headers (surviving vertical scroll) for free within that one container.

**Nuxt/Vue conventions:** components in `components/` are auto-imported; the Pinia store lives in `stores/`; shared logic lives in `composables/` (drag logic, §7) and `lib/` (pure framework-agnostic functions: coordinate math, export, types).

## 7. Drag-and-Drop: Events

`composables/useEventDrag.ts` — one gesture, both axes read together: dragging a card vertically re-times it within its current region; dragging it horizontally into a neighboring column re-assigns it to that region. Both happen from the same pointer drag, not two separate interactions.

- **Why custom, not a library:** Vue's mainstream drag libraries (`vuedraggable`/SortableJS-based) are built for reordering items within/between lists, not free 2D absolute-position dragging with continuous Y-axis snapping. That mismatch makes a thin custom layer more pragmatic than forcing a list-reorder library into a shape it wasn't designed for.
- Built on `@vueuse/core`'s pointer composables, which still cover pointer capture and touch/mouse normalization — the part genuinely not worth reimplementing. The custom code is just the geometry: snap math and column hit-testing.
- The composable exposes `startDrag(event, pointerEvent)`, called from `EventCard.vue`'s `@pointerdown`. It tracks `dragState = ref<{ eventId, pointerStartY, pointerStartX, originalTop, originalLeft } | null>`, updated by `window`-level `pointermove`/`pointerup` listeners registered only while a drag is active.
- Each `pointermove`: vertical delta → `pixelToYear` (§4, rounded for snapping) → live `year`/`endYear` preview; horizontal pointer position → `getBoundingClientRect()` on each `RegionColumn` → which column the pointer is currently over, exposed as `hoveredRegionId` for a highlight style on that column.
- **Y-snap:** the card's rendered `top` during drag is `yearToPixel(round(pixelToYear(rawY)))` (§4), recomputed reactively via `computed()` off the live pointer position — a continuous magnetic snap to integer year lines.
- On `pointerup`: commit once via `updateEvent(id, { year, regionId, endYear? })` (§3), then clear `dragState` and remove the window listeners.
- **Known gap:** keyboard-accessible dragging is out of scope for this phase; revisit if accessibility requirements are raised later.

## 7.1 Drag-and-Drop: Region Column Reordering

Dragging a whole timeline column closer to or further from the master timeline — a distinct interaction from dragging an event within/between columns (§7).

- Column reordering is a genuine horizontal list-sort, which is exactly what an off-the-shelf Vue drag library is built for (unlike free 2D event dragging, which didn't fit one — §7). Here the pragmatic choice flips: use **`vuedraggable`** (the maintained Vue 3 wrapper around SortableJS) instead of hand-rolling it.
- `TimelineMatrix.vue` renders the fixed, non-draggable `MasterTimelineColumn` first, then wraps the row of `RegionColumn` components in a `<draggable>` bound (`v-model`) to a `computed` array of regions sorted by `order`. `AddRegionColumn` stays pinned as a non-draggable trailing item after the sortable list.
- `vuedraggable`'s `handle` option is scoped to a small grip icon inside `RegionHeader.vue`, not the column body — grabbing a header reorders the whole column (header and its event cards move together), while pressing down on an `EventCard` still starts the unrelated event-drag composable from §7. Scoping the handle this way is what keeps the two drag systems from fighting over the same `pointerdown`.
- On drop, `vuedraggable` yields the new array order, translated into one `reorderRegions(newOrderedIds)` store call (§3).

## 8. Event Collision — Multiple Events, Same Region, Same Year

- **Resolution: horizontal sub-lane stacking**, with the region column auto-expanding to fit the widest lane count it currently needs. Chosen over a hover-to-reveal/z-index fan-out because hiding overlapping events by default defeats the tool's purpose — comparing everything at a glance.
- **Algorithm** (a memoized per-region getter, keyed on `[events, config.pixelsPerYear]` so it's scale-aware):
  1. `minCardHeightInYears = CARD_HEIGHT_PX / config.pixelsPerYear` — makes collision density scale-aware (zoomed in → fewer forced lanes).
  2. Sort the region's events by `year` (tie-break by `id`).
  3. Greedy interval-graph coloring using each event's real span, `[year, endYear ?? year + minCardHeightInYears]`, so duration bars and point cards share one collision algorithm: maintain `laneEndYears: number[]`; assign each event to the first lane whose end is `<=` the event's start, extending that lane's end; push a new lane if none clears.
  4. `EventCard.left = laneIndex * LANE_WIDTH`; `RegionColumn` width = `max(baseWidth, laneCount * LANE_WIDTH)`.
- `laneIndex` is never persisted — it's recomputed every render from the live event set, so an edit naturally reflows the rest of that region's lanes.
- **Interaction with filtering (§9):** events hidden by an active tag filter/search are excluded from lane computation entirely, so filtering can reduce the number of lanes a region needs, not just visually hide cards.

## 9. Tag-Based Color Coding, Filtering & Search

`lib/tags.ts`, `TimelineToolbar.vue`.

- `EventTag` CRUD via `TagConfigPanel.vue`; tags are fully user-defined, no hardcoded taxonomy, since worldbuilding vocabularies vary per project.
- `EventCard.vue`/bar rendering uses the color precedence rule from §2. When an event carries 2+ tags, the primary (first) tag drives the main accent and the rest render as small color-dot chips in a corner of the card.
- `TimelineToolbar.vue` exposes a multi-select tag filter and a text `searchQuery` (matching `title`/`description`), bound to the store's ephemeral fields (§3). A `visibleEventIds` store getter — filtered by `activeTagFilter` intersected with `tagIds`, and substring match — is the single source of truth every other getter reads from (lane layout §8, hidden-count badges §5), so filtering behaves consistently everywhere instead of being reimplemented per component.
- Filter/search state is a view preference, not data: it isn't persisted (§3) and isn't part of the exported CSV (§10).

## 10. CSV Export & JSON Backup/Restore

`lib/export.ts`. Two formats doing two different jobs — CSV is export-only and lossy by design; JSON is the lossless import/export pair.

**CSV (export-only, spreadsheet-facing):**
- Exports **events** — the primary content entity — as a flat CSV, one row per event, with `regionName` and `tagLabels` resolved to human-readable text (not raw ids). Columns: `title, description, year, endYear, region, tags`.
- Eras/Regions/Tags are low-cardinality config data, not tabular content, so they're out of scope for CSV. This flattening is intentionally lossy (names instead of ids, no eras/config) — it optimizes for opening in Excel/Sheets to bulk-review or bulk-edit events, not for round-tripping back in.
- Export always reflects the full event set, ignoring any active tag filter/search — filtering is a view concern (§9), export is a data concern.

**JSON (import + export, full-fidelity backup/restore/sharing):**
- `TimelineSnapshot { version, events, eras, regionSpans?, regions, tags, config }` — a direct, lossless dump of the normalized store, structurally identical to what `pinia-plugin-persistedstate` already persists to `localStorage` (§3). `version` is reserved for future migrations, mirroring the persisted store's own versioned key. `regionSpans` is optional so a file exported before dynasties (§5.1) existed still imports cleanly, defaulting to empty.
- **Export:** serializes the current store to this shape and downloads it as `.json`.
- **Import:** reads a `.json` file, validates it has all five top-level keys (rejecting anything that isn't a recognizable Timeliner export), confirms with the user that this **replaces** the entire current timeline (a destructive action, not a merge), then overwrites `events`/`eras`/`regions`/`tags`/`config` in one pass and clears any active tag filter/search.
- This is what makes a timeline portable across browsers/machines, and is the backup/restore path — CSV is explicitly not meant to serve that role.
- Implementation is pure client-side: `Blob` + a temporary `<a download>` for export, `file.text()` + `JSON.parse` for import — no backend/API route for either.

## 11. Files an Implementation Phase Would Create

```
lib/types.ts                    — EventEntity, Era, RegionSpan, Region, EventTag, TimelineConfig, TimelineSegment
lib/coordinates.ts               — segment builder (union-collapse), yearToPixel, pixelToYear, spanGeometry
lib/export.ts                    — CSV export, JSON snapshot export/import
stores/timeline.ts               — Pinia store: normalized state + all actions/getters
composables/useEventDrag.ts      — event drag (§7)
pages/index.vue                  — app shell, ssr:false
components/TimelineApp.vue
components/TimelineToolbar.vue
components/EraConfigPanel.vue
components/RegionSpanPanel.vue   — per-region dynasty management (§5.1)
components/TagConfigPanel.vue
components/TimelineMatrix.vue    — scroll container, drag composable, vuedraggable wrapper (§7.1)
components/MasterTimelineColumn.vue
components/RegionColumn.vue
components/RegionHeader.vue
components/EventCard.vue
components/AddRegionColumn.vue
components/EraBandOverlay.vue
components/DynastySpanBand.vue   — region-scoped span band (§5.1)
components/HiddenCountBadge.vue  — shared hover-count popover (§5, §5.1)
components/EventDetailPanel.vue / EventEditModal.vue
```

No application code, dependencies, or scaffolding are created as part of this spec — this is a documentation-only deliverable.
