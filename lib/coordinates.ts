import { HEADER_ROW_HEIGHT_PX } from "./constants";
import type { Era, EventEntity, RegionSpan, TimelineConfig, TimelineSegment } from "./types";

/** Any collapsible span — Era or RegionSpan both satisfy this shape. */
export interface CollapsibleSpan {
  startYear: number;
  endYear: number;
  isCollapsed: boolean;
}

const BOUNDS_PADDING_YEARS = 10;

/** Real year -> continuous ordinal. Identity when includeYearZero is true. */
export function yearToOrdinal(year: number, config: TimelineConfig): number {
  if (config.includeYearZero) return year;
  return year > 0 ? year - 1 : year;
}

/** Continuous ordinal -> real year. Inverse of yearToOrdinal; never produces 0 when includeYearZero is false. */
export function ordinalToYear(ordinal: number, config: TimelineConfig): number {
  if (config.includeYearZero) return ordinal;
  return ordinal >= 0 ? ordinal + 1 : ordinal;
}

/** Returns an expanded {minYear, maxYear} if `year` falls outside the config's current bounds. */
export function expandedConfigBounds(
  config: TimelineConfig,
  year: number
): { minYear: number; maxYear: number } {
  let { minYear, maxYear } = config;
  if (year < minYear) minYear = year - BOUNDS_PADDING_YEARS;
  if (year > maxYear) maxYear = year + BOUNDS_PADDING_YEARS;
  return { minYear, maxYear };
}

/**
 * Greedy interval-graph coloring (same approach as `computeLaneLayout`, §8) over just the COLLAPSED
 * eras, in ordinal space, sorted chronologically. Eras aren't supposed to overlap, but nothing enforces
 * that — if two collapsed eras' ranges do overlap or touch, each gets its own stacking layer so their
 * bands render as separate rows instead of directly on top of one another. Non-overlapping eras reuse
 * layer 0, so unrelated eras elsewhere on the timeline don't grow taller than they need to.
 */
export function computeCollapsedEraLayers(eras: Era[], config: TimelineConfig): Record<string, number> {
  const sorted = eras
    .filter((era) => era.isCollapsed)
    .map((era) => ({
      id: era.id,
      start: yearToOrdinal(era.startYear, config),
      end: yearToOrdinal(era.endYear, config),
    }))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  const layerEndOrdinals: number[] = [];
  const layerByEraId: Record<string, number> = {};

  for (const era of sorted) {
    let assigned = -1;
    for (let i = 0; i < layerEndOrdinals.length; i++) {
      if (layerEndOrdinals[i] <= era.start) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = layerEndOrdinals.length;
      layerEndOrdinals.push(era.end);
    } else {
      layerEndOrdinals[assigned] = era.end;
    }
    layerByEraId[era.id] = assigned;
  }

  return layerByEraId;
}

/**
 * Builds the piecewise segment list purely for coordinate math: implicit gaps plus merged collapsed
 * ranges, in ordinal space, with cumulative pixel offsets. Only COLLAPSED spans warp the axis — an
 * expanded Era or RegionSpan renders fine from its own start/end year via `spanGeometry` and needs no
 * segment of its own. Collapse is a union: any year covered by two overlapping collapsed spans (an Era
 * and another region's dynasty, say) collapses once, merged into a single segment. When multiple
 * collapsed eras land in the same merged range (see `computeCollapsedEraLayers`), the segment grows
 * tall enough to stack one band per layer instead of flattening them into a single band height.
 */
export function buildSegments(
  eras: Era[],
  regionSpans: RegionSpan[],
  config: TimelineConfig
): TimelineSegment[] {
  const minOrdinal = yearToOrdinal(config.minYear, config);
  const maxOrdinal = yearToOrdinal(config.maxYear, config);
  const eraLayerByEraId = computeCollapsedEraLayers(eras, config);
  const collapsedEras = eras
    .filter((era) => era.isCollapsed)
    .map((era) => ({
      start: yearToOrdinal(era.startYear, config),
      end: yearToOrdinal(era.endYear, config),
      layer: eraLayerByEraId[era.id],
    }));

  const collapsedRanges = [...eras, ...regionSpans]
    .filter((span) => span.isCollapsed)
    .map((span) => ({
      start: yearToOrdinal(span.startYear, config),
      end: yearToOrdinal(span.endYear, config),
    }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const range of collapsedRanges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const segments: TimelineSegment[] = [];
  let cursor = minOrdinal;

  for (const range of merged) {
    const start = Math.max(range.start, minOrdinal);
    const end = Math.min(Math.max(range.end, start), maxOrdinal);
    if (end <= cursor) continue;
    if (start > cursor) {
      segments.push({ startOrdinal: cursor, endOrdinal: start, startPx: 0, heightPx: 0, isCollapsed: false });
    }
    segments.push({
      startOrdinal: Math.max(cursor, start),
      endOrdinal: end,
      startPx: 0,
      heightPx: 0,
      isCollapsed: true,
    });
    cursor = end;
  }

  if (maxOrdinal > cursor) {
    segments.push({ startOrdinal: cursor, endOrdinal: maxOrdinal, startPx: 0, heightPx: 0, isCollapsed: false });
  }

  if (segments.length === 0) {
    segments.push({ startOrdinal: minOrdinal, endOrdinal: maxOrdinal, startPx: 0, heightPx: 0, isCollapsed: false });
  }

  // Leading gap the height of the sticky title row, so minYear's content starts right below it instead
  // of underneath it — without this, the header (which floats over whatever's scrolled to the very top)
  // would permanently obscure the first HEADER_ROW_HEIGHT_PX of real content, most visibly a collapsed
  // era or event sitting right at minYear.
  let offset = HEADER_ROW_HEIGHT_PX;
  for (const seg of segments) {
    seg.startPx = offset;
    if (seg.isCollapsed) {
      const layersInSegment = collapsedEras
        .filter((era) => era.start < seg.endOrdinal && era.end > seg.startOrdinal)
        .map((era) => era.layer);
      const layerCount = layersInSegment.length > 0 ? Math.max(...layersInSegment) + 1 : 1;
      seg.heightPx = config.collapsedEraBandHeight * layerCount;
    } else {
      seg.heightPx = (seg.endOrdinal - seg.startOrdinal) * config.pixelsPerYear;
    }
    offset += seg.heightPx;
  }

  return segments;
}

export function findSegmentByOrdinal(
  segments: TimelineSegment[],
  ordinal: number
): TimelineSegment | undefined {
  if (segments.length === 0) return undefined;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (ordinal < seg.startOrdinal) hi = mid - 1;
    else if (ordinal >= seg.endOrdinal && mid < segments.length - 1) lo = mid + 1;
    else return seg;
  }
  return segments[lo <= segments.length - 1 ? lo : segments.length - 1];
}

function findSegmentByPx(segments: TimelineSegment[], px: number): TimelineSegment | undefined {
  if (segments.length === 0) return undefined;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (px < seg.startPx) hi = mid - 1;
    else if (px >= seg.startPx + seg.heightPx && mid < segments.length - 1) lo = mid + 1;
    else return seg;
  }
  return segments[lo <= segments.length - 1 ? lo : segments.length - 1];
}

export function yearToPixel(
  year: number,
  segments: TimelineSegment[],
  config: TimelineConfig
): number {
  const ordinal = yearToOrdinal(year, config);
  const seg = findSegmentByOrdinal(segments, ordinal);
  if (!seg) return 0;
  if (seg.isCollapsed) return seg.startPx;
  return seg.startPx + (ordinal - seg.startOrdinal) * config.pixelsPerYear;
}

export function pixelToYear(
  px: number,
  segments: TimelineSegment[],
  config: TimelineConfig
): number {
  const seg = findSegmentByPx(segments, px);
  if (!seg) return config.minYear;
  let ordinal: number;
  if (seg.isCollapsed) {
    ordinal = seg.startOrdinal;
  } else {
    const heightPx = seg.heightPx || 1;
    const frac = (px - seg.startPx) / heightPx;
    ordinal = seg.startOrdinal + frac * (seg.endOrdinal - seg.startOrdinal);
  }
  return ordinalToYear(Math.round(ordinal), config);
}

export function segmentForYear(
  year: number,
  segments: TimelineSegment[],
  config: TimelineConfig
): TimelineSegment | undefined {
  return findSegmentByOrdinal(segments, yearToOrdinal(year, config));
}

/** True when both endpoints of an event fall inside the same collapsed segment — fully absorbed, not rendered. */
export function isEventFullyCollapsed(
  event: { year: number; endYear?: number },
  segments: TimelineSegment[],
  config: TimelineConfig
): boolean {
  const startSeg = segmentForYear(event.year, segments, config);
  const endSeg = segmentForYear(event.endYear ?? event.year, segments, config);
  return Boolean(startSeg && startSeg === endSeg && startSeg.isCollapsed);
}

export function totalTimelinePx(segments: TimelineSegment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.startPx + last.heightPx;
}

/** Does `year` (with optional endYear span) fall inside the given range's [startYear, endYear]? Works for any Era or RegionSpan. */
export function eventOverlapsRange(
  year: number,
  endYear: number | undefined,
  range: { startYear: number; endYear: number }
): boolean {
  const spanEnd = endYear ?? year;
  return year <= range.endYear && spanEnd >= range.startYear;
}

/**
 * Pixel geometry for rendering any collapsible span (Era or RegionSpan) as a band.
 * Expanded: top/height come straight from yearToPixel at its own bounds (naturally reflecting any
 * internal compression from an overlapping collapsed span). Collapsed: height comes from a single band
 * row (`collapsedEraBandHeight`), offset down by `layerIndex` rows — the underlying merged segment may
 * be taller than one row when several collapsed eras land in it (see `computeCollapsedEraLayers`), so
 * each era gets its own stacked row in chronological order instead of every era drawing over the same
 * spot. `layerIndex` is always 0 for a RegionSpan, which never stacks.
 */
export function spanGeometry(
  span: CollapsibleSpan,
  segments: TimelineSegment[],
  config: TimelineConfig,
  layerIndex = 0
): { top: number; height: number } {
  const top = yearToPixel(span.startYear, segments, config);
  if (span.isCollapsed) {
    return { top: top + layerIndex * config.collapsedEraBandHeight, height: config.collapsedEraBandHeight };
  }
  const bottom = yearToPixel(span.endYear, segments, config);
  return { top, height: Math.max(bottom - top, 0) };
}

export interface LaneLayout {
  laneByEventId: Record<string, number>;
  laneCount: number;
}

/**
 * Greedy interval-graph coloring for same-region collision (spec §8).
 * cardHeightPx is the on-screen minimum height of a point card, converted to
 * a year-equivalent span so collision density stays scale-aware.
 */
export function computeLaneLayout(
  events: EventEntity[],
  pixelsPerYear: number,
  cardHeightPx: number
): LaneLayout {
  const minSpanYears = cardHeightPx / pixelsPerYear;
  const sorted = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const laneEndYears: number[] = [];
  const laneByEventId: Record<string, number> = {};

  for (const event of sorted) {
    const spanEnd = event.endYear ?? event.year + minSpanYears;
    let assigned = -1;
    for (let i = 0; i < laneEndYears.length; i++) {
      if (laneEndYears[i] <= event.year) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = laneEndYears.length;
      laneEndYears.push(spanEnd);
    } else {
      laneEndYears[assigned] = spanEnd;
    }
    laneByEventId[event.id] = assigned;
  }

  return { laneByEventId, laneCount: laneEndYears.length };
}
