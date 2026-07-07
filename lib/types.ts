export interface EventTag {
  id: string;
  label: string;
  color: string;
}

export interface EventEntity {
  id: string;
  title: string;
  description: string;
  year: number;
  endYear?: number;
  regionId: string;
  tagIds: string[];
  color?: string;
}

export interface Era {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  isCollapsed: boolean;
}

export interface Region {
  id: string;
  name: string;
  order: number;
  color?: string;
  /** Manual width override in px, set by dragging the column's resize handle. Falls back to the auto lane-based width when unset. */
  width?: number;
}

/** A collapsible span scoped to one region (e.g. a dynasty) — same collapse mechanics as Era, but region-owned. */
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
  negativeSuffix: string;
  positiveSuffix: string;
  pixelsPerYear: number;
  collapsedEraBandHeight: number;
  gridlineIntervalYears?: number;
  minYear: number;
  maxYear: number;
  includeYearZero: boolean;
}

export interface NormalizedCollection<T> {
  byId: Record<string, T>;
  allIds: string[];
}

/**
 * Pure coordinate-math structure — a run of the shared vertical axis that's either linear or collapsed.
 * Collapse can come from an Era OR any region's span; overlapping collapsed ranges are merged into one
 * segment (union rule), so this no longer carries an entity id. Band rendering (era or span) is computed
 * directly from each entity's own start/end year via `spanGeometry`, not by matching against a segment.
 */
export interface TimelineSegment {
  startOrdinal: number;
  endOrdinal: number;
  startPx: number;
  heightPx: number;
  isCollapsed: boolean;
}
