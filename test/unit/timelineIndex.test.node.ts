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
