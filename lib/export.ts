import type {
  Era,
  EventEntity,
  EventTag,
  NormalizedCollection,
  Region,
  RegionSpan,
  TimelineConfig,
} from "./types";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function eventsToCsv(
  events: EventEntity[],
  regionsById: Record<string, Region>,
  tagsById: Record<string, EventTag>
): string {
  const header = ["title", "description", "year", "endYear", "region", "tags"];
  const rows = events.map((event) => {
    const regionName = regionsById[event.regionId]?.name ?? "";
    const tagLabels = event.tagIds
      .map((id) => tagsById[id]?.label)
      .filter((label): label is string => Boolean(label))
      .join("; ");
    return [
      event.title,
      event.description,
      String(event.year),
      event.endYear !== undefined ? String(event.endYear) : "",
      regionName,
      tagLabels,
    ]
      .map(csvField)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(csv: string, filename = "timeliner-events.csv") {
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/** Full-fidelity dump of the normalized store, for backup/restore/sharing — not the CSV's flattened event view. */
export const SNAPSHOT_VERSION = 1;

export interface TimelineSnapshot {
  version: number;
  events: NormalizedCollection<EventEntity>;
  eras: NormalizedCollection<Era>;
  /** Optional so JSON files exported before dynasties existed still import cleanly. */
  regionSpans?: NormalizedCollection<RegionSpan>;
  regions: NormalizedCollection<Region>;
  tags: NormalizedCollection<EventTag>;
  config: TimelineConfig;
}

export function downloadJsonSnapshot(snapshot: TimelineSnapshot, filename = "timeliner-timeline.json") {
  triggerDownload(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), filename);
}

export function parseSnapshot(text: string): TimelineSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("That file doesn't contain a Timeliner timeline.");
  }
  for (const key of ["events", "eras", "regions", "tags", "config"]) {
    if (!(key in (data as Record<string, unknown>))) {
      throw new Error(`That file is missing "${key}" — it doesn't look like a Timeliner export.`);
    }
  }
  return data as TimelineSnapshot;
}
