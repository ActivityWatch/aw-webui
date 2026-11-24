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
// Raw and AFK-filtered events are the same here; the user is never AFK.
const windowEvents = () => [event(0, 5, 'Code'), event(100, 60, 'Code'), event(200, 60, 'Game')];

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
  vm._queryAfkFilteredEvents = jest.fn(async () => windowEvents());
  vm.filter_duration = 30;
  vm.filter_afk = true;
  await vm.getBuckets();

  expect(vm._queryAfkFilteredEvents).toHaveBeenCalled();
  expect(windowRow(vm).events.map(e => e.duration)).toEqual([60, 60]);
});

test('Exclude AFK keeps the category filter', async () => {
  const vm = context();
  vm._queryAfkFilteredEvents = jest.fn(async () => windowEvents());
  vm.filter_categories = [['Work']];
  vm.filter_afk = true;
  await vm.getBuckets();

  expect(windowRow(vm).events.map(e => e.data.app)).toEqual(['Code', 'Code']);
});
