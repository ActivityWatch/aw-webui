import Timeline from '~/views/Timeline.vue';
import moment from 'moment';
import { categoryTimelineQuery, mergeCategoryIntervals } from '~/util/timelineCategories';

const mockQuery = jest.fn().mockResolvedValue([[]]);
const mockGetBucketsWithEvents = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ query: mockQuery }) }));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    getBucketsWithEvents: mockGetBucketsWithEvents,
    bucketsAFK: host => (host === 'laptop' ? ['afk_laptop'] : []),
  }),
}));
jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => ({
    classes: [],
    classes_for_query: [[['Work'], { type: 'regex', regex: 'Code' }]],
  }),
}));

const event = (offset, duration, category = ['Work']) => ({
  timestamp: moment.utc('2026-10-18T09:00:00Z').add(offset, 'seconds').toISOString(),
  duration,
  data: { app: 'Code', title: 'changing title', $category: category },
});
const buckets = () => [
  { id: 'window_laptop', type: 'currentwindow', hostname: 'laptop', client: 'window', events: [] },
  { id: 'afk_laptop', type: 'afkstatus', hostname: 'laptop', client: 'afk', events: [] },
  {
    id: 'window_desktop',
    type: 'currentwindow',
    hostname: 'desktop',
    client: 'window',
    events: [],
  },
];
const context = () => ({
  ...Timeline.data(),
  ...Timeline.methods,
  daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')],
  always_active_pattern: '',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBucketsWithEvents.mockResolvedValue(buckets());
  mockQuery.mockResolvedValue([
    [event(0, 10), event(10, 20), event(35, 5), event(40, 5, ['Play'])],
  ]);
});

test('queries all visible window buckets and merges only contiguous final categories', async () => {
  const vm = context();
  await vm.getBuckets();
  expect(mockQuery).toHaveBeenCalledTimes(1);
  const code = mockQuery.mock.calls[0][1].join('\n');
  expect(code).toContain('window_laptop');
  expect(code).toContain('window_desktop');
  expect(code).toContain('categorize(events,');
  expect(code).toContain('union_no_overlap');
  expect(vm.categorizedEvents.map(e => e.duration)).toEqual([30, 5, 5]);
  expect(vm.categorizedEvents[0].data).toEqual({ $category: ['Work'] });
  expect(vm.categorizedEvents[0].id).toBeUndefined();
});

test('host/client filters restrict sources but AFK lookup retains the matching host bucket', async () => {
  const vm = context();
  vm.filter_hostname = 'laptop';
  vm.filter_client = 'window';
  vm.filter_afk = true;
  await vm.getBuckets();
  const code = mockQuery.mock.calls[0][1].join('\n');
  expect(code).toContain('window_laptop');
  expect(code).not.toContain('window_desktop');
  expect(code).toContain('afk_laptop');
  expect(code).toContain('filter_period_intersect');
});

test('no supported activity sources produces an empty row without a mockQuery', async () => {
  mockGetBucketsWithEvents.mockResolvedValue([buckets()[1]]);
  const vm = context();
  await vm.getBuckets();
  expect(vm.categorizedEvents).toEqual([]);
  expect(mockQuery).not.toHaveBeenCalled();
});

test('empty results replace the previous day rather than retaining stale categories', async () => {
  const vm = context();
  await vm.getBuckets();
  mockQuery.mockResolvedValue([[]]);
  await vm.getBuckets();
  expect(vm.categorizedEvents).toEqual([]);
});

test('duration filtering applies after merging rather than dropping short source events', async () => {
  const vm = context();
  vm.filter_duration = 25;
  await vm.getBuckets();
  expect(vm.categorizedEvents.map(e => e.duration)).toEqual([30]);
});

test('query failure clears the old row and shows an explicit warning alongside raw events', async () => {
  const vm = context();
  await vm.getBuckets();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  mockQuery.mockRejectedValueOnce(new Error('offline'));
  await vm.getBuckets();
  expect(vm.categoryError).toBe(true);
  expect(vm.categorizedEvents).toEqual([]);
  expect(vm.buckets).toHaveLength(3);
  warn.mockRestore();
});

test('a slow old query cannot overwrite the newly selected day', async () => {
  const vm = context();
  let finishOld;
  mockQuery.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishOld = resolve;
      })
  );
  const old = vm.getBuckets();
  await Promise.resolve();
  vm.daterange = [moment.utc('2026-10-19'), moment.utc('2026-10-20')];
  mockQuery.mockResolvedValueOnce([[event(0, 60, ['Play'])]]);
  await vm.getBuckets();
  finishOld([[event(0, 10)]]);
  await old;
  expect(vm.categorizedEvents[0].data.$category).toEqual(['Play']);
});

test.each(['resolve', 'reject'])(
  'publishes new raw rows and clears old categories before a slow category query can %s',
  async outcome => {
    const vm = context();
    await vm.getBuckets();
    expect(vm.categorizedEvents).not.toHaveLength(0);
    const raw = buckets();
    raw[0].events = [event(60, 15)];
    mockGetBucketsWithEvents.mockResolvedValueOnce(raw);
    let finishCategory;
    mockQuery.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finishCategory = outcome === 'resolve' ? resolve : reject;
        })
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loading = vm.getBuckets();
    // The category request remains pending throughout these assertions.
    await Promise.resolve();
    await Promise.resolve();
    expect(vm.buckets).toBe(raw);
    expect(vm.buckets[0].events).toEqual([event(60, 15)]);
    expect(vm.categorizedEvents).toEqual([]);
    expect(vm.categoryError).toBe(false);
    finishCategory(outcome === 'resolve' ? [[event(60, 15)]] : new Error('offline'));
    await loading;
    expect(vm.categorizedEvents).toHaveLength(outcome === 'resolve' ? 1 : 0);
    expect(vm.categoryError).toBe(outcome === 'reject');
    warn.mockRestore();
  }
);

test('an obsolete raw AFK response cannot replace the new range or its category row', async () => {
  const vm = context();
  vm.filter_afk = true;
  let finishOldAfk;
  let finishOldCategory;
  vm._applyAfkFilter = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishOldAfk = resolve;
        })
    )
    .mockImplementation(async rows => rows);
  mockQuery.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finishOldCategory = resolve;
      })
  );
  const old = vm.getBuckets();
  await Promise.resolve();
  await Promise.resolve();
  const newRaw = buckets();
  newRaw[0].events = [event(60, 30, ['Play'])];
  mockGetBucketsWithEvents.mockResolvedValueOnce(newRaw);
  mockQuery.mockResolvedValueOnce([[event(60, 30, ['Play'])]]);
  await vm.getBuckets();
  finishOldCategory([[event(0, 10)]]);
  finishOldAfk(buckets());
  await old;
  expect(vm.buckets).toBe(newRaw);
  expect(vm.categorizedEvents[0].data.$category).toEqual(['Play']);
  expect(vm.categoryError).toBe(false);
});

test('mobile canonical queries retain timestamps, use actual synced IDs, and omit AFK', () => {
  const sources = [
    { id: 'aw-watcher-android-synced-from-phone', type: 'currentwindow', hostname: 'phone' },
    { id: 'aw-import-screentime_phone', type: 'app', hostname: 'ios' },
  ];
  const code = categoryTimelineQuery(sources, sources, {
    categories: [],
    filter_categories: [],
    filter_afk: true,
  }).join('\n');
  expect(code).toContain('aw-watcher-android-synced-from-phone');
  expect(code).toContain('aw-import-screentime_phone');
  expect(code).not.toContain('filter_period_intersect');
  expect(code).not.toContain('merge_events_by_keys');
});

test('parent category filters include descendants after resolving source overlap', () => {
  const code = categoryTimelineQuery(buckets(), buckets(), {
    categories: [[['Work', 'Programming'], { type: 'regex', regex: 'Code' }]],
    filter_categories: [['Work']],
    filter_afk: false,
  }).join('\n');
  expect(code).toContain('filter_keyvals(events, "$category", [["Work"],["Work","Programming"]])');
  expect(code.indexOf('filter_keyvals(events, "$category"')).toBeGreaterThan(
    code.lastIndexOf('union_no_overlap')
  );
});

test('merging preserves real gaps, category boundaries, and immutable source data', () => {
  const events = [
    event(40, 5),
    event(0, 10),
    event(10, 5, ['Play']),
    event(15, 0),
    event(20, 10),
    event(30, 5),
  ];
  const original = JSON.parse(JSON.stringify(events));
  expect(mergeCategoryIntervals(events).map(e => [e.duration, e.data.$category])).toEqual([
    [10, ['Work']],
    [5, ['Play']],
    [15, ['Work']],
    [5, ['Work']],
  ]);
  expect(events).toEqual(original);
  const uncategorized = mergeCategoryIntervals([{ ...event(0, 1), data: {} }]);
  expect(uncategorized[0].data.$category).toEqual(['Uncategorized']);
});
