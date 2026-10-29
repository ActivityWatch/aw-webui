import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BootstrapVue from 'bootstrap-vue';
import moment from 'moment';

import Alerts from '~/views/Alerts.vue';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';
import { getDefaultAlertGoals } from '~/util/alerts';
import { seconds_to_duration } from '~/util/time';

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.filter('friendlyduration', v => String(v));
localVue.filter('friendlytime', v => String(v));

// Mounts the view with a stubbed $aw client. Buckets are pre-seeded so
// mounted() resolves a hostname without reaching for the global AWClient.
function mountAlerts({ startOfDay = '04:00', storedAlerts = undefined, full = false }: any = {}) {
  const query = jest.fn().mockResolvedValue([[]]);

  const settingsStore = useSettingsStore();
  settingsStore.$patch({ startOfDay, _loaded: true });
  // `_storedKeys` is what tells the view a saved list exists, so seeding
  // `alerts` alone must not be mistaken for a first run.
  if (storedAlerts !== undefined) {
    settingsStore.$patch({ alerts: storedAlerts, _storedKeys: ['alerts'] });
  }
  // `update` would otherwise hit the network; record what would be persisted.
  const update = jest
    .spyOn(settingsStore, 'update')
    .mockImplementation(async patch => settingsStore.$patch(patch));

  useCategoryStore().load([]);
  useBucketsStore().update_buckets(<any[]>[
    { id: 'aw-watcher-window_testhost', type: 'currentwindow', hostname: 'testhost', data: {} },
    { id: 'aw-watcher-afk_testhost', type: 'afkstatus', hostname: 'testhost', data: {} },
  ]);

  const viewVue = full ? createLocalVue() : localVue;
  if (full) {
    viewVue.use(BootstrapVue);
    viewVue.filter('friendlyduration', seconds_to_duration);
    viewVue.filter('friendlytime', v => String(v));
  }
  const wrapper: any = (full ? mount : shallowMount)(Alerts, {
    localVue: viewVue,
    mocks: { $aw: { query } },
    stubs: { icon: true },
  });
  wrapper.setData({ hostname: 'testhost' });

  return { wrapper, query, update, settingsStore };
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

    expect(wrapper.vm.alertTime(['Work'])).toBe(90);
    expect(wrapper.vm.alertTime(['Work', 'Code'])).toBe(30);
    expect(wrapper.vm.last_updated).not.toBeNull();
    expect(wrapper.vm.error).toBe('');
  });
});

describe('Alerts goal progress', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  async function checkEvents(events, storedAlerts = []) {
    const mounted = mountAlerts({ storedAlerts });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    mounted.query.mockResolvedValueOnce([events]);
    await mounted.wrapper.vm.check();
    await mounted.wrapper.vm.$nextTick();
    return mounted;
  }

  test('sums exact and descendant paths without prefix siblings or ancestors', async () => {
    const { wrapper } = await checkEvents([
      { duration: 60, data: { $category: ['Work'] } },
      { duration: 120, data: { $category: ['Work', 'Code'] } },
      { duration: 30, data: { $category: ['Work', 'Code', 'Review'] } },
      { duration: 15, data: { $category: ['Work', 'Code'] } },
      { duration: 600, data: { $category: ['Workout'] } },
      { duration: 900, data: { $category: ['Work', 'Codec'] } },
      { duration: 1000, data: {} },
      { duration: 1000, data: { $category: [] } },
    ]);

    expect(wrapper.vm.alertTime(['Work'])).toBe(1125);
    expect(wrapper.vm.alertTime(['Work', 'Code'])).toBe(165);
    expect(wrapper.vm.alertTime(['Work', 'Code', 'Review'])).toBe(30);
    expect(wrapper.vm.alertTime(['Workout'])).toBe(600);
    expect(wrapper.vm.alertTime(['Missing'])).toBe(0);
    expect(wrapper.vm.alertTime(['undefined'])).toBe(0);
    wrapper.destroy();
  });

  test('keeps delimiter-bearing names distinct from multi-segment paths', async () => {
    const { wrapper } = await checkEvents([
      { duration: 10, data: { $category: ['Work,Code'] } },
      { duration: 20, data: { $category: ['Work', 'Code'] } },
      { duration: 30, data: { $category: ['Work,Code', 'Review'] } },
      { duration: 40, data: { $category: ['Work', 'Code,Review'] } },
      { duration: 50, data: { $category: ['Work', 'Code', 'Review'] } },
      { duration: 60, data: { $category: ['Work,Codec'] } },
      { duration: 70, data: { $category: ['Work', 'Code,Reviewer'] } },
    ]);

    expect(wrapper.vm.alertTime(['Work,Code'])).toBe(40);
    expect(wrapper.vm.alertTime(['Work'])).toBe(180);
    expect(wrapper.vm.alertTime(['Work', 'Code'])).toBe(70);
    expect(wrapper.vm.alertTime(['Work', 'Code,Review'])).toBe(40);
    expect(wrapper.vm.alertTime(['Work', 'Code', 'Review'])).toBe(50);
    wrapper.destroy();
  });

  test('mounted cards show real duration formatting and switch completion at the minute boundary', async () => {
    const { wrapper, query } = mountAlerts({
      full: true,
      storedAlerts: [{ name: 'Work goal', category: ['Work'], goal: 1 }],
    });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    query.mockResolvedValueOnce([
      [
        { duration: 29, data: { $category: ['Work'] } },
        { duration: 30, data: { $category: ['Work', 'Code'] } },
        { duration: 600, data: { $category: ['Workout'] } },
      ],
    ]);
    await wrapper.vm.check();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.card').text()).toContain('59s / 1 minutes');
    expect(wrapper.find('.card .text-success').exists()).toBe(false);
    expect(wrapper.find('.card .text-muted[name="times"]').exists()).toBe(true);

    query.mockResolvedValueOnce([
      [
        { duration: 30, data: { $category: ['Work'] } },
        { duration: 30, data: { $category: ['Work', 'Code'] } },
      ],
    ]);
    await wrapper.vm.check();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.card').text()).toContain('1m 0s / 1 minutes');
    expect(wrapper.find('.card .text-success').exists()).toBe(true);
    expect(wrapper.find('.card .text-muted[name="times"]').exists()).toBe(false);
    wrapper.destroy();
  });

  test.each([
    [1, 1, false],
    [1, 59, false],
    [1, 60, true],
    [1, 61, true],
    [0.5, 29, false],
    [0.5, 30, true],
    [0.5, 31, true],
    [0, 0, true],
  ])('a %s-minute goal at %s seconds has completion %s', async (goal, seconds, complete) => {
    const stored = [{ name: 'Code', category: ['Work', 'Code'], goal }];
    const { wrapper, settingsStore, update } = await checkEvents(
      [{ duration: seconds, data: { $category: ['Work', 'Code'] } }],
      stored
    );

    expect(wrapper.find('.text-success').exists()).toBe(complete);
    expect(wrapper.find('.text-muted[name="times"]').exists()).toBe(!complete);
    // The filter receives seconds; only the completion comparison converts minutes.
    expect(wrapper.text()).toContain(`${seconds} / ${goal} minutes`);
    expect(settingsStore.alerts).toEqual(stored);
    expect(update).not.toHaveBeenCalled();
    wrapper.destroy();
  });
});

describe('Alerts goal persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // mounted() is async; drain its microtasks before asserting. A microtask
  // loop is used rather than a timer so it works under fake timers too.
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  test('seeds sample goals when nothing has ever been stored', async () => {
    const { wrapper } = mountAlerts();
    await settle();
    expect(wrapper.vm.alerts).toEqual(getDefaultAlertGoals());
  });

  test('restores stored goals instead of the samples', async () => {
    const stored = [{ name: 'Reading', category: ['Media', 'Reading'], goal: 20 }];
    const { wrapper } = mountAlerts({ storedAlerts: stored });
    await settle();
    expect(wrapper.vm.alerts).toEqual(stored);
  });

  test('preserves a stored empty list rather than re-seeding samples', async () => {
    const { wrapper } = mountAlerts({ storedAlerts: [] });
    await settle();
    expect(wrapper.vm.alerts).toEqual([]);
  });

  test('drops malformed stored goals without crashing', async () => {
    const { wrapper } = mountAlerts({
      storedAlerts: [{ name: 'Good', category: ['Work'], goal: 5 }, { name: '' }, 'garbage'],
    });
    await settle();
    expect(wrapper.vm.alerts).toEqual([{ name: 'Good', category: ['Work'], goal: 5 }]);
  });

  test('persists an added goal, normalizing the numeric input', async () => {
    const { wrapper, update } = mountAlerts({ storedAlerts: [] });
    await settle();

    wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: '90' };
    await wrapper.vm.addAlert();

    expect(update).toHaveBeenCalledWith({
      alerts: [{ name: 'Code', category: ['Work', 'Code'], goal: 90 }],
    });
    expect(wrapper.vm.alerts).toEqual([{ name: 'Code', category: ['Work', 'Code'], goal: 90 }]);
    // The form is cleared only on success.
    expect(wrapper.vm.editing_alert).toEqual({});
    expect(wrapper.vm.error).toBe('');
  });

  test('an added goal survives a remount', async () => {
    const { wrapper, settingsStore } = mountAlerts({ storedAlerts: [] });
    await settle();
    wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: 90 };
    await wrapper.vm.addAlert();

    // Remount against the settings the previous instance wrote.
    const remounted = mountAlerts({ storedAlerts: settingsStore.alerts });
    await settle();
    expect(remounted.wrapper.vm.alerts).toEqual([
      { name: 'Code', category: ['Work', 'Code'], goal: 90 },
    ]);
  });

  test('persists a deletion, and it stays deleted after a remount', async () => {
    const stored = [
      { name: 'Work', category: ['Work'], goal: 100 },
      { name: 'Media', category: ['Media'], goal: 10 },
    ];
    const { wrapper, update, settingsStore } = mountAlerts({ storedAlerts: stored });
    await settle();

    await wrapper.vm.deleteAlert('Work');

    expect(update).toHaveBeenCalledWith({
      alerts: [{ name: 'Media', category: ['Media'], goal: 10 }],
    });
    const remounted = mountAlerts({ storedAlerts: settingsStore.alerts });
    await settle();
    expect(remounted.wrapper.vm.alerts).toEqual([{ name: 'Media', category: ['Media'], goal: 10 }]);
  });

  test('deleting every goal persists an empty list that stays empty', async () => {
    const { wrapper, settingsStore } = mountAlerts({
      storedAlerts: [{ name: 'Work', category: ['Work'], goal: 100 }],
    });
    await settle();

    await wrapper.vm.deleteAlert('Work');
    expect(settingsStore.alerts).toEqual([]);

    const remounted = mountAlerts({ storedAlerts: settingsStore.alerts });
    await settle();
    expect(remounted.wrapper.vm.alerts).toEqual([]);
  });

  test('rejects an invalid goal without persisting anything', async () => {
    const { wrapper, update } = mountAlerts({ storedAlerts: [] });
    await settle();

    // The "All" category option has a null value, which is not a usable goal.
    wrapper.vm.editing_alert = { name: 'Everything', category: null, goal: 10 };
    await wrapper.vm.addAlert();

    expect(update).not.toHaveBeenCalled();
    expect(wrapper.vm.alerts).toEqual([]);
    expect(wrapper.vm.error).not.toBe('');
    // Input is retained so the user can correct it.
    expect(wrapper.vm.editing_alert.name).toBe('Everything');
  });

  test('restores the previous list and surfaces an error when the save fails', async () => {
    const stored = [{ name: 'Work', category: ['Work'], goal: 100 }];
    const { wrapper, update } = mountAlerts({ storedAlerts: stored });
    await settle();

    update.mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: 90 };
    await wrapper.vm.addAlert();

    expect(wrapper.vm.alerts).toEqual(stored);
    expect(wrapper.vm.error).toMatch(/failed to save/i);
    // The unsaved input is kept so the user can retry.
    expect(wrapper.vm.editing_alert.name).toBe('Code');

    // Retry succeeds.
    await wrapper.vm.addAlert();
    expect(wrapper.vm.alerts).toHaveLength(2);
    expect(wrapper.vm.error).toBe('');
  });

  test.each(['add', 'delete'])(
    'failed %s rolls back the settings store as well as the visible list',
    async action => {
      const stored = [{ name: 'Work', category: ['Work'], goal: 100 }];
      const { wrapper, update, settingsStore } = mountAlerts({ storedAlerts: stored });
      await settle();
      update.mockRestore();
      const save = jest.spyOn(settingsStore, 'save').mockRejectedValueOnce(new Error('offline'));
      const errors = jest.spyOn(console, 'error').mockImplementation(jest.fn());
      if (action === 'add') {
        wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: 90 };
        await wrapper.vm.addAlert();
      } else {
        await wrapper.vm.deleteAlert('Work');
      }
      expect(wrapper.vm.alerts).toEqual(stored);
      expect(settingsStore.alerts).toEqual(stored);
      wrapper.destroy();
      const remounted = mountAlerts();
      await settle();
      expect(remounted.wrapper.vm.alerts).toEqual(stored);
      remounted.wrapper.destroy();
      save.mockRestore();
      errors.mockRestore();
    }
  );

  test('a second click while a save is pending does not write twice', async () => {
    const { wrapper, update } = mountAlerts({ storedAlerts: [] });
    await settle();

    let release;
    update.mockImplementationOnce(() => new Promise(resolve => (release = resolve)));

    wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: 90 };
    const first = wrapper.vm.addAlert();
    const second = wrapper.vm.addAlert();

    expect(update).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test('does not persist transient view state alongside the goals', async () => {
    const { wrapper, update } = mountAlerts({ storedAlerts: [] });
    await settle();

    wrapper.vm.editing_alert = { name: 'Code', category: ['Work', 'Code'], goal: 90 };
    await wrapper.vm.addAlert();

    const patch = update.mock.calls[0][0];
    expect(Object.keys(patch)).toEqual(['alerts']);
    for (const goal of patch.alerts) {
      expect(Object.keys(goal).sort()).toEqual(['category', 'goal', 'name']);
    }
  });
});
