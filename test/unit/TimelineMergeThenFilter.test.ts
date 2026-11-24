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

const event = (offset: number, duration: number, app: string, id?: number) => ({
  id,
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
    // Ten contiguous 5s events of the same app = one 50s block once merged,
    // plus an isolated 5s event of another app well after it (gap > 30s).
    const raw = [
      ...Array.from({ length: 10 }, (_v, i) => event(i * 5, 5, 'Illustrator')),
      event(600, 5, 'Terminal'),
    ];
    mockGetBucketsWithEvents.mockResolvedValue([
      { id: 'window_laptop', type: 'currentwindow', hostname: 'laptop', client: 'w', events: raw },
    ]);
    mockQuery.mockResolvedValue([[]]);
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')] });
    await flush();
    wrapper.setData({ filter_merge_similar: true });
    await flush();
    expect(windowEvents(wrapper.vm).map(e => [e.data.app, e.duration])).toEqual([
      ['Illustrator', 50],
      ['Terminal', 5],
    ]);
    wrapper.setData({ filter_duration: 30 });
    await flush();
    // The minimum still applies with Merge similar on: the short isolated
    // event goes, the merged 50s block (made of 5s events) stays.
    expect(windowEvents(wrapper.vm).map(e => [e.data.app, e.duration])).toEqual([
      ['Illustrator', 50],
    ]);
  });

  test('a merged bar carries no event id; an unmerged one keeps its own', async () => {
    const raw = [
      ...Array.from({ length: 3 }, (_v, i) => event(i * 5, 5, 'Illustrator', i + 1)),
      event(600, 5, 'Terminal', 42),
    ];
    mockGetBucketsWithEvents.mockResolvedValue([
      { id: 'window_laptop', type: 'currentwindow', hostname: 'laptop', client: 'w', events: raw },
    ]);
    mockQuery.mockResolvedValue([[]]);
    const wrapper = mountTimeline();
    wrapper.setData({ daterange: [moment.utc('2026-10-18'), moment.utc('2026-10-19')] });
    await flush();
    wrapper.setData({ filter_merge_similar: true });
    await flush();
    const events = windowEvents(wrapper.vm);
    expect(events.map(e => [e.data.app, e.duration])).toEqual([
      ['Illustrator', 15],
      ['Terminal', 5],
    ]);
    // Clicking the merged bar must not open the editor for event 1 alone.
    expect(events[0]).not.toHaveProperty('id');
    expect(events[1].id).toBe(42);
    // The bucket's own events are not mutated by the merge.
    expect(raw.map(e => e.id)).toEqual([1, 2, 3, 42]);
  });
});
