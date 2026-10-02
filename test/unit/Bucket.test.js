import { shallowMount } from '@vue/test-utils';
import Bucket from '~/views/Bucket.vue';

const mockCountEvents = jest.fn();
const mockBuckets = [
  { id: 'aw-watcher-window_host', type: 'currentwindow', hostname: 'host', client: 'test' },
];

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    getBucket: id => mockBuckets.find(b => b.id === id),
  }),
}));

function mountBucket(id) {
  return shallowMount(Bucket, {
    propsData: { id },
    stubs: {
      'b-alert': { template: '<div class="alert"><slot /></div>' },
      'router-link': { template: '<a><slot /></a>' },
      'input-timeinterval': true,
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
    mockCountEvents.mockReset();
  });

  test('shows the event count returned by countEvents', async () => {
    mockCountEvents.mockResolvedValue(49828);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-window_host');
    expect(wrapper.vm.eventcount).toBe(49828);
    expect(wrapper.text()).toContain('49828');
    expect(wrapper.find('.alert').exists()).toBe(false);
  });

  test('shows a count of 0 when aw-client returns the raw response', async () => {
    mockCountEvents.mockResolvedValue({ data: 0, status: 200 });
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.eventcount).toBe(0);
  });

  test('renders a not-found state for an unknown bucket', async () => {
    const wrapper = mountBucket('does-not-exist');
    await flush();

    expect(mockCountEvents).not.toHaveBeenCalled();
    expect(wrapper.find('.alert').text()).toContain('No bucket named "does-not-exist"');
    expect(wrapper.find('table').exists()).toBe(false);
  });
});
