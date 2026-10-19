import { overlappingEvents } from '~/util/transforms';

function ev(timestamp: string, duration: number, id?: string) {
  return { timestamp, duration, id: id ?? `${timestamp}/${duration}` };
}

function pairIds(pairs: ReturnType<typeof overlappingEvents>) {
  return pairs.map(([a, b]) => [a.event.id, b.event.id]);
}

describe('overlappingEvents', () => {
  test('detects overlap when the second interval is contained in the first', () => {
    const inner = [ev('2026-10-19T00:00:10Z', 10, 'inner')];
    const outer = [ev('2026-10-19T00:00:00Z', 30, 'outer')];

    expect(overlappingEvents(inner, outer)).toHaveLength(1);
  });

  test('detects overlap when the first interval is contained in the second', () => {
    const inner = [ev('2026-10-19T00:00:10Z', 10, 'inner')];
    const outer = [ev('2026-10-19T00:00:00Z', 30, 'outer')];

    expect(overlappingEvents(outer, inner)).toHaveLength(1);
  });

  test('overlap detection is symmetric', () => {
    const cases: Array<[ReturnType<typeof ev>, ReturnType<typeof ev>]> = [
      [ev('2026-10-19T00:00:10Z', 10), ev('2026-10-19T00:00:00Z', 30)], // containment
      [ev('2026-10-19T00:00:00Z', 30), ev('2026-10-19T00:00:10Z', 10)], // reversed containment
      [ev('2026-10-19T00:00:00Z', 10), ev('2026-10-19T00:00:05Z', 10)], // partial
      [ev('2026-10-19T00:00:00Z', 10), ev('2026-10-19T00:00:00Z', 10)], // equal bounds
      [ev('2026-10-19T00:00:00Z', 10), ev('2026-10-19T00:00:10Z', 10)], // adjacent
      [ev('2026-10-19T00:00:00Z', 10), ev('2026-10-19T01:00:00Z', 10)], // disjoint
    ];

    for (const [a, b] of cases) {
      expect(overlappingEvents([a], [b]).length).toBe(overlappingEvents([b], [a]).length);
    }
  });

  test('equal bounds overlap', () => {
    const a = [ev('2026-10-19T00:00:00Z', 10, 'a')];
    const b = [ev('2026-10-19T00:00:00Z', 10, 'b')];

    expect(overlappingEvents(a, b)).toHaveLength(1);
  });

  test('adjacent intervals do not overlap', () => {
    const a = [ev('2026-10-19T00:00:00Z', 10, 'a')];
    const b = [ev('2026-10-19T00:00:10Z', 10, 'b')];

    expect(overlappingEvents(a, b)).toHaveLength(0);
  });

  test('zero-duration events do not overlap anything', () => {
    const a = [ev('2026-10-19T00:00:00Z', 0, 'a')];
    const b = [ev('2026-10-19T00:00:00Z', 10, 'b')];

    expect(overlappingEvents(a, b)).toHaveLength(0);
  });

  test('finds every pair when one interval contains several others', () => {
    const outer = [ev('2026-10-19T00:00:00Z', 100, 'outer')];
    const inner = [
      ev('2026-10-19T00:00:10Z', 10, 'a'),
      ev('2026-10-19T00:00:30Z', 10, 'b'),
      ev('2026-10-19T00:00:50Z', 10, 'c'),
    ];

    expect(overlappingEvents(outer, inner)).toHaveLength(3);
    expect(overlappingEvents(inner, outer)).toHaveLength(3);
  });

  test('unsorted input is handled in both directions', () => {
    const events1 = [
      ev('2026-10-19T00:00:50Z', 10, 'late'),
      ev('2026-10-19T00:00:10Z', 10, 'early'),
    ];
    const events2 = [ev('2026-10-19T00:00:00Z', 100, 'outer')];

    expect(overlappingEvents(events1, events2)).toHaveLength(2);
  });

  test('does not mutate the input arrays', () => {
    const events1 = [
      ev('2026-10-19T00:00:50Z', 10, 'late'),
      ev('2026-10-19T00:00:10Z', 10, 'early'),
    ];
    const events2 = [ev('2026-10-19T00:00:00Z', 100, 'outer')];
    const events1_order = events1.map(e => e.id);
    const events2_order = events2.map(e => e.id);

    overlappingEvents(events1, events2);

    expect(events1.map(e => e.id)).toEqual(events1_order);
    expect(events2.map(e => e.id)).toEqual(events2_order);
  });

  test('self-comparison skips each event against itself', () => {
    const events = [ev('2026-10-19T00:00:00Z', 10, 'a'), ev('2026-10-19T00:00:30Z', 10, 'b')];

    expect(overlappingEvents(events, events)).toHaveLength(0);
  });

  test('self-comparison reports genuine overlaps once', () => {
    const events = [
      ev('2026-10-19T00:00:00Z', 30, 'outer'),
      ev('2026-10-19T00:00:10Z', 10, 'inner'),
    ];

    const pairs = pairIds(overlappingEvents(events, events));
    expect(pairs).toHaveLength(1);
    expect(pairs[0].slice().sort()).toEqual(['inner', 'outer']);
  });
});
