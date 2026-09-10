import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BootstrapVue from 'bootstrap-vue';
import moment from 'moment';

import Alerts from '~/views/Alerts.vue';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.filter('friendlyduration', v => String(v));
localVue.filter('friendlytime', v => String(v));

// Mounts the view with a stubbed $aw client. Buckets are pre-seeded so
// mounted() resolves a hostname without reaching for the global AWClient.
function mountAlerts({ startOfDay = '04:00' } = {}) {
  const query = jest.fn().mockResolvedValue([[]]);

  useSettingsStore().$patch({ startOfDay, _loaded: true });
  useCategoryStore().load([]);
  useBucketsStore().update_buckets([
    { id: 'aw-watcher-window_testhost', type: 'currentwindow', hostname: 'testhost', data: {} },
    { id: 'aw-watcher-afk_testhost', type: 'afkstatus', hostname: 'testhost', data: {} },
  ]);

  const wrapper = shallowMount(Alerts, {
    localVue,
    mocks: { $aw: { query } },
    stubs: { icon: true },
  });
  wrapper.setData({ hostname: 'testhost' });

  return { wrapper, query };
}

// Mounts and runs one check(), returning the mocked client call.
async function runCheck(opts) {
  const { wrapper, query } = mountAlerts(opts);
  await wrapper.vm.check();
  return { wrapper, query };
}

// The single timeperiod string check() submitted, split into start/end.
function submittedPeriod(query) {
  expect(query).toHaveBeenCalledTimes(1);
  const timeperiods = query.mock.calls[0][0];
  expect(timeperiods).toHaveLength(1);
  const [start, end] = timeperiods[0].split('/');
  return { start: moment(start), end: moment(end) };
}

describe('Alerts query range', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function freeze(local) {
    jest.useFakeTimers().setSystemTime(moment(local).toDate());
  }

  test('with a 00:00 boundary, queries from midnight through now', async () => {
    freeze('2026-09-10T15:30:00');
    const { query } = await runCheck({ startOfDay: '00:00' });

    const { start, end } = submittedPeriod(query);
    expect(start.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 00:00:00');
    expect(end.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 15:30:00');
  });

  test('with a 04:00 boundary before the boundary, queries from the previous day', async () => {
    freeze('2026-09-10T02:00:00');
    const { query } = await runCheck({ startOfDay: '04:00' });

    const { start, end } = submittedPeriod(query);
    expect(start.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-09 04:00:00');
    expect(end.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 02:00:00');
  });

  test('with a 04:00 boundary after the boundary, queries from the same day', async () => {
    freeze('2026-09-10T15:30:00');
    const { query } = await runCheck({ startOfDay: '04:00' });

    const { start, end } = submittedPeriod(query);
    expect(start.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 04:00:00');
    expect(end.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 15:30:00');
  });

  test('exactly at the boundary, the interval starts at now and is not negative', async () => {
    freeze('2026-09-10T04:00:00');
    const { query } = await runCheck({ startOfDay: '04:00' });

    const { start, end } = submittedPeriod(query);
    expect(start.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-10 04:00:00');
    expect(end.diff(start)).toBe(0);
  });

  test('respects a fractional-hour boundary without going negative', async () => {
    freeze('2026-09-10T04:15:00');
    const { query } = await runCheck({ startOfDay: '04:30' });

    const { start, end } = submittedPeriod(query);
    expect(start.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-09-09 04:30:00');
    expect(end.diff(start)).toBeGreaterThan(0);
  });

  test('zeroes seconds and milliseconds on the boundary', async () => {
    freeze('2026-09-10T15:30:45.123');
    const { query } = await runCheck({ startOfDay: '04:00' });

    const { start } = submittedPeriod(query);
    expect(start.seconds()).toBe(0);
    expect(start.milliseconds()).toBe(0);
  });

  test('retains the local UTC offset in the submitted period', async () => {
    freeze('2026-09-10T15:30:00');
    const { query } = await runCheck({ startOfDay: '04:00' });

    const timeperiods = query.mock.calls[0][0];
    const [startStr, endStr] = timeperiods[0].split('/');
    // moment().format() emits an ISO-8601 string with the local offset.
    expect(startStr).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
    expect(endStr).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
  });

  test('still processes the query response', async () => {
    freeze('2026-09-10T15:30:00');
    const { wrapper } = mountAlerts({ startOfDay: '04:00' });

    wrapper.vm.$aw.query.mockResolvedValue([
      [
        { duration: 60, data: { $category: ['Work'] } },
        { duration: 30, data: { $category: ['Work', 'Code'] } },
      ],
    ]);
    await wrapper.vm.check();

    expect(wrapper.vm.alert_times).toEqual({ Work: 60, 'Work,Code': 30 });
    expect(wrapper.vm.last_updated).not.toBeNull();
    expect(wrapper.vm.error).toBe('');
  });
});
