import Component from '~/visualizations/TopBucketData.vue';
import { earliestEventInBucket } from '~/util/earliestEvent';

const TopBucketData: any = Component;
const mockGetEvents = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ getEvents: mockGetEvents }) }));
jest.mock('~/stores/activity', () => ({ useActivityStore: () => ({ query_options: {} }) }));
jest.mock('~/stores/buckets', () => ({ useBucketsStore: () => ({}) }));
jest.mock('~/util/earliestEvent', () => ({
  ...jest.requireActual('~/util/earliestEvent'),
  earliestEventInBucket: jest.fn(),
}));

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const events = (label: string) => [{ duration: 10, data: { label } }];
const tick = () => Promise.resolve();
function instance() {
  const vm: any = {
    ...TopBucketData.data.call({}),
    selectedBucketId: 'bucket-a',
    selectedField: 'label',
    selectedFieldValue: 'label',
    timeRange: { start: '2026-10-20', end: '2026-10-21' },
    activityStore: { query_options: { all_time: false } },
    bucketsStore: { getBucket: jest.fn(id => ({ id })) },
    $t: (key: string) => key,
  };
  for (const [key, method] of Object.entries(TopBucketData.methods)) {
    vm[key] = (method as (...args: any[]) => any).bind(vm);
  }
  return vm;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test.each(['date change', 'refresh', 'bucket round trip'])(
  '%s ignores obsolete success',
  async mode => {
    const old = deferred();
    const current = deferred();
    const middle = deferred();
    mockGetEvents.mockReturnValueOnce(old.promise);
    if (mode === 'bucket round trip') mockGetEvents.mockReturnValueOnce(middle.promise);
    mockGetEvents.mockReturnValueOnce(current.promise);
    const vm = instance();
    const first = vm.loadEvents();
    await tick();
    if (mode === 'date change') vm.timeRange = { start: '2026-10-21', end: '2026-10-22' };
    if (mode === 'bucket round trip') {
      vm.selectedBucketId = 'bucket-b';
      const middleLoad = vm.loadEvents();
      await tick();
      middle.resolve(events('BUCKET B'));
      await middleLoad;
      vm.selectedBucketId = 'bucket-a';
    }
    const second = vm.loadEvents();
    await tick();
    current.resolve(events('NEW'));
    await second;
    old.resolve(events('OLD'));
    await first;
    expect(vm.events).toEqual(events('NEW'));
    expect(vm.aggregated[0].data.display).toBe('NEW');
    expect(vm.error).toBe('');
    expect(vm.loading).toBe(false);
  }
);

test('obsolete failure does not clear current results or publish an error', async () => {
  const old = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise).mockResolvedValueOnce(events('NEW'));
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  await vm.loadEvents();
  old.reject(new Error('OLD FAILURE'));
  await first;
  expect(vm.events).toEqual(events('NEW'));
  expect(vm.fieldOptions).toEqual(['label']);
  expect(vm.error).toBe('');
});

test.each(['success', 'failure'])('obsolete %s cannot stop the pending spinner', async outcome => {
  const old = deferred();
  const current = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  const second = vm.loadEvents();
  await tick();
  if (outcome === 'success') old.resolve(events('OLD'));
  else old.reject(new Error('OLD FAILURE'));
  await first;
  expect(vm.loading).toBe(true);
  expect(vm.events).toEqual([]);
  current.resolve(events('NEW'));
  await second;
  expect(vm.loading).toBe(false);
});

test.each(['empty bucket', 'missing range'])('%s invalidates an in-flight request', async mode => {
  const old = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise);
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  if (mode === 'empty bucket') vm.selectedBucketId = '';
  else vm.timeRange = null;
  await vm.loadEvents();
  old.resolve(events('OLD'));
  await first;
  expect(vm.events).toEqual([]);
  expect(vm.aggregated).toEqual([]);
  expect(vm.loading).toBe(false);
});

test('obsolete earliest lookup cannot overwrite cache or start an events query', async () => {
  const old = deferred<Date>();
  const current = deferred<Date>();
  (earliestEventInBucket as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise);
  mockGetEvents.mockResolvedValue(events('NEW'));
  const vm = instance();
  vm.activityStore.query_options = { all_time: true, force: true };
  const first = vm.loadEvents();
  const second = vm.loadEvents();
  current.resolve(new Date('2026-10-01'));
  await second;
  old.resolve(new Date('2026-09-01'));
  await first;
  expect(vm.earliestByBucket['bucket-a']).toEqual(new Date('2026-10-01'));
  expect(mockGetEvents).toHaveBeenCalledTimes(1);
  expect(mockGetEvents).toHaveBeenCalledWith('bucket-a', {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-21',
    limit: -1,
  });
});

test('current failure is reported and clears old results', async () => {
  mockGetEvents.mockRejectedValue(new Error('CURRENT FAILURE'));
  const vm = instance();
  vm.events = events('PREVIOUS');
  await vm.loadEvents();
  expect(vm.events).toEqual([]);
  expect(vm.fieldOptions).toEqual([]);
  expect(vm.error).toBe('CURRENT FAILURE');
  expect(vm.loading).toBe(false);
});

test('ordered loads retain their captured ranges and discover fields normally', async () => {
  mockGetEvents.mockResolvedValueOnce(events('FIRST')).mockResolvedValueOnce(events('SECOND'));
  const vm = instance();
  vm.selectedField = '';
  await vm.loadEvents();
  expect(vm.selectedField).toBe('label');
  vm.timeRange = { start: '2026-10-21', end: '2026-10-22' };
  await vm.loadEvents();
  expect(mockGetEvents.mock.calls.map(call => call[1])).toEqual([
    { start: '2026-10-20', end: '2026-10-21', limit: -1 },
    { start: '2026-10-21', end: '2026-10-22', limit: -1 },
  ]);
  expect(vm.events).toEqual(events('SECOND'));
});

test('obsolete earliest lookup failure cannot publish an error or stop a newer load', async () => {
  const old = deferred<Date>();
  const current = deferred<Date>();
  (earliestEventInBucket as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(current.promise);
  const vm = instance();
  vm.activityStore.query_options = { all_time: true, force: true };
  const first = vm.loadEvents();
  const second = vm.loadEvents();
  old.reject(new Error('OLD EARLIEST FAILURE'));
  await first;
  expect(vm.error).toBe('');
  expect(vm.loading).toBe(true);
  mockGetEvents.mockResolvedValue(events('NEW'));
  current.resolve(new Date('2026-10-01'));
  await second;
  expect(vm.events).toEqual(events('NEW'));
  expect(vm.loading).toBe(false);
});
