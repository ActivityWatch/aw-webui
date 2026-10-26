const mockGetBuckets = jest.fn();
const mockGetEvents = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    getBuckets: mockGetBuckets,
    getEvents: mockGetEvents,
    insertEvents: jest.fn(),
  }),
}));

import { shallowMount } from '@vue/test-utils';
import BucketMerge from '~/components/BucketMerge.vue';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const inner = { id: 'inner', timestamp: '2026-10-19T00:00:10Z', duration: 10 };
const outer = { id: 'outer', timestamp: '2026-10-19T00:00:00Z', duration: 30 };
const disjoint = { id: 'disjoint', timestamp: '2026-10-19T01:00:00Z', duration: 10 };

async function mountWith(fromEvents, toEvents) {
  mockGetEvents.mockImplementation(async bucket_id =>
    bucket_id === 'from' ? fromEvents : toEvents
  );
  const wrapper = shallowMount(BucketMerge);
  await flushPromises();
  await wrapper.vm.$nextTick();
  wrapper.vm.bucket_from = 'from';
  wrapper.vm.bucket_to = 'to';
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('BucketMerge', () => {
  beforeEach(() => {
    mockGetBuckets.mockReset();
    mockGetEvents.mockReset();
    mockGetBuckets.mockResolvedValue({ from: {}, to: {} });
  });

  test('refuses to merge when a source event contains a destination event', async () => {
    // The contained interval is in the destination, so the source interval
    // strictly contains it. Merge must still be blocked.
    const wrapper = await mountWith([outer], [inner]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(1);
    expect(wrapper.vm.validate).toBe(false);
  });

  test('refuses to merge when a destination event contains a source event', async () => {
    const wrapper = await mountWith([inner], [outer]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(1);
    expect(wrapper.vm.validate).toBe(false);
  });

  test('allows merging disjoint buckets', async () => {
    const wrapper = await mountWith([inner], [disjoint]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(0);
    expect(wrapper.vm.validate).toBe(true);
  });
});
