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

    mockGetBucketsWithEvents.mockResolvedValueOnce([bucket('Firefox')]);
    await (wrapper.vm as any).getBuckets();
    await flush();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect((wrapper.vm as any).buckets).toHaveLength(1);
  });

  test('a failed range change does not keep showing the previous range', async () => {
    mockGetBucketsWithEvents.mockResolvedValueOnce([bucket('OldRange')]);
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: day('2026-10-18') });
    await flush();
    expect((wrapper.vm as any).buckets).toHaveLength(1);

    mockGetBucketsWithEvents.mockRejectedValueOnce(new Error('server down'));
    wrapper.setData({ daterange: day('2026-10-19') });
    await flush();
    expect((wrapper.vm as any).buckets).toBeNull();
    expect(wrapper.find('vis-timeline-stub').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });
});
