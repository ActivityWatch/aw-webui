import { createPinia, setActivePinia } from 'pinia';
import WorkReportComponent from '~/views/WorkReport.vue';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));
const WorkReport: any = WorkReportComponent;
const periods = ['2026-10-29T04:00:00Z/2026-10-30T04:00:00Z'];
const result = () => [{ events: [], duration: 3600 }];
let query: jest.Mock;

function context() {
  const ctx: any = {
    ...WorkReport.data(),
    $t: (key: string) => key,
    downloadFile: jest.fn(),
  };
  for (const [key, method] of Object.entries(WorkReport.methods)) {
    ctx[key] = (method as (...args: any[]) => any).bind(ctx);
  }
  for (const [key, getter] of Object.entries(WorkReport.computed)) {
    Object.defineProperty(ctx, key, { get: () => (getter as () => any).call(ctx) });
  }
  ctx.downloadFile = jest.fn();
  ctx.getTimeperiods = () => [...periods];
  ctx.selectedHosts = ['desktop'];
  ctx.selectedCategories = ['["Work"]'];
  ctx.categoryStore = {
    all_categories: [['Work'], ['Work', 'Code'], ['Leisure']],
    classes_for_query: [],
  };
  ctx.bucketsStore = {
    buckets: [
      { id: 'window', hostname: 'desktop', type: 'currentwindow' },
      { id: 'afk', hostname: 'desktop', type: 'afkstatus' },
      { id: 'unsupported', hostname: 'incomplete', type: 'currentwindow' },
    ],
  };
  return ctx;
}

function exported(ctx: any) {
  ctx.exportJSON();
  return JSON.parse(ctx.downloadFile.mock.calls.slice(-1)[0][0]);
}

beforeEach(() => {
  setActivePinia(createPinia());
  query = jest.fn().mockResolvedValue(result());
  (getClient as jest.Mock).mockReturnValue({ query });
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('exports the successful calculation and effective queried inputs', async () => {
  const ctx = context();
  ctx.selectedHosts.push('incomplete');
  await ctx.loadData();
  const data = exported(ctx);
  expect(data.parameters).toEqual({
    categories: ['["Work"]'],
    breakTime: 5,
    dateRange: 'last7d',
    hosts: ['desktop'],
    timeperiods: periods,
    expandedCategories: [['Work'], ['Work', 'Code']],
  });
  expect(data.summary.totalDuration).toBe(3600);
  expect(data.rawEvents).toEqual(result());
  expect(query.mock.calls[0][0]).toEqual(data.parameters.timeperiods);
});

test('form and nested category edits cannot relabel an existing report', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories.splice(0, 1, '["Leisure"]');
  ctx.selectedHosts.push('other');
  ctx.categoryStore.all_categories[1].push('Changed');
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  expect(exported(ctx)).toEqual(original);
});

test('captures inputs before an unresolved query and publishes them with results', async () => {
  const ctx = context();
  let resolve!: (value: any) => void;
  query.mockImplementation(() => new Promise(r => (resolve = r)));
  const calculation = ctx.loadData();
  ctx.selectedCategories[0] = '["Leisure"]';
  ctx.selectedHosts[0] = 'other';
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  ctx.categoryStore.all_categories[1].push('Changed');
  resolve(result());
  await calculation;
  expect(exported(ctx).parameters).toEqual({
    categories: ['["Work"]'],
    breakTime: 5,
    dateRange: 'last7d',
    hosts: ['desktop'],
    timeperiods: periods,
    expandedCategories: [['Work'], ['Work', 'Code']],
  });
});

test('failed recalculation preserves the previous successful data and metadata', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories = ['["Leisure"]'];
  ctx.breakTime = 30;
  query.mockRejectedValueOnce(new Error('offline'));
  await ctx.loadData();
  expect(exported(ctx)).toEqual(original);
  expect(ctx.loading).toBe(false);
});

test('later success replaces data and metadata together', async () => {
  const ctx = context();
  await ctx.loadData();
  ctx.selectedCategories = ['["Leisure"]'];
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  query.mockResolvedValueOnce([{ events: [], duration: 7200 }]);
  await ctx.loadData();
  const data = exported(ctx);
  expect(data.parameters.categories).toEqual(['["Leisure"]']);
  expect(data.parameters.breakTime).toBe(30);
  expect(data.parameters.dateRange).toBe('last30d');
  expect(data.summary.totalDuration).toBe(7200);
});

test('a second Generate cannot race the unresolved calculation', async () => {
  const ctx = context();
  let resolve!: (value: any) => void;
  query.mockImplementation(() => new Promise(r => (resolve = r)));
  const calculation = ctx.loadData();
  ctx.selectedCategories = ['["Leisure"]'];
  await ctx.loadData();
  expect(query).toHaveBeenCalledTimes(1);
  expect(ctx.loading).toBe(true);
  resolve(result());
  await calculation;
  expect(exported(ctx).parameters.categories).toEqual(['["Work"]']);
  expect(ctx.loading).toBe(false);
});

test('a computation failure preserves the full previous report', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories = ['["Leisure"]'];
  query.mockResolvedValueOnce([null]);
  await ctx.loadData();
  expect(exported(ctx)).toEqual(original);
  expect(window.alert).toHaveBeenCalledWith('ui.workReport.loadError');
});
