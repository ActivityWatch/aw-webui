import { activeDurationQuery } from '~/queries';
import { createPinia, setActivePinia } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';

const mockQuery = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ query: mockQuery }) }));
const source = {
  bid_afk: 'afk_host',
  bid_window: 'window_host',
  bid_browsers: ['aw-watcher-web-chrome_host'],
};

beforeEach(() => {
  setActivePinia(createPinia());
  mockQuery
    .mockReset()
    .mockImplementation(periods =>
      Promise.resolve(
        periods.map(() => [
          { timestamp: '2026-09-01T10:00:00Z', duration: 60, data: { app: 'Test' } },
        ])
      )
    );
});

test('uses canonical active evidence with optional audible and app/title patterns', () => {
  const query = activeDurationQuery([source], {
    include_audible: true,
    always_active_pattern: 'a"b;code',
  }).join('\n');
  expect(query).toContain('filter_keyvals(browser_events, "audible", [true])');
  expect(query).toContain('filter_keyvals_regex(events, "app", "a\\"b;code")');
  expect(query).toContain('filter_keyvals_regex(events, "title", "a\\"b;code")');
  expect(query).toContain('union_no_overlap(history_events, not_afk)');
  expect(query).not.toContain('categorize(');
});

test('disabled AFK filtering returns window coverage while AFK-only sources retain the fallback', () => {
  const query = activeDurationQuery([source, { bid_afk: 'afk_only' }], { filter_afk: false }).join(
    '\n'
  );
  expect(query).toContain('union_no_overlap(history_events, events)');
  expect(query).toContain('query_bucket("afk_only")');
  expect(query).not.toContain('filter_period_intersect(events, not_afk)');
  expect(query.match(/RETURN/g)).toHaveLength(1);
  expect(query).not.toContain('audible_events =');
});

test('missing browsers and an empty source list never introduce missing bucket references', () => {
  expect(
    activeDurationQuery([{ bid_afk: 'afk', bid_window: 'window' }], { include_audible: true }).join(
      ' '
    )
  ).not.toMatch(/query_bucket\("(?:undefined|null)"\)/);
  expect(activeDurationQuery([])).toEqual(['history_events = [];', 'RETURN = history_events;']);
});

test('store passes activity options and normalizes every returned event for the history chart', async () => {
  const store = useActivityStore();
  store.buckets.afk = [source.bid_afk];
  store.buckets.window = [source.bid_window];
  store.buckets.browser = source.bid_browsers;
  await store.query_active_history({
    host: 'host',
    timeperiod: { start: '2026-01-01T04:00:00Z', length: [1, 'day'] },
    include_audible: true,
    always_active_pattern: 'Code',
    filter_categories: [['Work']],
  });
  const query = (getClient().query as jest.Mock).mock.calls[0][1].join('\n');
  expect(query).toContain('audible_events =');
  expect(query).toContain('"Code"');
  expect(query).not.toContain('Work');
  expect(
    Object.values(store.active.history).every(events => events[0].data.status === 'not-afk')
  ).toBe(true);
});

test('multidevice history resolves real per-host window, AFK and browser bucket IDs', async () => {
  useSettingsStore().useMultidevice = true;
  const buckets = useBucketsStore();
  buckets.buckets = Object.fromEntries(
    [
      ['custom-afk_a', 'afkstatus', 'a'],
      ['custom-window_a', 'currentwindow', 'a'],
      ['aw-watcher-web-chrome_a', 'web.tab.current', 'a'],
      ['custom-afk_b', 'afkstatus', 'b'],
    ].map(([id, type, hostname]) => [id, { id, type, hostname, data: {} }])
  ) as any;
  await useActivityStore().query_active_history({
    host: 'a',
    timeperiod: { start: '2026-01-01T04:00:00Z', length: [1, 'day'] },
    include_audible: true,
  });
  const query = mockQuery.mock.calls[0][1].join('\n');
  for (const id of ['custom-afk_a', 'custom-window_a', 'aw-watcher-web-chrome_a', 'custom-afk_b']) {
    expect(query).toContain(`query_bucket("${id}")`);
  }
  expect(query).not.toContain('aw-watcher-window_b');
});

// Regression: the AFK-only fallback must contribute real intervals.
//
// Routing it through activityQuery left that function's trailing
// merge_events_by_keys(not_afk, ["status"]) in the emitted query, which
// collapses every not-afk period into a single event carrying the first
// timestamp and the summed duration (see aw-transform's merge_events_by_keys).
// Unioning that synthetic block against another source's real periods trims
// time that was never concurrent, so multidevice with an AFK-only host
// under-counted active time.
describe('AFK-only sources keep their interval structure', () => {
  const gen = sources => activeDurationQuery(sources).join('\n');

  test('never merges periods before unioning them', () => {
    for (const sources of [
      [{ bid_afk: 'afk_a' }],
      [{ bid_afk: 'afk_a' }, { bid_afk: 'afk_b' }],
      [{ bid_afk: 'afk_a', bid_window: 'win_a' }, { bid_afk: 'afk_b' }],
    ]) {
      expect(gen(sources)).not.toContain('merge_events_by_keys');
    }
  });

  test('each AFK-only source is queried as intervals and unioned', () => {
    const q = gen([{ bid_afk: 'afk_a' }, { bid_afk: 'afk_b' }]);

    expect(q).toContain('not_afk = flood(query_bucket("afk_a"));');
    expect(q).toContain('not_afk = flood(query_bucket("afk_b"));');
    expect(q.match(/union_no_overlap\(history_events, not_afk\)/g)).toHaveLength(2);
  });

  test('a mixed desktop and AFK-only set contributes both', () => {
    const q = gen([{ bid_afk: 'afk_a', bid_window: 'win_a' }, { bid_afk: 'afk_b' }]);

    expect(q).toContain('query_bucket("win_a")');
    expect(q).toContain('not_afk = flood(query_bucket("afk_b"));');
    expect(q).not.toContain('merge_events_by_keys');
  });

  test('AFK-only bucket ids are escaped', () => {
    expect(gen([{ bid_afk: 'afk_ho"st' }])).toContain('query_bucket("afk_ho\\"st")');
  });

  test('brackets stay balanced for every source shape', () => {
    for (const sources of [
      [{ bid_afk: 'afk_a' }],
      [{ bid_afk: 'afk_a' }, { bid_afk: 'afk_b' }],
      [{ bid_afk: 'afk_a', bid_window: 'win_a', bid_browsers: ['web_a'] }, { bid_afk: 'afk_b' }],
    ]) {
      const q = gen(sources);
      expect((q.match(/\(/g) || []).length).toEqual((q.match(/\)/g) || []).length);
      expect((q.match(/\{/g) || []).length).toEqual((q.match(/\}/g) || []).length);
    }
  });
});
