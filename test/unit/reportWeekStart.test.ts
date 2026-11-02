import moment from 'moment';
import 'moment/locale/de';
import { createPinia, setActivePinia, PiniaVuePlugin } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import { useSettingsStore } from '~/stores/settings';
import { getClient as getClientImpl } from '~/util/awclient';
import WorkReportComponent from '~/views/WorkReport.vue';
import BillingViewComponent from '~/views/BillingView.vue';
const getClient = getClientImpl as jest.Mock;

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const WorkReport: any = WorkReportComponent;
const BillingView: any = BillingViewComponent;

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

function reportPeriods(dateRange = 'thisWeek') {
  const ctx = { settingsStore: useSettingsStore(), dateRange };
  return {
    work: WorkReport.methods.getTimeperiods.call(ctx),
    billing: BillingView.methods.getTimeperiod.call(ctx),
  };
}

function expectWindow({ work, billing }, firstDate, lastDate, offset) {
  const dates = [];
  for (const date = moment(firstDate); date.isSameOrBefore(lastDate, 'day'); date.add(1, 'day')) {
    dates.push(date.format('YYYY-MM-DD'));
  }
  expect(work).toHaveLength(dates.length);
  work.forEach((period, i) => {
    const [start, end] = period.split('/').map(value => moment(value));
    expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(`${dates[i]} ${offset}:00.000`);
    expect(end.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      `${moment(dates[i]).add(1, 'day').format('YYYY-MM-DD')} ${offset}:00.000`
    );
    if (i > 0) expect(period.split('/')[0]).toBe(work[i - 1].split('/')[1]);
  });
  expect(billing).toBe(`${work[0].split('/')[0]}/${work[work.length - 1].split('/')[1]}`);
}

describe('report calendar week start', () => {
  let previousLocale;

  beforeEach(() => {
    previousLocale = moment.locale();
    moment.locale('en');
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 19, 12, 34, 47, 321));
    setActivePinia(createPinia());
    useSettingsStore().startOfDay = '04:00';
  });

  afterEach(() => {
    moment.locale(previousLocale);
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test.each([
    ['Saturday', '2026-10-17'],
    ['Sunday', '2026-10-18'],
    ['Monday', '2026-10-19'],
  ])('uses configured %s for both This week query windows', (startOfWeek, firstDate) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expectWindow(reportPeriods(), firstDate, '2026-10-19', '04:00');
  });

  test.each(['en', 'de'])('ignores %s locale week rules with midnight/custom offsets', locale => {
    moment.locale(locale);
    useSettingsStore().startOfWeek = 'Sunday';
    for (const offset of ['00:00', '05:30']) {
      useSettingsStore().startOfDay = offset;
      expectWindow(reportPeriods(), '2026-10-18', '2026-10-19', offset);
    }
  });

  test.each([
    [new Date(2027, 0, 1, 12, 0, 47, 321), 'Saturday', '2026-12-26', '2027-01-01'],
    [new Date(2026, 10, 1, 12, 0, 47, 321), 'Monday', '2026-10-26', '2026-11-01'],
    [new Date(2026, 2, 30, 12, 0, 47, 321), 'Saturday', '2026-03-28', '2026-03-30'],
    [new Date(2026, 9, 26, 12, 0, 47, 321), 'Saturday', '2026-10-24', '2026-10-26'],
  ])('keeps calendar dates across boundaries at %s', (now, startOfWeek, firstDate, lastDate) => {
    jest.setSystemTime(now);
    useSettingsStore().startOfWeek = startOfWeek;
    expectWindow(reportPeriods(), firstDate, lastDate, '04:00');
  });

  test('uses the previous logical week before the configured day start', () => {
    jest.setSystemTime(new Date(2026, 9, 18, 2, 0, 47, 321));
    useSettingsStore().startOfWeek = 'Sunday';
    const periods = reportPeriods();
    expect(periods.work).toHaveLength(7);
    expectWindow(periods, '2026-10-11', '2026-10-17', '04:00');
  });

  test.each([
    ['last7d', '2026-10-13'],
    ['last30d', '2026-09-20'],
    ['thisMonth', '2026-10-01'],
  ])('leaves %s unchanged by the week setting', (dateRange, firstDate) => {
    for (const startOfWeek of ['Saturday', 'Sunday', 'Monday']) {
      useSettingsStore().startOfWeek = startOfWeek;
      expectWindow(reportPeriods(dateRange), firstDate, '2026-10-19', '04:00');
    }
  });

  test.each(['Saturday', 'Sunday', 'Monday'])(
    'mounted reports pass configured %s windows to the query client',
    async startOfWeek => {
      const query = jest
        .fn()
        .mockImplementation(periods =>
          Promise.resolve(periods.map(() => ({ events: [], duration: 0, sessions: 0 })))
        );
      getClient.mockReturnValue({ query });
      const pinia = createTestingPinia({
        initialState: {
          settings: { startOfWeek, startOfDay: '04:00' },
          buckets: {
            buckets: [
              { id: 'window', type: 'currentwindow', hostname: 'desktop', data: {} },
              { id: 'afk', type: 'afkstatus', hostname: 'desktop', data: {} },
            ],
          },
        },
      });
      setActivePinia(pinia);
      const firstDate = { Saturday: '2026-10-17', Sunday: '2026-10-18', Monday: '2026-10-19' }[
        startOfWeek
      ];
      const queried: Record<string, any> = {};
      const localVue = createLocalVue();
      localVue.use(PiniaVuePlugin);
      const stubs = [
        'b-form-group',
        'b-form-select',
        'b-form-input',
        'b-input-group',
        'b-input-group-prepend',
        'b-button',
        'b-alert',
        'b-spinner',
        'b-table',
        'b-card',
        'icon',
      ];
      for (const component of [WorkReport, BillingView]) {
        const wrapper: any = shallowMount(component, { localVue, pinia, stubs });
        try {
          // Allow the real mounted hook to select supported hosts.
          await wrapper.vm.$nextTick();
          await wrapper.setData({ dateRange: 'thisWeek' });
          await wrapper.vm.loadData();
          expect(query).toHaveBeenLastCalledWith(expect.any(Array), [expect.any(String)]);
          const periods = query.mock.calls[query.mock.calls.length - 1][0];
          queried[component.name] = periods;
        } finally {
          wrapper.destroy();
        }
      }
      expectWindow(
        { work: queried.WorkReport, billing: queried.BillingView[0] },
        firstDate,
        '2026-10-19',
        '04:00'
      );
    }
  );
});
