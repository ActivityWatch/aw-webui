import { timelineListRows, TIMELINE_LIST_PAGE_SIZE } from '~/util/timelineList';

const bucket = (id: string, hostname: string, type: string, events: object[]) => ({
  id,
  hostname,
  type,
  events,
});

describe('timelineListRows', () => {
  test('orders rows chronologically across buckets and computes end times', () => {
    const rows = timelineListRows([
      bucket('aw-watcher-window_a', 'a', 'currentwindow', [
        { timestamp: '2026-01-01T10:05:00Z', duration: 60, data: { app: 'vim', title: 'x.py' } },
      ]),
      bucket('aw-watcher-afk_a', 'a', 'afkstatus', [
        { timestamp: '2026-01-01T10:00:00Z', duration: 30, data: { status: 'afk' } },
      ]),
    ]);
    expect(rows.map(r => r.bucketId)).toEqual(['aw-watcher-afk_a', 'aw-watcher-window_a']);
    expect(rows[0].start).toBe(Date.parse('2026-01-01T10:00:00Z'));
    expect(rows[0].end).toBe(Date.parse('2026-01-01T10:00:30Z'));
    expect(rows[1].end - rows[1].start).toBe(60 * 1000);
    expect(rows[1].duration).toBe(60);
    expect(rows[1].hostname).toBe('a');
  });

  test('keeps overlapping events from different buckets as separate rows', () => {
    const rows = timelineListRows([
      bucket('aw-watcher-window_a', 'a', 'currentwindow', [
        {
          timestamp: '2026-01-01T10:00:00Z',
          duration: 600,
          data: { app: 'Firefox', title: 'Docs' },
        },
      ]),
      bucket('aw-watcher-web-firefox_a', 'a', 'web.tab.current', [
        {
          timestamp: '2026-01-01T10:01:00Z',
          duration: 120,
          data: { url: 'https://example.com/a', title: 'Example' },
        },
      ]),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe('Firefox');
    expect(rows[0].detail).toBe('Docs');
    expect(rows[1].label).toBe('example.com');
    expect(rows[1].detail).toBe('Example');
  });

  test('breaks equal timestamps by bucket id, then source order, deterministically', () => {
    const ts = '2026-01-01T10:00:00Z';
    const buckets = [
      bucket('b', 'h', 'currentwindow', [
        { timestamp: ts, duration: 1, data: { app: 'b1' } },
        { timestamp: ts, duration: 2, data: { app: 'b2' } },
      ]),
      bucket('a', 'h', 'currentwindow', [{ timestamp: ts, duration: 3, data: { app: 'a1' } }]),
    ];
    const labels = timelineListRows(buckets).map(r => r.label);
    expect(labels).toEqual(['a1', 'b1', 'b2']);
    expect(timelineListRows([...buckets].reverse()).map(r => r.label)).toEqual(labels);
    // Keys are unique even when timestamps collide
    const keys = timelineListRows(buckets).map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('flags times clipped to the queried range instead of presenting them as exact', () => {
    // The server truncates events to the query range: an event that really started at
    // 09:59 arrives as starting at 10:00 for a 10:00-11:00 query. Rows touching the
    // range edges are flagged so the list does not claim those are the true times.
    const range: [string, string] = ['2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z'];
    const rows = timelineListRows(
      [
        bucket('w', 'h', 'currentwindow', [
          { timestamp: '2026-01-01T10:00:00Z', duration: 60, data: { app: 'clipped-start' } },
          { timestamp: '2026-01-01T10:30:00Z', duration: 60, data: { app: 'inside' } },
          { timestamp: '2026-01-01T10:59:00Z', duration: 60, data: { app: 'clipped-end' } },
        ]),
      ],
      range
    );
    expect(rows.map(r => [r.label, r.clippedStart, r.clippedEnd])).toEqual([
      ['clipped-start', true, false],
      ['inside', false, false],
      ['clipped-end', false, true],
    ]);
    // Without a range nothing is flagged
    expect(
      timelineListRows([
        bucket('w', 'h', 'currentwindow', [{ timestamp: range[0], duration: 1, data: {} }]),
      ])[0].clippedStart
    ).toBe(false);
  });

  test('returns every event; paging past the first page is the caller’s choice', () => {
    const events = Array.from({ length: 250 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      duration: 1,
      data: { app: `app${i}` },
    }));
    const rows = timelineListRows([bucket('w', 'h', 'currentwindow', events)]);
    expect(rows).toHaveLength(250);
    expect(TIMELINE_LIST_PAGE_SIZE).toBe(100);
    expect(rows[249].label).toBe('app249');
  });

  test('summarizes data for bucket types without a title attribute', () => {
    const rows = timelineListRows([
      bucket('aw-watcher-agent_h', 'h', 'agent.session', [
        {
          timestamp: '2026-01-01T10:00:00Z',
          duration: 5,
          data: { harness: 'cli', model: 'x', note: 'n'.repeat(200) },
        },
      ]),
    ]);
    expect(rows[0].label).toBe('');
    expect(rows[0].detail.startsWith('harness: cli, model: x, note: nnn')).toBe(true);
    expect(rows[0].detail.length).toBeLessThanOrEqual(120);
  });

  test('tolerates missing buckets and events', () => {
    expect(timelineListRows(null)).toEqual([]);
    expect(timelineListRows([{ id: 'x', hostname: 'h', type: 'currentwindow' }])).toEqual([]);
  });
});
