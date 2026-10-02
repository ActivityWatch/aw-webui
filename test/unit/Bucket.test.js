const mockCountEvents = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));

import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import Bucket from '~/views/Bucket.vue';
import { useBucketsStore } from '~/stores/buckets';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Bucket', () => {
  let bucketsStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    bucketsStore = useBucketsStore();
    bucketsStore.ensureLoaded = jest.fn().mockResolvedValue(undefined);
    bucketsStore.getBucketWithEvents = jest.fn(async ({ id }) => ({
      id,
      events: [{ id: 1, timestamp: '2026-10-02T10:00:00Z', duration: 1, data: { from: id } }],
    }));
    mockCountEvents.mockImplementation(async id => ({ data: id === 'bucket-a' ? 10 : 20 }));
  });

  test('reloads events and count when navigating to another bucket', async () => {
    const wrapper = shallowMount(Bucket, { propsData: { id: 'bucket-a' } });
    wrapper.setData({ daterange: [moment().subtract(1, 'hour'), moment()] });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');
    expect(wrapper.vm.eventcount).toBe(10);

    // The router reuses the component, only changing the prop.
    await wrapper.setProps({ id: 'bucket-b' });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);
  });

  // Returns a promise plus a function to resolve it later.
  function deferred() {
    let resolve;
    const promise = new Promise(r => (resolve = r));
    return { promise, resolve };
  }

  test('ignores late responses for a bucket the user navigated away from', async () => {
    const lateEvents = deferred();
    const lateCount = deferred();
    bucketsStore.getBucketWithEvents.mockImplementationOnce(() => lateEvents.promise);
    mockCountEvents.mockImplementationOnce(() => lateCount.promise);

    const wrapper = shallowMount(Bucket, { propsData: { id: 'bucket-a' } });
    wrapper.setData({ daterange: [moment().subtract(1, 'hour'), moment()] });
    await flushPromises();

    await wrapper.setProps({ id: 'bucket-b' });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);

    // bucket-a's first requests finish only now.
    lateEvents.resolve({ id: 'bucket-a', events: [{ id: 9, data: { from: 'late bucket-a' } }] });
    lateCount.resolve({ data: 999 });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);
  });

  test('ignores a late response for an older time range of the same bucket', async () => {
    const lateEvents = deferred();
    bucketsStore.getBucketWithEvents.mockImplementationOnce(() => lateEvents.promise);

    const wrapper = shallowMount(Bucket, { propsData: { id: 'bucket-a' } });
    wrapper.setData({ daterange: [moment().subtract(1, 'hour'), moment()] });
    await flushPromises();

    // A -> B -> A with a new time range, while the first A request is still pending.
    await wrapper.setProps({ id: 'bucket-b' });
    await wrapper.setProps({ id: 'bucket-a' });
    wrapper.setData({ daterange: [moment().subtract(1, 'day'), moment()] });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');

    lateEvents.resolve({ id: 'bucket-a', events: [{ id: 9, data: { from: 'stale range' } }] });
    await flushPromises();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');
  });
});
