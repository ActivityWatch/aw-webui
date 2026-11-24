import { shallowMount } from '@vue/test-utils';
import moment from 'moment';
import TimelineView from '~/views/Timeline.vue';

const mockGetBucketsWithEvents = jest.fn();
const mockQuery = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({ query: mockQuery }),
}));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    getBucketsWithEvents: mockGetBucketsWithEvents,
    bucketsAFK: host => (host === 'laptop' ? ['afk_laptop'] : []),
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
    startOfDay: '00:00',
  }),
}));

const event = (offset: number, duration: number, app: string) => ({
  timestamp: moment.utc('2026-10-18T09:00:00Z').add(offset, 'seconds').toISOString(),
  duration,
  data: { app, title: app },
});

async function flush() {
  for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

function mountTimeline() {
  return shallowMount(TimelineView, {
    stubs: {
      'aw-timeline-event-list': true,
      'vis-timeline': true,
      'aw-devonly': true,
      'aw-calendar': true,
    },
  });
}

function windowEvents(vm: any) {
  return vm.buckets.find(b => b.id === 'window_laptop').events;
}

describe('Timeline duration filter after Merge similar', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetBucketsWithEvents.mockReset();
  });

  test('merge-similar runs before the duration filter, so merged runs survive it', async () => {
    // Ten contiguous 5s events of the same app = one 50s block once merged.
    const raw = Array.from({ length: 10 }, (_v, i) => event(i * 5, 5, 'Illustrator'));
    mockGetBucketsWithEvents.mockResolvedValue([
      { id: 'window_laptop', type: 'currentwindow', hostname: 'laptop', client: 'w', events: raw },
    ]);
    mockQuery.mockResolvedValue([[]]);
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')] });
    await flush();
    wrapper.setData({ filter_merge_similar: true });
    await flush();
    expect(windowEvents(wrapper.vm).map(e => e.duration)).toEqual([50]);
    wrapper.setData({ filter_duration: 30 });
    await flush();
    // The categorized row filters after merging; raw rows filter before and lose the block.
    expect(windowEvents(wrapper.vm).map(e => e.duration)).toEqual([50]);
  });
});
