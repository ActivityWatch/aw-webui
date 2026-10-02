import Bucket from '~/views/Bucket.vue';

const range = () => [{ format: () => 'start' }, { format: () => 'end' }];

function makeVm(getBucketWithEvents, daterange = range()) {
  return {
    daterange,
    events: [],
    showingMostRecent: false,
    lastEventTime: null,
    bucket: { id: 'b', metadata: { end: '2020-01-02T00:00:00Z' } },
    bucketsStore: { getBucketWithEvents },
  };
}

describe('Bucket.vue getEvents fallback', () => {
  test('shows the latest events and the newest event time when the range is empty', async () => {
    const recent = [{ timestamp: '2020-01-01T10:00:00Z' }, { timestamp: '2020-01-01T09:00:00Z' }];
    const get = jest.fn(async ({ limit }) => ({ events: limit ? recent : [] }));
    const vm = makeVm(get);
    await Bucket.methods.getEvents.call(vm, 'b');
    expect(get).toHaveBeenCalledTimes(2);
    expect(vm.events).toEqual(recent);
    expect(vm.showingMostRecent).toBe(true);
    expect(vm.lastEventTime).toBe('2020-01-01T10:00:00Z');
  });

  test('does not fall back when the range has events', async () => {
    const events = [{ timestamp: 'x' }];
    const get = jest.fn(async () => ({ events }));
    const vm = makeVm(get);
    await Bucket.methods.getEvents.call(vm, 'b');
    expect(get).toHaveBeenCalledTimes(1);
    expect(vm.showingMostRecent).toBe(false);
  });

  test('a stale fallback does not overwrite a newer range selection', async () => {
    let release;
    const gate = new Promise(r => (release = r));
    const get = jest.fn(async ({ limit }) => {
      if (limit) {
        await gate;
        return { events: [{ timestamp: 'stale' }] };
      }
      return { events: [] };
    });
    const vm = makeVm(get);
    const pending = Bucket.methods.getEvents.call(vm, 'b');
    // User picks a new interval and its events arrive while the fallback is in flight.
    await Promise.resolve();
    vm.daterange = range();
    vm.events = [{ timestamp: 'fresh' }];
    release();
    await pending;
    expect(vm.events).toEqual([{ timestamp: 'fresh' }]);
    expect(vm.showingMostRecent).toBe(false);
  });
});
