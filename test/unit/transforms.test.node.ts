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
    const empty_at_start = [ev('2026-10-19T00:00:00Z', 0, 'empty-start')];
    const empty_inside = [ev('2026-10-19T00:00:05Z', 0, 'empty-inside')];
    const empty_at_end = [ev('2026-10-19T00:00:10Z', 0, 'empty-end')];
    const span = [ev('2026-10-19T00:00:00Z', 10, 'span')];

    // A zero-length event spans no time, so it must not block a bucket merge.
    for (const empty of [empty_at_start, empty_inside, empty_at_end]) {
      expect(overlappingEvents(empty, span)).toHaveLength(0);
      expect(overlappingEvents(span, empty)).toHaveLength(0);
    }

    const two_empty = [
      ev('2026-10-19T00:00:05Z', 0, 'empty-a'),
      ev('2026-10-19T00:00:05Z', 0, 'empty-b'),
    ];
    expect(overlappingEvents(two_empty, two_empty)).toHaveLength(0);
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

  test('enumerates every pair when the second list is internally overlapping', () => {
    const events1 = [ev('2026-10-19T00:00:00Z', 100, 'A'), ev('2026-10-19T00:00:15Z', 35, 'B')];
    const events2 = [ev('2026-10-19T00:00:10Z', 10, 'X')];

    // B overlaps X too; a one-pointer-per-step sweep never compares them.
    expect(
      pairIds(overlappingEvents(events1, events2)).map(p => p.slice().sort().join('-'))
    ).toEqual(['A-X', 'B-X']);
  });

  test('enumerates every pair when the first list is internally overlapping', () => {
    const events1 = [ev('2026-10-19T00:00:10Z', 10, 'X')];
    const events2 = [ev('2026-10-19T00:00:00Z', 100, 'A'), ev('2026-10-19T00:00:15Z', 35, 'B')];

    expect(
      pairIds(overlappingEvents(events1, events2)).map(p => p.slice().sort().join('-'))
    ).toEqual(['A-X', 'B-X']);
  });

  test('self-comparison enumerates every pair among internally overlapping events', () => {
    const events = [
      ev('2026-10-19T00:00:00Z', 100, 'A'),
      ev('2026-10-19T00:00:10Z', 10, 'B'),
      ev('2026-10-19T00:00:15Z', 35, 'C'),
    ];

    const pairs = pairIds(overlappingEvents(events, events)).map(p => p.slice().sort().join('-'));
    expect(pairs.slice().sort()).toEqual(['A-B', 'A-C', 'B-C']);
  });

  test('matches a brute-force all-pairs reference on generated input', () => {
    // Deterministic PRNG so a failure is reproducible without a seed argument.
    let state = 123456789;
    const next = () => {
      state = (1103515245 * state + 12345) % 2147483648;
      return state / 2147483648;
    };
    const makeEvents = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => {
        const start = Math.floor(next() * 60);
        const duration = Math.floor(next() * 20);
        return ev(
          new Date(Date.UTC(2026, 9, 19, 0, 0, start)).toISOString(),
          duration,
          `${prefix}${index}`
        );
      });

    const referencePairs = (first, second) => {
      const bounds = list =>
        list.map(e => {
          const start_ms = new Date(e.timestamp).valueOf();
          return { event: e, start_ms, end_ms: start_ms + 1000 * e.duration };
        });
      const a = bounds(first);
      const b = bounds(second);
      const found = [];
      const same = first === second;
      for (let x = 0; x < a.length; x++) {
        for (let y = same ? x + 1 : 0; y < b.length; y++) {
          const one = a[x];
          const two = b[y];
          if (
            one.start_ms < one.end_ms &&
            two.start_ms < two.end_ms &&
            one.start_ms < two.end_ms &&
            two.start_ms < one.end_ms
          ) {
            found.push([one.event.id, two.event.id].slice().sort().join('-'));
          }
        }
      }
      return found.sort();
    };

    for (let trial = 0; trial < 200; trial++) {
      const first = makeEvents('a', 1 + Math.floor(next() * 6));
      const second = makeEvents('b', 1 + Math.floor(next() * 6));

      const actual = pairIds(overlappingEvents(first, second))
        .map(p => p.slice().sort().join('-'))
        .sort();
      expect(actual).toEqual(referencePairs(first, second));

      const same_list = first.slice();
      const same_actual = pairIds(overlappingEvents(same_list, same_list))
        .map(p => p.slice().sort().join('-'))
        .sort();
      expect(same_actual).toEqual(referencePairs(same_list, same_list));
    }
  });
});
