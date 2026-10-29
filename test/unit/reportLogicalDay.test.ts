import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { get_today_with_offset } from '~/util/time';
import WorkReportComponent from '~/views/WorkReport.vue';
import BillingViewComponent from '~/views/BillingView.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const WorkReport: any = WorkReportComponent;
const BillingView: any = BillingViewComponent;

function expectWindow(dateRange: string, firstDate: string, lastDate: string) {
  const settingsStore = useSettingsStore();
  const ctx = { settingsStore, dateRange };
  const work: string[] = WorkReport.methods.getTimeperiods.call(ctx);
  const billing: string = BillingView.methods.getTimeperiod.call(ctx);
  const dates: string[] = [];
  for (const date = moment(firstDate); date.isSameOrBefore(lastDate, 'day'); date.add(1, 'day')) {
    dates.push(date.format('YYYY-MM-DD'));
  }
  expect(work).toHaveLength(dates.length);
  work.forEach((period, i) => {
    const [start, end] = period.split('/').map(value => moment(value));
    expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      `${dates[i]} ${settingsStore.startOfDay}:00.000`
    );
    expect(end.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      `${moment(dates[i]).add(1, 'day').format('YYYY-MM-DD')} ${settingsStore.startOfDay}:00.000`
    );
    if (i > 0) expect(period.split('/')[0]).toBe(work[i - 1].split('/')[1]);
  });
  expect(billing).toBe(`${work[0].split('/')[0]}/${work[work.length - 1].split('/')[1]}`);
  return work;
}

describe('report logical-day anchor', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().startOfDay = '04:00';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([
    [new Date(2026, 10, 1, 3, 59, 59, 999), '2026-10-01', '2026-10-31'],
    [new Date(2026, 10, 1, 4, 0), '2026-11-01', '2026-11-01'],
    [new Date(2026, 10, 1, 4, 0, 0, 1), '2026-11-01', '2026-11-01'],
    [new Date(2027, 0, 1, 2), '2026-12-01', '2026-12-31'],
    [new Date(2028, 2, 1, 2), '2028-02-01', '2028-02-29'],
  ])('anchors thisMonth to the logical month at %s', (now, firstDate, lastDate) => {
    jest.setSystemTime(now);
    expectWindow('thisMonth', firstDate, lastDate);
  });

  test.each([
    ['last7d', '2026-10-25'],
    ['last30d', '2026-10-02'],
  ])('keeps %s inclusive of logical today, not the future calendar day', (range, firstDate) => {
    jest.setSystemTime(new Date(2026, 10, 1, 2, 34, 47, 321));
    expectWindow(range, firstDate, '2026-10-31');
  });

  test.each([
    ['Saturday', new Date(2026, 9, 24, 2), '2026-10-17', '2026-10-23'],
    ['Sunday', new Date(2026, 9, 18, 2), '2026-10-11', '2026-10-17'],
    ['Monday', new Date(2026, 9, 19, 2), '2026-10-12', '2026-10-18'],
  ])('keeps the previous logical week before %s day start', (weekStart, now, first, last) => {
    jest.setSystemTime(now);
    useSettingsStore().startOfWeek = weekStart;
    expectWindow('thisWeek', first, last);
    jest.setSystemTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4));
    const today = moment(now).format('YYYY-MM-DD');
    expectWindow('thisWeek', today, today);
  });

  test.each(['last7d', 'last30d', 'thisWeek', 'thisMonth'])(
    'preserves midnight and post-daystart %s windows',
    range => {
      useSettingsStore().startOfWeek = 'Monday';
      for (const offset of ['00:00', '04:00', '05:30']) {
        useSettingsStore().startOfDay = offset;
        jest.setSystemTime(new Date(2026, 9, 19, 12, 34, 47, 321));
        const first = {
          last7d: '2026-10-13',
          last30d: '2026-09-20',
          thisWeek: '2026-10-19',
          thisMonth: '2026-10-01',
        }[range];
        expectWindow(range, first, '2026-10-19');
      }
    }
  );

  test.each([
    [new Date(2026, 2, 30, 2), '2026-03-23', '2026-03-29'],
    [new Date(2026, 9, 26, 2), '2026-10-19', '2026-10-25'],
  ])('keeps contiguous calendar days across DST at %s', (now, first, last) => {
    // Also run this suite with TZ=Europe/Stockholm to exercise actual offset changes.
    jest.setSystemTime(now);
    expect(get_today_with_offset('04:00')).toBe(last);
    const periods = expectWindow('last7d', first, last);
    if (process.env.TZ === 'Europe/Stockholm') {
      const [start, end] = periods[5].split('/');
      expect(moment(end).diff(moment(start), 'hours')).toBe(now.getMonth() === 2 ? 23 : 25);
    }
  });

  test.each([
    ['Work', WorkReport.methods.getTimeperiods],
    ['Billing', BillingView.methods.getTimeperiod],
  ])(
    '%s keeps one logical anchor if the clock crosses day start during calculation',
    (_, method) => {
      const before = new Date(2026, 10, 1, 3, 59, 59, 999).valueOf();
      const after = new Date(2026, 10, 1, 4).valueOf();
      jest.spyOn(moment, 'now').mockReturnValueOnce(before).mockReturnValue(after);
      const result = method.call({ settingsStore: useSettingsStore(), dateRange: 'thisMonth' });
      const periods: string[] = Array.isArray(result) ? result : [result];
      expect(moment(periods[0].split('/')[0]).format('YYYY-MM-DD')).toBe('2026-10-01');
      expect(moment(periods[periods.length - 1].split('/')[1]).format('YYYY-MM-DD')).toBe(
        '2026-11-01'
      );
      if (Array.isArray(result)) expect(periods).toHaveLength(31);
    }
  );
});
