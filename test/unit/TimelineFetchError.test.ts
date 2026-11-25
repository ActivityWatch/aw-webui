import { shallowMount } from '@vue/test-utils';
import moment from 'moment';
import TimelineView from '~/views/Timeline.vue';

const mockGetBucketsWithEvents = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({ query: jest.fn().mockResolvedValue([[]]) }),
}));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    getBucketsWithEvents: mockGetBucketsWithEvents,
    bucketsAFK: () => [],
  }),
}));
jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => ({
    classes: [],
    classes_for_query: [],
    allCategoriesSelect: [],
    load: jest.fn(),
  }),
}));
jest.mock('~/stores/settings', () => ({
  useSettingsStore: () => ({
    durationDefault: 3600,
    timelineGroupGranularity: 0,
    always_active_pattern: '',
  }),
}));

const bucket = (app: string) => ({
  id: 'window_laptop',
  type: 'currentwindow',
  hostname: 'laptop',
  client: 'window',
  events: [{ timestamp: '2026-10-18T09:00:00Z', duration: 600, data: { app, title: app } }],
});
const day = (d: string) => [moment.utc(d), moment.utc(d).add(1, 'day')];

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

function mountTimeline() {
  return shallowMount(TimelineView, {
    stubs: { 'vis-timeline': true, 'aw-devonly': true, 'aw-calendar': true },
  });
}

// ActivityWatch/aw-webui#1328 item 2
describe('Timeline event fetch failure', () => {
  beforeEach(() => {
    mockGetBucketsWithEvents.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test('a failed first load shows an error with Retry instead of Loading forever', async () => {
    mockGetBucketsWithEvents.mockRejectedValueOnce(new Error('timeout'));
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: day('2026-10-18') });
    await flush();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('.aw-loading').exists()).toBe(false);

    const retry = wrapper.find('[role="alert"] b-button');
    expect(retry.exists()).toBe(true);
    expect(mockGetBucketsWithEvents).toHaveBeenCalledTimes(1);

    mockGetBucketsWithEvents.mockResolvedValueOnce([bucket('Firefox')]);
    await retry.trigger('click');
    await flush();
    // Retry starts a fresh fetch rather than reusing the failed one.
    expect(mockGetBucketsWithEvents).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect((wrapper.vm as any).buckets).toHaveLength(1);
  });

  test('a failed range change does not keep showing the previous range', async () => {
    mockGetBucketsWithEvents.mockResolvedValueOnce([bucket('OldRange')]);
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: day('2026-10-18') });
    await flush();
    expect((wrapper.vm as any).buckets).toHaveLength(1);
    const hostOptions = () =>
      wrapper.findAll('#timeline-filter-host option').wrappers.map(option => option.text());
    const clientOptions = () =>
      wrapper.findAll('#timeline-filter-client option').wrappers.map(option => option.text());
    expect(hostOptions()).toContain('laptop');
    expect(clientOptions()).toContain('window');

    // A warning left over from the previous range must not outlive the rows it described.
    wrapper.setData({ categoryError: true });
    mockGetBucketsWithEvents.mockRejectedValueOnce(new Error('server down'));
    wrapper.setData({ daterange: day('2026-10-19') });
    await flush();
    expect((wrapper.vm as any).categoryError).toBe(false);
    expect((wrapper.vm as any).buckets).toBeNull();
    expect(wrapper.find('vis-timeline-stub').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    // Only the All option remains; stale range-specific filters must not be selectable.
    expect(hostOptions()).toHaveLength(1);
    expect(clientOptions()).toHaveLength(1);

    mockGetBucketsWithEvents.mockResolvedValueOnce([
      { ...bucket('NewRange'), hostname: 'desktop', client: 'browser' },
    ]);
    await wrapper.find('[role="alert"] b-button').trigger('click');
    await flush();
    expect(mockGetBucketsWithEvents).toHaveBeenCalledTimes(3);
    expect(hostOptions()).toContain('desktop');
    expect(hostOptions()).not.toContain('laptop');
    expect(clientOptions()).toContain('browser');
    expect(clientOptions()).not.toContain('window');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
