import { earliestEventInBucket, earliestEventInBuckets } from '~/util/earliestEvent';

// Fake events endpoint: returns the latest event at or before `end` (limit 1)
function fakeGetEvents(timestamps: Record<string, string[]>) {
  const calls: string[] = [];
  const getEvents = async (id: string, { end }: { end?: Date; limit: number }) => {
    calls.push(id);
    const ts = (timestamps[id] || [])
      .map(t => new Date(t))
      .filter(t => !end || t <= end)
      .sort((a, b) => b.getTime() - a.getTime());
    return ts.slice(0, 1).map(t => ({ timestamp: t.toISOString() }));
  };
  return { getEvents, calls };
}

describe('earliestEventInBucket', () => {
  it('uses metadata.start when the server provides it (aw-server-rust)', async () => {
    const { getEvents, calls } = fakeGetEvents({});
    const start = new Date('2021-03-04T05:06:07Z');
    const res = await earliestEventInBucket(
      { id: 'b', metadata: { start, end: start } } as any,
      getEvents
    );
    expect(res).toEqual(start);
    expect(calls).toHaveLength(0);
  });

  it('bisects to within a day of the first event (aw-server)', async () => {
    const { getEvents, calls } = fakeGetEvents({
      b: ['2022-09-22T15:05:08Z', '2023-01-01T00:00:00Z', '2026-09-26T10:00:00Z'],
    });
    const res = await earliestEventInBucket({ id: 'b' } as any, getEvents);
    const first = new Date('2022-09-22T15:05:08Z').getTime();
    expect(res.getTime()).toBeGreaterThanOrEqual(first);
    expect(res.getTime() - first).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(calls.length).toBeLessThan(25);
  });

  it('returns null for an empty bucket', async () => {
    const { getEvents } = fakeGetEvents({ b: [] });
    expect(await earliestEventInBucket({ id: 'b' } as any, getEvents)).toBeNull();
  });
});

describe('earliestEventInBuckets', () => {
  it('takes the minimum over non-empty buckets', async () => {
    const { getEvents } = fakeGetEvents({
      a: ['2024-01-10T12:00:00Z'],
      b: ['2023-06-01T12:00:00Z'],
      c: [],
    });
    const res = await earliestEventInBuckets(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any,
      getEvents
    );
    expect(res.toISOString().slice(0, 10)).toBe('2023-06-01');
  });
});
