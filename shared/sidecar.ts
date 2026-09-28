import { Sidecar, TimeRange } from './types';
import { formatTime, parseTime } from './time';

export function emptySidecar(): Sidecar {
  return { version: 1, tags: {} };
}

export function sidecarToJson(sidecar: Sidecar): string {
  const tags: Record<string, [string, string][]> = {};
  for (const [tag, ranges] of Object.entries(sidecar.tags)) {
    tags[tag] = ranges.map((r): [string, string] => [formatTime(r.start), formatTime(r.end)]);
  }
  return JSON.stringify({ version: sidecar.version, tags }, null, 2);
}

export function sidecarFromJson(json: string): Sidecar {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.tags || typeof parsed.tags !== 'object') {
      return emptySidecar();
    }
    const tags: Record<string, TimeRange[]> = {};
    for (const [tag, ranges] of Object.entries(parsed.tags)) {
      if (!Array.isArray(ranges)) continue;
      const list: TimeRange[] = [];
      for (const r of ranges) {
        if (!Array.isArray(r) || r.length < 2) continue;
        const start = typeof r[0] === 'number' ? r[0] : parseTime(String(r[0]));
        const end = typeof r[1] === 'number' ? r[1] : parseTime(String(r[1]));
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          list.push({ start, end });
        }
      }
      tags[tag] = list;
    }
    return { version: 1, tags };
  } catch {
    return emptySidecar();
  }
}
