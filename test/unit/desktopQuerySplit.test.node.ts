import {
  DESKTOP_QUERY_EVENT_LIMIT,
  mergeEventsByKeys,
  mergeFullDesktopResults,
  periodsForFullDesktopQuery,
} from '~/util/desktopQuerySplit';
import { IEvent } from '~/util/interfaces';

function ev(
  data: Record<string, unknown>,
  duration: number,
  timestamp = '2026-02-01T00:00:00Z'
): IEvent {
  return { timestamp, duration, data };
}

describe('periodsForFullDesktopQuery', () => {
  const now = new Date('2026-08-28T12:00:00Z');

  test('keeps a single day as one period', () => {
    const periods = periodsForFullDesktopQuery(
      { start: '2026-08-01T04:00:00Z', length: [1, 'day'] },
      now
    );
    expect(periods).toHaveLength(1);
    expect(periods[0]).toContain('2026-08-01');
  });

  test('splits a week into 7 days', () => {
    const periods = periodsForFullDesktopQuery(
      { start: '2026-08-03T04:00:00Z', length: [1, 'week'] },
      now
    );
    expect(periods).toHaveLength(7);
  });

  test('splits February into daysInMonth', () => {
    const periods = periodsForFullDesktopQuery(
      { start: '2026-02-01T04:00:00Z', length: [1, 'month'] },
      now
    );
    expect(periods).toHaveLength(28);
  });

  test('drops days that start in the future', () => {
    const periods = periodsForFullDesktopQuery(
      { start: '2026-08-27T04:00:00Z', length: [1, 'week'] },
      now
    );
    expect(periods.length).toBeGreaterThan(0);
    expect(periods.length).toBeLessThan(7);
    for (const period of periods) {
      expect(new Date(period.split('/')[0]) < now).toBe(true);
    }
  });
});

describe('mergeEventsByKeys', () => {
  test('sums duration for the same key and keeps the earliest timestamp', () => {
    const merged = mergeEventsByKeys(
      [
        ev({ app: 'Firefox' }, 10, '2026-02-02T00:00:00Z'),
        ev({ app: 'Firefox' }, 5, '2026-02-01T00:00:00Z'),
        ev({ app: 'Code' }, 20, '2026-02-01T00:00:00Z'),
      ],
      ['app']
    );
    expect(merged.map(e => [e.data.app, e.duration])).toEqual([
      ['Code', 20],
      ['Firefox', 15],
    ]);
    expect(merged.find(e => e.data.app === 'Firefox')?.timestamp).toBe('2026-02-01T00:00:00Z');
  });

  test('groups title events by app+title', () => {
    const merged = mergeEventsByKeys(
      [
        ev({ app: 'Firefox', title: 'A' }, 3),
        ev({ app: 'Firefox', title: 'B' }, 4),
        ev({ app: 'Firefox', title: 'A' }, 2),
      ],
      ['app', 'title']
    );
    expect(merged).toHaveLength(2);
    expect(merged.find(e => e.data.title === 'A')?.duration).toBe(5);
  });

  test('respects the top-N limit after sort', () => {
    const events = Array.from({ length: DESKTOP_QUERY_EVENT_LIMIT + 5 }, (_, i) =>
      ev({ app: `app-${i}` }, i + 1)
    );
    const merged = mergeEventsByKeys(events, ['app'], DESKTOP_QUERY_EVENT_LIMIT);
    expect(merged).toHaveLength(DESKTOP_QUERY_EVENT_LIMIT);
    expect(merged[0].duration).toBe(DESKTOP_QUERY_EVENT_LIMIT + 5);
  });
});

describe('mergeFullDesktopResults', () => {
  test('merges window, browser, and stopwatch slices and sums durations', () => {
    const merged = mergeFullDesktopResults([
      {
        window: {
          app_events: [ev({ app: 'Firefox' }, 10)],
          title_events: [ev({ app: 'Firefox', title: 'A' }, 10)],
          cat_events: [ev({ $category: ['Work'] }, 10)],
          active_events: [ev({ status: 'not-afk' }, 10, '2026-02-01T00:00:00Z')],
          duration: 10,
        },
        browser: {
          domains: [ev({ $domain: 'example.com' }, 4)],
          urls: [ev({ url: 'https://example.com/' }, 4)],
          titles: [ev({ title: 'Example' }, 4)],
          duration: 4,
        },
        stopwatch: { stopwatch_events: [ev({ label: 'pomodoro' }, 8)] },
      },
      {
        window: {
          app_events: [ev({ app: 'Firefox' }, 7), ev({ app: 'Code' }, 3)],
          title_events: [ev({ app: 'Firefox', title: 'A' }, 7)],
          cat_events: [ev({ $category: ['Work'] }, 7), ev({ $category: ['Media'] }, 3)],
          active_events: [ev({ status: 'not-afk' }, 7, '2026-02-02T00:00:00Z')],
          duration: 10,
        },
        browser: {
          domains: [ev({ $domain: 'example.com' }, 2)],
          urls: [ev({ url: 'https://example.com/' }, 2)],
          titles: [ev({ title: 'Example' }, 2)],
          duration: 2,
        },
        stopwatch: { stopwatch_events: [ev({ label: 'pomodoro' }, 1)] },
      },
    ]);

    expect(merged.window?.duration).toBe(20);
    expect(merged.window?.app_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ app: 'Firefox' }),
          duration: 17,
        }),
        expect.objectContaining({ data: expect.objectContaining({ app: 'Code' }), duration: 3 }),
      ])
    );
    expect(merged.window?.cat_events).toHaveLength(2);
    expect(merged.window?.active_events).toHaveLength(2);
    expect(merged.browser?.duration).toBe(6);
    expect(merged.browser?.domains?.[0].duration).toBe(6);
    expect(merged.stopwatch?.stopwatch_events?.[0].duration).toBe(9);
  });

  test('tolerates missing slices', () => {
    const merged = mergeFullDesktopResults([{}, { window: { duration: 5, app_events: [] } }]);
    expect(merged.window?.duration).toBe(5);
    expect(merged.window?.app_events).toEqual([]);
    expect(merged.browser?.duration).toBe(0);
  });
});
