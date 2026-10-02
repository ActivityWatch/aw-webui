import Vue from 'vue';
import { shallowMount } from '@vue/test-utils';
import Bucket from '~/views/Bucket.vue';

const mockCountEvents = jest.fn();
const mockGetBucketWithEvents = jest.fn();
const mockLoadBuckets = jest.fn();
const knownBucket = {
  id: 'aw-watcher-window_host',
  type: 'currentwindow',
  hostname: 'host',
  client: 'test',
};
// Reactive like the real Pinia store, so the view's `bucket` computed sees a refresh.
const mockState = Vue.observable({ buckets: [] });

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    loadBuckets: mockLoadBuckets,
    getBucket: id => mockState.buckets.find(b => b.id === id),
    getBucketWithEvents: mockGetBucketWithEvents,
  }),
}));

// Like the real input-timeinterval, emit an initial date range on mount.
const InputTimeIntervalStub = {
  template: '<div class="timeinterval" />',
  mounted() {
    const t = iso => ({ format: () => iso });
    this.$emit('input', [t('2026-10-01T00:00:00Z'), t('2026-10-02T00:00:00Z')]);
  },
};

function mountBucket(id) {
  return shallowMount(Bucket, {
    propsData: { id },
    stubs: {
      'b-alert': { template: '<div class="alert"><slot /></div>' },
      'router-link': { template: '<a><slot /></a>' },
      'input-timeinterval': InputTimeIntervalStub,
      'vis-timeline': true,
      'aw-eventlist': true,
    },
    filters: { iso8601: v => v },
  });
}

async function flush() {
  for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('Bucket view', () => {
  beforeEach(() => {
    mockState.buckets = [knownBucket];
    mockCountEvents.mockReset();
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    mockGetBucketWithEvents.mockReset().mockResolvedValue({ ...knownBucket, events: [] });
  });

  test('shows the event count returned by countEvents', async () => {
    mockCountEvents.mockResolvedValue(49828);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-window_host');
    expect(wrapper.vm.eventcount).toBe(49828);
    expect(wrapper.text()).toContain('49828');
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockGetBucketWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aw-watcher-window_host' })
    );
  });

  test('shows a count of 0 when aw-client returns the raw response', async () => {
    mockCountEvents.mockResolvedValue({ data: 0, status: 200 });
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.eventcount).toBe(0);
  });

  test('refreshes a stale bucket list before calling a bucket missing', async () => {
    const newBucket = { ...knownBucket, id: 'aw-watcher-new_host' };
    mockLoadBuckets.mockImplementation(async () => {
      mockState.buckets = [knownBucket, newBucket];
    });
    mockCountEvents.mockResolvedValue(3);
    const wrapper = mountBucket('aw-watcher-new_host');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-new_host');
    expect(wrapper.vm.eventcount).toBe(3);
  });

  test('renders a not-found state for an unknown bucket', async () => {
    const wrapper = mountBucket('does-not-exist');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(mockCountEvents).not.toHaveBeenCalled();
    expect(mockGetBucketWithEvents).not.toHaveBeenCalled();
    expect(wrapper.find('.alert').text()).toContain('No bucket named "does-not-exist"');
    expect(wrapper.find('table').exists()).toBe(false);
  });
});

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
    const inFlight = Bucket.methods.getEvents.call(vm, 'b');
    // User picks a new interval and its events arrive while the fallback is in flight.
    await Promise.resolve();
    vm.daterange = range();
    vm.events = [{ timestamp: 'fresh' }];
    release();
    await inFlight;
    expect(vm.events).toEqual([{ timestamp: 'fresh' }]);
    expect(vm.showingMostRecent).toBe(false);
  });
});
