import TimelineComponent from '~/views/Timeline.vue';
import moment from 'moment';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Timeline: any = TimelineComponent;

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
    classes: [
      { id: 0, name: ['Work'], rule: { type: 'regex', regex: 'Code' } },
      { id: 1, name: ['Play'], rule: { type: 'regex', regex: 'Game' } },
    ],
    classes_for_query: [],
  }),
}));

const event = (offset, duration, app) => ({
  timestamp: moment.utc('2026-10-18T09:00:00Z').add(offset, 'seconds').toISOString(),
  duration,
  data: { app, title: app },
});
// The raw bucket has one extra event that the AFK filter drops: the user was
// away while it ran. It matches the Work category and is over the minimum
// duration, so a page that silently used the raw events would show it.
const windowEvents = () => [
  event(0, 5, 'Code'),
  event(100, 60, 'Code'),
  event(200, 60, 'Game'),
  { ...event(300, 60, 'Code'), data: { app: 'Code', title: 'Code (away)' } },
];
const afkFilteredEvents = () => windowEvents().filter(e => e.data.title !== 'Code (away)');

const context = () => ({
  ...Timeline.data(),
  ...Timeline.methods,
  daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')],
  always_active_pattern: '',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBucketsWithEvents.mockResolvedValue([
    {
      id: 'window_laptop',
      type: 'currentwindow',
      hostname: 'laptop',
      client: 'window',
      events: windowEvents(),
    },
    { id: 'afk_laptop', type: 'afkstatus', hostname: 'laptop', client: 'afk', events: [] },
  ]);
});

const windowRow = vm => vm.buckets.find(b => b.id === 'window_laptop');

test('Exclude AFK keeps the minimum-duration filter', async () => {
  const vm = context();
  vm._queryAfkFilteredEvents = jest.fn(async () => afkFilteredEvents());
  vm.filter_duration = 30;
  vm.filter_afk = true;
  await vm.getBuckets();

  expect(vm._queryAfkFilteredEvents).toHaveBeenCalled();
  expect(windowRow(vm).events.map(e => e.duration)).toEqual([60, 60]);
  // The AFK-only event is gone, not merely filtered from the raw list's copy.
  expect(windowRow(vm).events.map(e => e.data.title)).not.toContain('Code (away)');
});

test('Exclude AFK keeps the category filter', async () => {
  const vm = context();
  vm._queryAfkFilteredEvents = jest.fn(async () => afkFilteredEvents());
  vm.filter_categories = [['Work']];
  vm.filter_afk = true;
  await vm.getBuckets();

  expect(windowRow(vm).events.map(e => e.data.app)).toEqual(['Code', 'Code']);
  expect(windowRow(vm).events.map(e => e.data.title)).not.toContain('Code (away)');
});
