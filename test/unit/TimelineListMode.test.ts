import { shallowMount } from '@vue/test-utils';
import moment from 'moment';
import TimelineView from '~/views/Timeline.vue';
import TimelineEventList from '~/visualizations/TimelineEventList.vue';

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

const event = (offset: number, duration: number, app: string) => ({
  timestamp: moment.utc('2026-10-18T09:00:00Z').add(offset, 'seconds').toISOString(),
  duration,
  data: { app, title: app },
});

beforeEach(() => {
  mockGetBucketsWithEvents.mockResolvedValue([
    {
      id: 'window_laptop',
      type: 'currentwindow',
      hostname: 'laptop',
      client: 'window',
      events: [event(0, 5, 'short'), event(10, 600, 'long')],
    },
  ]);
});

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

test('List mode renders the same filtered buckets the timeline would', async () => {
  const wrapper = shallowMount(TimelineView, {
    stubs: {
      'aw-timeline-event-list': TimelineEventList,
      'vis-timeline': true,
      'aw-devonly': true,
      'aw-calendar': true,
    },
  });
  wrapper.setData({ daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')] });
  await flush();
  expect(wrapper.findComponent(TimelineEventList).exists()).toBe(false);

  wrapper.setData({ filter_duration: 30, view_mode: 'list' });
  await flush();

  const list = wrapper.findComponent(TimelineEventList);
  expect(list.exists()).toBe(true);
  expect(list.props('buckets')).toBe((wrapper.vm as any).buckets);
  expect(list.props('range')).toBe((wrapper.vm as any).daterange);
  expect(list.findAll('tbody tr')).toHaveLength(1);
  expect(list.text()).toContain('long');
  expect(list.text()).not.toContain('short');
});
