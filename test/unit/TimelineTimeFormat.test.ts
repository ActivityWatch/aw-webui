const mockGetSettings = jest.fn();
const mockPost = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { defaults: { timeout: 0 }, post: mockPost },
  }),
}));

// vis-timeline needs a real browser layout, see VisTimeline.test.ts.
jest.mock('vis-timeline/esnext', () => ({
  Timeline: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    setOptions: jest.fn(),
    setWindow: jest.fn(),
    getWindow: jest.fn(() => ({ start: new Date(0), end: new Date(1000) })),
    destroy: jest.fn(),
  })),
}));
jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import { Timeline } from 'vis-timeline/esnext';
import { useSettingsStore } from '~/stores/settings';
import { timelineAxisOptions } from '~/util/timelineTimeFormat';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import VisTimeline from '~/visualizations/VisTimeline.vue';

const MockTimeline = Timeline as unknown as jest.Mock;

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  MockTimeline.mockClear();
  mockGetSettings.mockReset().mockResolvedValue({});
  mockPost.mockReset();
  jest.spyOn(console, 'log').mockImplementation(jest.fn());
});

afterEach(() => jest.restoreAllMocks());

describe('timelineAxisOptions', () => {
  const afternoon = moment('2026-10-18T13:05:09');

  test.each([
    ['24h', '13:05', '13:05:09', '18 October 13:05'],
    ['12h', '1:05 PM', '1:05:09 PM', '18 October 1:05 PM'],
  ] as const)('labels clock times in %s format', (timeFormat, minor, withSeconds, withDate) => {
    const { minorLabels, majorLabels } = timelineAxisOptions(timeFormat).format;
    expect(afternoon.format(minorLabels.minute)).toBe(minor);
    expect(afternoon.format(minorLabels.hour)).toBe(minor);
    expect(afternoon.format(majorLabels.millisecond)).toBe(withSeconds);
    expect(afternoon.format(majorLabels.second)).toBe(withDate);
  });

  test('sets every 12-hour label back to 24-hour, as vis-timeline merges formats', () => {
    const paths = options => [
      Object.keys(options.format.minorLabels),
      Object.keys(options.format.majorLabels),
    ];
    expect(paths(timelineAxisOptions('24h'))).toEqual(paths(timelineAxisOptions('12h')));
  });

  test('reserves room for the longer 12-hour labels', () => {
    expect(timelineAxisOptions('24h').maxMinorChars).toBe(7);
    expect(timelineAxisOptions('12h').maxMinorChars).toBe('12:00 PM'.length);
  });
});

describe('timeline time format preference', () => {
  test('keeps 24-hour times unless a preference is stored', async () => {
    const store = useSettingsStore();
    await store.load();
    expect(store.timelineTimeFormat).toBe('24h');
  });

  test('loads a local fallback and lets the server take priority', async () => {
    localStorage.setItem('timelineTimeFormat', '12h');
    const store = useSettingsStore();
    await store.load();
    expect(store.timelineTimeFormat).toBe('12h');

    mockGetSettings.mockResolvedValue({ timelineTimeFormat: '24h' });
    await store.load();
    expect(store.timelineTimeFormat).toBe('24h');
  });

  test('the settings control saves only the chosen format', async () => {
    const store = useSettingsStore();
    await store.load();
    const wrapper = shallowMount(TimelineDurationSettings as any, {
      stubs: { 'b-select': true, 'b-form-input': true },
      mocks: { $t: (key: string) => key },
    });
    (wrapper.vm as any).timelineTimeFormat = '12h';
    await new Promise(resolve => setTimeout(resolve));

    expect(store.timelineTimeFormat).toBe('12h');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringMatching(/timelineTimeFormat$/),
      '12h',
      expect.anything()
    );
  });
});

describe('VisTimeline time format', () => {
  async function mountTimeline() {
    const wrapper = shallowMount(VisTimeline as any, {
      localVue: createLocalVue(),
      stubs: ['EventEditor', 'b-alert', 'b-button', 'icon'],
      mocks: { $t: (key: string) => key },
      propsData: { events: [] },
    });
    await wrapper.vm.$nextTick();
    return wrapper;
  }

  test('creates the timeline with the stored format', async () => {
    useSettingsStore().$patch({ timelineTimeFormat: '12h' });
    await mountTimeline();

    const options = MockTimeline.mock.calls[0][3];
    expect(options.format.minorLabels.hour).toBe('h:mm A');
    expect(options.maxMinorChars).toBe(timelineAxisOptions('12h').maxMinorChars);
  });

  test('updates the axis when the preference changes or loads late', async () => {
    const wrapper = await mountTimeline();
    const timeline = (wrapper.vm as any).timeline;
    expect(MockTimeline.mock.calls[0][3].format.minorLabels.hour).toBe('HH:mm');

    useSettingsStore().$patch({ timelineTimeFormat: '12h' });
    await wrapper.vm.$nextTick();
    expect(timeline.setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining(timelineAxisOptions('12h'))
    );

    useSettingsStore().$patch({ timelineTimeFormat: '24h' });
    await wrapper.vm.$nextTick();
    expect(timeline.setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining(timelineAxisOptions('24h'))
    );
  });

  test('tooltips follow the preference', async () => {
    useSettingsStore().$patch({ timelineTimeFormat: '12h' });
    const wrapper = await mountTimeline();
    const vm = wrapper.vm as any;
    vm.itemEvents = new Map([
      [
        'item',
        {
          bucket: { id: 'b', type: 'test' },
          event: { timestamp: '2026-10-18T13:05:09', duration: 60, data: {} },
        },
      ],
    ]);

    expect(vm.tooltipForItem('item')).toContain('<td>1:05:09 PM</td>');
  });
});
