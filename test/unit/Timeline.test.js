import Timeline from '~/views/Timeline.vue';
import { useBucketsStore } from '~/stores/buckets';

jest.mock('~/stores/buckets', () => ({ useBucketsStore: jest.fn() }));

const event = duration => ({ timestamp: '2026-01-01T10:00:00Z', duration, data: { app: 'A' } });
function setup() {
  const store = {
    buckets: [
      { id: 'a', hostname: 'one' },
      { id: 'b', hostname: 'two' },
    ],
    ensureLoaded: jest.fn().mockResolvedValue(),
    getBucketWithEvents: jest.fn(({ id }) =>
      Promise.resolve({ id, events: [event(5), event(20)] })
    ),
    bucketsAFK: jest.fn(() => ['afk']),
  };
  useBucketsStore.mockReturnValue(store);
  const vm = { ...Timeline.data(), ...Timeline.methods };
  vm.daterange = [{ format: () => '2026-01-01' }, { format: () => '2026-01-02' }];
  Timeline.created.call(vm);
  return { vm, store };
}

test('local filters reuse raw events and clearing them restores all events', async () => {
  const { vm, store } = setup();
  await vm.getBuckets();
  vm.filter_duration = 10;
  await vm.getBuckets();
  expect(vm.buckets[0].events).toHaveLength(1);
  vm.filter_duration = null;
  await vm.getBuckets();
  expect(vm.buckets[0].events).toHaveLength(2);
  expect(store.getBucketWithEvents).toHaveBeenCalledTimes(2);
});

test('fetches selected hosts only and refreshes when range changes', async () => {
  const { vm, store } = setup();
  vm.filter_hostname = 'one';
  await vm.getBuckets();
  expect(store.getBucketWithEvents).toHaveBeenCalledTimes(1);
  expect(store.getBucketWithEvents.mock.calls[0][0].id).toBe('a');
  vm.daterange[1] = { format: () => '2026-01-03' };
  await vm.getBuckets();
  expect(store.getBucketWithEvents).toHaveBeenCalledTimes(2);
});

test('deduplicates in-flight requests and ignores an older range response', async () => {
  const { vm, store } = setup();
  vm.filter_hostname = 'one';
  let resolveOld;
  store.getBucketWithEvents.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve;
      })
  );
  const old = vm.getBuckets();
  await Promise.resolve();
  const duplicate = vm.getBuckets();
  await Promise.resolve();
  expect(store.getBucketWithEvents).toHaveBeenCalledTimes(1);
  vm.daterange[1] = { format: () => '2026-01-03' };
  await vm.getBuckets();
  resolveOld({ id: 'old', events: [] });
  await Promise.all([old, duplicate]);
  expect(vm.buckets[0].id).toBe('a');
});

test('applies duration filtering after AFK results and reuses the query', async () => {
  const { vm, store } = setup();
  store.buckets = [{ id: 'a', hostname: 'one', type: 'currentwindow' }];
  vm.filter_afk = true;
  vm._queryAfkFilteredEvents = jest.fn().mockResolvedValue([event(5), event(20)]);
  vm.filter_duration = 10;
  await vm.getBuckets();
  expect(vm.buckets[0].events).toHaveLength(1);
  vm.filter_duration = null;
  await vm.getBuckets();
  expect(vm.buckets[0].events).toHaveLength(2);
  expect(vm._queryAfkFilteredEvents).toHaveBeenCalledTimes(1);
  expect(store.getBucketWithEvents).not.toHaveBeenCalled();
});
