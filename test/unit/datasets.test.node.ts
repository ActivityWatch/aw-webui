import { buildBarchartDataset, groupDaysIntoWeeks } from '~/util/datasets';
import { Category } from '~/util/classes';
import { IEvent } from '~/util/interfaces';

const event = (path: string[] | undefined, duration: number): IEvent => ({
  timestamp: '2026-09-10T10:00:00Z',
  duration,
  data: { $category: path },
});

test('preserves missing paths, distinct separator-containing paths, and every period duration', () => {
  const classes: Category[] = [
    { name: ['Known'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Known', 'Child'], rule: { type: 'none' } },
  ];
  const periods = [
    {
      cat_events: [
        event(['Known', 'Child'], 3600),
        event(['Uncategorized'], 1800),
        event(['Deleted', 'Child'], 900),
        event(['A>>>B'], 360),
        event(['A', 'B'], 720),
      ],
    },
    { cat_events: [event(['Deleted', 'Child'], 1800), event(['Deleted', 'Child'], 900)] },
  ];
  const before = JSON.stringify({ classes, periods });
  const datasets = buildBarchartDataset(periods, classes);
  expect(datasets).toEqual([
    { label: 'Known > Child', backgroundColor: '#123456', data: [1, null] },
    { label: 'Uncategorized', backgroundColor: '#CCC', data: [0.5, null] },
    { label: 'Deleted > Child', backgroundColor: '#CCC', data: [0.25, 0.75] },
    { label: 'A>>>B', backgroundColor: '#CCC', data: [0.1, null] },
    { label: 'A > B', backgroundColor: '#CCC', data: [0.2, null] },
  ]);
  expect(JSON.stringify({ classes, periods })).toBe(before);
});

test('retains unclassified events and handles empty input', () => {
  expect(
    buildBarchartDataset([{ cat_events: [event([], 1800), event(undefined, 1800)] }], [])
  ).toEqual([{ label: 'Uncategorized', backgroundColor: '#CCC', data: [1] }]);
  expect(buildBarchartDataset([], [])).toEqual([]);
  expect(buildBarchartDataset(null, [])).toEqual([]);
});

describe('groupDaysIntoWeeks', () => {
  // 2026-10-15 is a Thursday. Ten days: Thu 15 .. Sat 24, starting at 04:00.
  const byDay: Record<string, { cat_events: IEvent[] }> = {};
  for (let d = 15; d <= 24; d++) {
    byDay[`2026-10-${d}T04:00:00+02:00/2026-10-${d + 1}T04:00:00+02:00`] = {
      cat_events: [event(['Work'], 3600 * (d - 14))],
    };
  }

  test('buckets days into Monday-start weeks, keeping partial edge weeks', () => {
    const { firstWeekStart, byWeek } = groupDaysIntoWeeks(byDay, 'Monday');
    expect(firstWeekStart).toBe('2026-10-12');
    expect(Object.keys(byWeek)).toEqual(['2026-10-12', '2026-10-19']);
    // Thu-Sun (days 1-4) then Mon-Sat (days 5-10)
    expect(byWeek['2026-10-12'].cat_events).toHaveLength(4);
    expect(byWeek['2026-10-19'].cat_events).toHaveLength(6);
    const hours = buildBarchartDataset(Object.values(byWeek), [])[0].data;
    expect(hours).toEqual([1 + 2 + 3 + 4, 5 + 6 + 7 + 8 + 9 + 10]);
  });

  test('honours a Sunday or Saturday start of week', () => {
    expect(Object.keys(groupDaysIntoWeeks(byDay, 'Sunday').byWeek)).toEqual([
      '2026-10-11',
      '2026-10-18',
    ]);
    expect(Object.keys(groupDaysIntoWeeks(byDay, 'Saturday').byWeek)).toEqual([
      '2026-10-10',
      '2026-10-17',
      '2026-10-24',
    ]);
  });

  test('keys by the written date, not the UTC date', () => {
    // Monday 00:30 in UTC+2 is Sunday 22:30 UTC; it must stay in Monday's week.
    const { byWeek } = groupDaysIntoWeeks(
      { '2026-10-19T00:30:00+02:00/2026-10-20T00:30:00+02:00': { cat_events: [] } },
      'Monday'
    );
    expect(Object.keys(byWeek)).toEqual(['2026-10-19']);
  });

  test('handles empty input', () => {
    expect(groupDaysIntoWeeks({}, 'Monday')).toEqual({ firstWeekStart: null, byWeek: {} });
  });
});
