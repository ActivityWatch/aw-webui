import { indexTimelineEvents, visibleTimelineEvents, syncTimelineData } from '~/util/timelineIndex';
import { DataSet } from 'vis-data';

const event = (id, start, duration) => ({
  id,
  timestamp: new Date(start).toISOString(),
  duration,
  data: {},
});
test('includes overlapping long events and boundaries, excludes offscreen events', () => {
  const events = [
    event(1, 0, 100),
    event(2, 10_000, 2),
    event(3, 90_000, 10),
    event(4, 200_000, 5),
  ];
  const index = indexTimelineEvents([{ id: 'a', events }]);
  expect(visibleTimelineEvents(index, 95_000, 100_000).map(e => e.event.id)).toEqual([1, 3]);
  expect(visibleTimelineEvents(index, 100_000, 110_000).map(e => e.event.id)).toEqual([1, 3]);
  expect(visibleTimelineEvents(index, 110_001, 120_000)).toEqual([]);
  expect(events.map(e => e.id)).toEqual([1, 2, 3, 4]);
});

test('IDs distinguish buckets and remain stable across viewport changes and event edits', () => {
  const index = indexTimelineEvents([
    { id: 'a', events: [event(1, 0, 10)] },
    { id: 'b', events: [event(1, 0, 10)] },
  ]);
  expect(new Set(index.entries.map(e => e.id)).size).toBe(2);
  const changed = indexTimelineEvents([{ id: 'a', events: [event(1, 1000, 20)] }]);
  expect(changed.entries[0].id).toBe(index.entries[0].id);
});

test('large ranges prepare only nearby events', () => {
  const events = Array.from({ length: 10000 }, (_, i) => event(i, i * 10_000, 5));
  const index = indexTimelineEvents([{ id: 'a', events }]);
  expect(visibleTimelineEvents(index, 50_000_001, 50_020_000)).toHaveLength(3);
});

test('incremental updates notify only for changed, added and removed items', () => {
  const data = new DataSet([
    { id: 'a', start: 1 },
    { id: 'b', start: 2 },
  ]);
  const update = jest.spyOn(data, 'update');
  const remove = jest.spyOn(data, 'remove');
  syncTimelineData(data, [
    { id: 'a', start: 1 },
    { id: 'b', start: 2 },
  ]);
  expect(update).not.toHaveBeenCalled();
  syncTimelineData(data, [
    { id: 'a', start: 3 },
    { id: 'c', start: 4 },
  ]);
  expect(update).toHaveBeenCalledWith([
    { id: 'a', start: 3 },
    { id: 'c', start: 4 },
  ]);
  expect(remove).toHaveBeenCalledWith(['b']);
});

const groupedIndex = (
  buckets,
  threshold: Parameters<typeof indexTimelineEvents>[3] = 5,
  displayEvent?: Parameters<typeof indexTimelineEvents>[2],
  expandedGroups: string[] = []
) => indexTimelineEvents(buckets, false, displayEvent, threshold, expandedGroups);
const memberIds = (index: ReturnType<typeof indexTimelineEvents>) =>
  index.entries.map(item => (item.members || [item]).map(member => member.event.id));

test('grouping is disabled by default and by nonpositive or nonfinite thresholds', () => {
  const buckets = [{ id: 'a', events: [event(1, 0, 2), event(2, 2000, 2)] }];
  const original = indexTimelineEvents(buckets, false);
  for (const threshold of [0, -1, NaN, Infinity, -Infinity]) {
    expect(groupedIndex(buckets, threshold)).toEqual(original);
  }
});

test('groups sorted full-bucket runs and flushes when their span reaches the threshold', () => {
  const events = Array.from({ length: 7 }, (_, i) => event(i + 1, i * 2000, 2));
  const buckets = [{ id: 'a', events: [...events].reverse() }];
  const before = JSON.stringify(buckets);
  const index = groupedIndex(buckets);
  expect(memberIds(index)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  expect(index.entries.map(item => [item.start, item.end, item.event.duration])).toEqual([
    [0, 6000, 6],
    [6000, 12000, 6],
    [12000, 14000, 2],
  ]);
  expect(index.entries[0].members[0].event).toBe(events[0]);
  expect(index.entries[2].members).toBeUndefined();
  expect(index.entries[0].event.data).toEqual({});
  expect(JSON.stringify(buckets)).toBe(before);
});

test('reaches the exact threshold and preserves the sum of member durations', () => {
  const index = groupedIndex(
    [{ id: 'a', events: [event(1, 0, 0.1), event(2, 100, 0.2), event(3, 300, 0.1)] }],
    0.3
  );
  expect(memberIds(index)).toEqual([[1, 2], [3]]);
  expect(index.entries[0].event.duration).toBeCloseTo(0.3);
  expect(index.entries[0].start).toBe(0);
  expect(index.entries[0].end).toBe(300);
});

test('never groups across buckets and supports per-bucket thresholds', () => {
  const buckets = ['a', 'b', 'c'].map(id => ({
    id,
    events: [event(1, 0, 2), event(2, 2000, 2)],
  }));
  const index = groupedIndex(buckets, bucket => (bucket.id === 'c' ? 0 : 5));
  const groups = index.entries.filter(item => item.members);
  expect(groups).toHaveLength(2);
  expect(groups.map(item => item.bucket.id)).toEqual(['a', 'b']);
  expect(groups[0].id).not.toBe(groups[1].id);
  expect(index.entries.filter(item => item.bucket.id === 'c')).toHaveLength(2);
});

test('gaps, overlaps and events at least as long as the threshold split runs', () => {
  const index = groupedIndex([
    {
      id: 'a',
      events: [
        event(1, 0, 2),
        event(2, 2000, 2),
        event(3, 4001, 2), // A one-millisecond gap must stay real.
        event(4, 6000, 2), // A one-millisecond overlap must split too.
        event(5, 8000, 5), // Exactly the threshold: retain this event.
        event(6, 13000, 2),
        event(7, 15000, 2),
      ],
    },
  ]);
  expect(memberIds(index)).toEqual([[1, 2], [3], [4], [5], [6, 7]]);
  expect(index.entries.map(item => item.event.duration)).toEqual([4, 2, 2, 5, 4]);
});

test('uses display overrides for grouping and keeps the displayed originals as members', () => {
  const events = [event(1, 0, 10), event(2, 10000, 10)];
  const displayed = events.map((item, i) => ({
    ...item,
    timestamp: new Date(i * 2000).toISOString(),
    duration: 2,
    data: { app: i ? 'terminal' : 'vim', title: '<script>untrusted</script>' },
  }));
  const index = groupedIndex([{ id: 'a', events }], 5, (_bucketId, item) => displayed[item.id - 1]);
  expect(memberIds(index)).toEqual([[1, 2]]);
  expect(index.entries[0].event.duration).toBe(4);
  expect(index.entries[0].members.map(item => item.event)).toEqual(displayed);
  expect(index.entries[0].event.data).toEqual({});
  expect(events.map(item => item.duration)).toEqual([10, 10]);
});

test('caller short-event filtering remains authoritative', () => {
  const buckets = [{ id: 'a', events: [event(1, 0, 2), event(2, 2000, 0.5), event(3, 2500, 2)] }];
  const index = indexTimelineEvents(buckets, true, undefined, 5);
  expect(memberIds(index)).toEqual([[1], [3]]);
});

test('zero and negative durations interrupt runs without becoming visible items', () => {
  const index = groupedIndex([
    {
      id: 'a',
      events: [
        event(1, 0, 2),
        event(2, 2000, 0),
        event(3, 2000, 2),
        event(4, 4000, -1),
        event(5, 4000, 2),
        event(6, 6000, 2),
      ],
    },
  ]);
  expect(memberIds(index)).toEqual([[1], [3], [5, 6]]);
});

test('nonfinite durations are omitted but still interrupt chronological runs', () => {
  for (const duration of [NaN, Infinity, -Infinity]) {
    const index = groupedIndex([
      { id: 'a', events: [event(1, 0, 2), event(2, 2000, duration), event(3, 2000, 2)] },
    ]);
    expect(memberIds(index)).toEqual([[1], [3]]);
  }
});

test('unplaceable timestamps conservatively prevent grouping only in their own bucket', () => {
  const index = groupedIndex([
    {
      id: 'a',
      events: [event(1, 0, 2), { ...event(2, 0, 2), timestamp: 'invalid' }, event(3, 2000, 2)],
    },
    { id: 'b', events: [event(4, 0, 2), event(5, 2000, 2)] },
  ]);
  expect(memberIds(index)).toEqual([[1], [4, 5], [3]]);
});

test('group membership and IDs remain stable through viewport changes and regrouping', () => {
  const buckets = [{ id: 'a', events: Array.from({ length: 6 }, (_, i) => event(i, i * 2000, 2)) }];
  const index = groupedIndex(buckets);
  const first = visibleTimelineEvents(index, 1000, 2000)[0];
  const panned = visibleTimelineEvents(index, 4000, 5000)[0];
  expect(first).toBe(panned);
  expect(first.id).toBe(groupedIndex(buckets).entries[0].id);
  const originals = indexTimelineEvents(buckets, false).entries;
  expect(first.members.map(item => item.id)).toEqual(originals.slice(0, 3).map(item => item.id));
  expect(originals.map(item => item.id)).not.toContain(first.id);
  expect(first.id).not.toBe(index.entries[1].id);
});

test('expands selected groups before constructing the viewport index', () => {
  const buckets = [{ id: 'a', events: Array.from({ length: 6 }, (_, i) => event(i, i * 2000, 2)) }];
  const collapsed = groupedIndex(buckets);
  const index = groupedIndex(buckets, 5, undefined, [collapsed.entries[0].id]);
  expect(memberIds(index)).toEqual([[0], [1], [2], [3, 4, 5]]);
  expect(visibleTimelineEvents(index, 2100, 3900).map(item => item.event.id)).toEqual([1]);
  expect(index.ends).toEqual([2000, 4000, 6000, 12000]);
  expect(index.entries[3].id).toBe(collapsed.entries[1].id);
});

test('invalid intervals split runs even when supplied after a valid event with the same start', () => {
  for (const duration of [0, -1, NaN, Infinity, -Infinity]) {
    const index = groupedIndex([
      { id: 'a', events: [event(1, 0, 2), event(3, 2000, 2), event(2, 2000, duration)] },
    ]);
    expect(index.entries.every(item => !item.members)).toBe(true);
  }
});

test('groups adjacent microsecond timestamps despite Date losing submillisecond precision', () => {
  const events = [
    { ...event(1, 0, 1.111111), timestamp: '2026-10-22T00:00:00.000123Z' },
    { ...event(2, 0, 1.111111), timestamp: '2026-10-22T00:00:01.111234Z' },
  ];
  const index = groupedIndex([{ id: 'a', events }], 3);
  expect(memberIds(index)).toEqual([[1, 2]]);
  expect(index.entries[0].event.duration).toBe(2.222222);
  expect(index.entries[0].start).toBe(Date.parse(events[0].timestamp));
  expect(index.entries[0].end).toBe(Date.parse(events[1].timestamp) + 1111.111);
});

test('tolerates only submillisecond adjacency differences without adding to tracked durations', () => {
  for (const duration of [0.9995, 1.0005]) {
    const index = groupedIndex(
      [{ id: 'a', events: [event(1, 0, duration), event(2, 1000, 1)] }],
      3
    );
    expect(memberIds(index)).toEqual([[1, 2]]);
    expect(index.entries[0].event.duration).toBe(duration + 1);
  }
});
