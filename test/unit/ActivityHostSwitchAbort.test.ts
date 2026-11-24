import ActivityComponent from '~/views/activity/Activity.vue';

const abort = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ abort }) }));

const Activity: any = ActivityComponent;

function vm(overrides = {}) {
  return {
    periodLength: 'all',
    prioritySaving: false,
    earliestDate: '2020-01-01',
    loadEarliestDate: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => abort.mockClear());

test('switching host on All time aborts the old host load and clears the earliest date', () => {
  const v = vm();
  Activity.watch.host.call(v);
  expect(abort).toHaveBeenCalledTimes(1);
  expect(v.earliestDate).toBeNull();
  expect(v.loadEarliestDate).toHaveBeenCalled();
});

test('switching host on a bounded period leaves aborting to the refresh', () => {
  Activity.watch.host.call(vm({ periodLength: 'day' }));
  expect(abort).not.toHaveBeenCalled();
});

test('switching host during a priority save does not abort the shared client', () => {
  Activity.watch.host.call(vm({ prioritySaving: true }));
  expect(abort).not.toHaveBeenCalled();
});
