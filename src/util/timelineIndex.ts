import { IEvent } from './interfaces';

export interface IndexedEvent {
  id: string;
  bucket: { id: string; type?: string };
  event: IEvent & { id?: number };
  start: number;
  end: number;
}

export function indexTimelineEvents(buckets, filterShort = true) {
  const entries: IndexedEvent[] = [];
  for (const bucket of buckets) {
    (bucket.events || []).forEach((event, index) => {
      if (filterShort && event.duration <= 1) return;
      const start = new Date(event.timestamp).getTime();
      const end = start + event.duration * 1000;
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      entries.push({
        id: JSON.stringify([bucket.id, event.id ?? [event.timestamp, index]]),
        bucket,
        event,
        start,
        end,
      });
    });
  }
  entries.sort((a, b) => a.start - b.start);
  let maxEnd = -Infinity;
  const ends = entries.map(e => (maxEnd = Math.max(maxEnd, e.end)));
  return { entries, ends, groups: new Set(entries.map(item => item.bucket.id)) };
}

// Prefix maximum ends keep events that begin before the viewport but overlap it.
export function visibleTimelineEvents(
  index: ReturnType<typeof indexTimelineEvents>,
  start: number,
  end: number
): IndexedEvent[] {
  let low = 0;
  let high = index.ends.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (index.ends[mid] < start) low = mid + 1;
    else high = mid;
  }
  const result: IndexedEvent[] = [];
  for (let i = low; i < index.entries.length && index.entries[i].start <= end; i++) {
    if (index.entries[i].end >= start) result.push(index.entries[i]);
  }
  return result;
}

// DataSet updates notify vis-timeline. Avoid notifications for unchanged items.
export function syncTimelineData(dataset, next: Record<string, any>[]): void {
  const ids = new Set(next.map(item => item.id));
  const removed = dataset.getIds().filter(id => !ids.has(id));
  if (removed.length) dataset.remove(removed);
  const changed = next.filter(item => {
    const previous = dataset.get(item.id);
    return !previous || Object.keys(item).some(key => item[key] !== previous[key]);
  });
  if (changed.length) dataset.update(changed);
}
