import { IBucket, IEvent } from './interfaces';

export interface IndexedEvent {
  id: string;
  bucket: IBucket;
  event: IEvent & { id?: number };
  start: number;
  end: number;
  members?: IndexedEvent[];
}

function groupTimelineEntries(entries: IndexedEvent[], threshold: number): IndexedEvent[] {
  const grouped: IndexedEvent[] = [];
  let members: IndexedEvent[] = [];
  const flush = () => {
    if (members.length > 1) {
      const first = members[0];
      grouped.push({
        ...first,
        id: JSON.stringify([first.bucket.id, 'group', members.map(item => item.id)]),
        event: {
          ...first.event,
          duration: members.reduce((total, item) => total + item.event.duration, 0),
          data: {},
        },
        end: members[members.length - 1].end,
        members,
      });
    } else if (members.length) {
      grouped.push(members[0]);
    }
    members = [];
  };
  // Process barriers before valid intervals at the same timestamp.
  entries.sort(
    (a, b) =>
      a.start - b.start ||
      Number(a.event.duration > 0 && Number.isFinite(a.end)) -
        Number(b.event.duration > 0 && Number.isFinite(b.end))
  );
  for (const item of entries) {
    // Invalid intervals still split runs, even though they cannot be rendered.
    if (!Number.isFinite(item.end) || item.event.duration <= 0) {
      flush();
      continue;
    }
    if (item.event.duration >= threshold) {
      flush();
      grouped.push(item);
      continue;
    }
    // Date truncates microsecond timestamps to milliseconds, while durations retain
    // their precision. Treat differences below that resolution as adjacent.
    if (members.length && Math.abs(item.start - members[members.length - 1].end) >= 1) flush();
    members.push(item);
    if (item.end - members[0].start >= threshold * 1000) flush();
  }
  flush();
  return grouped;
}

export function indexTimelineEvents(
  buckets,
  filterShort: boolean | ((bucket: IBucket) => boolean) = true,
  displayEvent: (bucketId: string, event: IEvent) => IEvent = (_bucketId, event) => event,
  groupingSeconds: number | ((bucket: IBucket) => number) = 0,
  expandedGroups: readonly string[] = []
) {
  const entries: IndexedEvent[] = [];
  const expanded = expandedGroups.length ? new Set(expandedGroups) : undefined;
  for (const bucket of buckets) {
    const dropShort = typeof filterShort === 'function' ? filterShort(bucket) : filterShort;
    const threshold =
      typeof groupingSeconds === 'function' ? groupingSeconds(bucket) : groupingSeconds;
    const group = Number.isFinite(threshold) && threshold > 0;
    const bucketEntries: IndexedEvent[] = group ? [] : entries;
    let invalidTimestamp = false;
    (bucket.events || []).forEach((sourceEvent, index) => {
      const event = displayEvent(bucket.id, sourceEvent);
      if (dropShort && event.duration <= 1) return;
      const start = new Date(event.timestamp).getTime();
      const end = start + event.duration * 1000;
      if (!Number.isFinite(start)) {
        invalidTimestamp = true;
        return;
      }
      if (!group && !Number.isFinite(end)) return;
      bucketEntries.push({
        id: JSON.stringify([bucket.id, event.id ?? [event.timestamp, index]]),
        bucket,
        event,
        start,
        end,
      });
    });
    if (!group) continue;
    // An invalid timestamp cannot be placed safely between chronological members.
    const grouped = !invalidTimestamp
      ? groupTimelineEntries(bucketEntries, threshold)
      : bucketEntries.filter(item => Number.isFinite(item.end) && item.event.duration > 0);
    for (const item of grouped) {
      if (item.members && expanded?.has(item.id)) {
        for (const member of item.members) entries.push(member);
      } else entries.push(item);
    }
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
