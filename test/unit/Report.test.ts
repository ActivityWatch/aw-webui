import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Report from '~/views/Report.vue';
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';
import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));
jest.mock('vue-chartjs/legacy', () => ({ Bar: { render: h => h('div') } }));
jest.mock('chart.js/auto', () => ({}));

const event = (timestamp = '2026-10-01T12:00:00Z', duration = 60, category = ['Work']) => ({
  timestamp,
  duration,
  data: { $category: category, app: 'Editor', title: 'Report test' },
});
const query = jest.fn();

function mountReport() {
  const wrapper = shallowMount(Report, {
    mocks: { $t: (key: string) => key },
    stubs: {
      icon: true,
      'aw-timeline-barchart': TimelineBarChart,
      'aw-selectable-eventview': { props: ['events'], render: h => h('div') },
    },
  });
  const vm: any = wrapper.vm;
  vm.queryOptions = {
    hostname: 'requested-host',
    start: '2026-10-01',
    stop: '2026-10-02',
    filter_afk: true,
  };
  vm.filterCategories = [[['Work'], { type: 'regex', regex: 'Editor' }]];
  return { wrapper, vm };
}

beforeEach(() => {
  setActivePinia(createPinia());
  query.mockReset().mockResolvedValue([[event()]]);
  (getClient as jest.Mock).mockReturnValue({ query });
  jest.spyOn(useBucketsStore(), 'ensureLoaded').mockResolvedValue(undefined);
  jest.spyOn(useBucketsStore(), 'desktopBucketIds').mockReturnValue({
    bid_window: 'window-requested',
    bid_afk: 'afk-requested',
  });
  useCategoryStore().classes = [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Leisure'], rule: { type: 'none' }, data: { color: '#654321' } },
  ];
});
afterEach(() => jest.restoreAllMocks());

test.each([false, true])(
  'chart uses the successful report with prior Activity history=%p',
  async prior => {
    const activity = useActivityStore();
    if (prior) {
      activity.category.by_period = {
        '2026-09-01': { cat_events: [event('2026-09-01T12:00:00Z', 3600, ['Leisure'])] },
      } as any;
    }
    const before = JSON.stringify(activity.$state);
    const loadHistory = jest
      .spyOn(activity, 'ensure_category_history')
      .mockResolvedValue(undefined);
    const { wrapper, vm } = mountReport();
    await vm.generate();
    await vm.$nextTick();

    expect(vm.error).toBe('');
    expect(vm.events).toEqual([event()]);
    expect(vm.datasets).toHaveLength(1);
    expect(vm.datasets[0].label).toBe('Work');
    expect(vm.datasets[0].backgroundColor).toBe('#123456');
    expect(vm.datasets[0].data.reduce((a, b) => a + (b || 0), 0)).toBeCloseTo(1 / 60, 8);
    expect(loadHistory).not.toHaveBeenCalled();
    expect(JSON.stringify(activity.$state)).toBe(before);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toEqual([
      expect.stringMatching(/^2026-10-01T00:00:00.*\/2026-10-02T00:00:00/),
    ]);
    const aql = query.mock.calls[0][1].join(';');
    expect(aql).toContain('window-requested');
    expect(aql).toContain('afk-requested');
    expect(aql).toContain('Work');
    const chart = wrapper.findComponent(TimelineBarChart);
    expect(chart.exists()).toBe(true);
    const chartVm: any = chart.vm;
    expect(chartVm.chartData.labels).toHaveLength(vm.datasets[0].data.length);
    expect(chartVm.chartData.labels[12]).toBe('12');
    expect(chartVm.chartData.datasets[0].data[12]).toBeCloseTo(1 / 60, 8);
    wrapper.destroy();
  }
);

function deferred() {
  let resolve: (value: any) => void;
  let reject: (error: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('control edits during and after a request do not change its events, colors or chart axis', async () => {
  const response = deferred();
  query.mockReturnValueOnce(response.promise);
  const { wrapper, vm } = mountReport();
  const request = vm.generate();
  vm.queryOptions.hostname = 'other-host';
  vm.queryOptions.start = '2026-09-01';
  vm.queryOptions.stop = '2026-09-03';
  vm.queryOptions.filter_afk = false;
  vm.filterCategories[0][0][0] = 'Leisure';
  useCategoryStore().classes[0].data.color = '#ffffff';
  response.resolve([[event()]]);
  await request;
  await vm.$nextTick();
  const result = JSON.stringify(vm.result);
  expect(vm.datasets[0].label).toBe('Work');
  expect(vm.datasets[0].backgroundColor).toBe('#123456');
  expect(vm.result.period.start).toMatch(/^2026-10-01T00:00:00/);
  expect((wrapper.findComponent(TimelineBarChart).vm as any).labels[12]).toBe('12');
  vm.queryOptions.stop = '2026-09-10';
  vm.filterCategories = [];
  await vm.$nextTick();
  expect(JSON.stringify(vm.result)).toBe(result);
  wrapper.destroy();
});

test('rejected recalculation retains the previous successful chart and event list together', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const { wrapper, vm } = mountReport();
  await vm.generate();
  const result = vm.result;
  query.mockRejectedValueOnce(new Error('offline'));
  vm.queryOptions.start = '2026-09-01';
  await vm.generate();
  expect(vm.error).toBe('offline');
  expect(vm.result).toBe(result);
  expect(vm.status).toBeNull();
  wrapper.destroy();
});

test('repeated generations replace the whole result, including a successful empty report', async () => {
  const { wrapper, vm } = mountReport();
  await vm.generate();
  const earlier = event('2026-10-03T23:30:00Z', 3600, ['Leisure']);
  const later = event('2026-10-04T12:00:00Z', 1800, ['Leisure']);
  vm.queryOptions.start = '2026-10-03';
  vm.queryOptions.stop = '2026-10-05';
  vm.queryOptions.filter_afk = false;
  vm.filterCategories = [[['Leisure'], { type: 'none' }]];
  query.mockResolvedValueOnce([[earlier, later]]);
  await vm.generate();
  await vm.$nextTick();
  expect(vm.events).toEqual([later, earlier]);
  expect(vm.datasets).toEqual([{ label: 'Leisure', backgroundColor: '#654321', data: [0.5, 1] }]);
  expect((wrapper.findComponent(TimelineBarChart).vm as any).labels).toEqual([
    '2026-10-03',
    '2026-10-04',
  ]);
  expect(query.mock.calls[1][1].join(';')).not.toContain('filter_period_intersect');
  query.mockResolvedValueOnce([[]]);
  await vm.generate();
  await vm.$nextTick();
  expect(vm.events).toEqual([]);
  expect(vm.datasets).toEqual([]);
  expect(wrapper.findComponent(TimelineBarChart).exists()).toBe(false);
  expect(vm.error).toBe('');
  wrapper.destroy();
});

test.each(['resolve', 'reject'])(
  'an older request %s cannot overwrite a newer success',
  async settle => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const old = deferred();
    query.mockReturnValueOnce(old.promise);
    const { wrapper, vm } = mountReport();
    const request = vm.generate();
    vm.filterCategories = [[['Leisure'], { type: 'none' }]];
    query.mockResolvedValueOnce([[event('2026-10-01T13:00:00Z', 3600, ['Leisure'])]]);
    await vm.generate();
    const result = vm.result;
    if (settle === 'resolve') old.resolve([[event()]]);
    else old.reject(new Error('stale failure'));
    await request;
    expect(vm.result).toBe(result);
    expect(vm.datasets[0].label).toBe('Leisure');
    expect(vm.error).toBe('');
    expect(vm.status).toBeNull();
    wrapper.destroy();
  }
);

test('an older completion does not stop the newer loading state, even when the latest request fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const { wrapper, vm } = mountReport();
  await vm.generate();
  const result = vm.result;
  const old = deferred();
  const latest = deferred();
  query.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const first = vm.generate();
  const second = vm.generate();
  old.resolve([[event('2026-10-01T13:00:00Z', 3600)]]);
  await first;
  expect(vm.status).toBe('searching');
  expect(vm.result).toBe(result);
  latest.reject(new Error('latest failure'));
  await second;
  expect(vm.error).toBe('latest failure');
  expect(vm.result).toBe(result);
  expect(vm.status).toBeNull();
  wrapper.destroy();
});
