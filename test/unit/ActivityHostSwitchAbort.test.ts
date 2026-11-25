import ActivityComponent from '~/views/activity/Activity.vue';

const abort = jest.fn();
let controller = new AbortController();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ abort, controller }) }));

const Activity: any = ActivityComponent;

function vm(overrides = {}) {
  return {
    periodLength: 'all',
    prioritySaving: false,
    viewSavePending: false,
    earliestDate: '2020-01-01',
    loadEarliestDate: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  abort.mockReset();
  controller = new AbortController();
});

function dateVm(getDate) {
  return {
    periodLength: 'all',
    host: 'new-host',
    earliestDate: null,
    earliestDateGeneration: 0,
    settingsStore: { startOfDay: '00:00' },
    activityStore: { get_earliest_date: getDate },
  };
}

test('a superseded lookup cannot publish a fallback while its replacement is pending', async () => {
  let finishOld;
  let finishNew;
  const getDate = jest
    .fn()
    .mockImplementationOnce(() => new Promise(resolve => (finishOld = resolve)))
    .mockImplementationOnce(() => new Promise(resolve => (finishNew = resolve)));
  const v = dateVm(getDate);
  const old = Activity.methods.loadEarliestDate.call(v);
  const replacement = Activity.methods.loadEarliestDate.call(v);
  finishOld({ date: '2026-01-01', approximate: true });
  expect(await old).toBe(false);
  expect(v.earliestDate).toBeNull();
  finishNew({ date: '2020-01-01', approximate: false });
  expect(await replacement).toBe(true);
  expect(v.earliestDate).toBe('2020-01-01');
});

test('the deferred abort ignores the canceled fallback and keeps the replacement range', async () => {
  let finishOld;
  let finishNew;
  const getDate = jest
    .fn()
    .mockImplementationOnce(() => new Promise(resolve => (finishOld = resolve)))
    .mockImplementationOnce(() => new Promise(resolve => (finishNew = resolve)));
  const v: any = {
    ...flushVm({ earliestDate: null, priorityRefreshPending: true }),
    ...dateVm(getDate),
  };
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  const old = v.loadEarliestDate();
  abort.mockImplementation(() => {
    controller.abort();
    controller = new AbortController();
  });
  await Activity.methods.flushDeferredRefresh.call(v);
  expect(getDate).toHaveBeenCalledTimes(2);
  finishOld({ date: '2026-01-01', approximate: true });
  await old;
  expect(v.earliestDate).toBeNull();
  finishNew({ date: '2020-01-01', approximate: false });
  await Promise.resolve();
  expect(v.earliestDate).toBe('2020-01-01');
});

test('an aborted lookup is retried and publishes the fresh date', async () => {
  // A Day load resuming after a settings reload aborts the shared client while
  // All time is still selected. The canceled fallback must not be published,
  // but the range has to be recovered instead of leaving Day data under All time.
  let finish;
  const getDate = jest
    .fn()
    .mockImplementationOnce(() => new Promise(resolve => (finish = resolve)))
    .mockResolvedValueOnce({ date: '2020-01-01', approximate: false });
  const v: any = dateVm(getDate);
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  const lookup = v.loadEarliestDate();
  // abort() installs a fresh controller, so the retry is not canceled too.
  controller.abort();
  controller = new AbortController();
  finish({ date: '2026-01-01', approximate: true });
  expect(await lookup).toBe(true);
  expect(getDate).toHaveBeenCalledTimes(2);
  expect(v.earliestDate).toBe('2020-01-01');
});

test('a store-canceled lookup is retried once and then gives up', async () => {
  const getDate = jest
    .fn()
    .mockRejectedValueOnce(new Error('canceled'))
    .mockRejectedValueOnce(new Error('canceled'));
  const v: any = dateVm(getDate);
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  await expect(v.loadEarliestDate()).resolves.toBe(false);
  expect(getDate).toHaveBeenCalledTimes(2);
  expect(v.earliestDate).toBeNull();
});

test('an aborted lookup is not retried once the period changed', async () => {
  let finish;
  const getDate = jest.fn(() => new Promise(resolve => (finish = resolve)));
  const v: any = dateVm(getDate);
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  const lookup = v.loadEarliestDate();
  controller.abort();
  v.periodLength = 'day';
  finish({ date: '2026-01-01', approximate: true });
  await expect(lookup).resolves.toBe(false);
  expect(getDate).toHaveBeenCalledTimes(1);
  expect(v.earliestDate).toBeNull();
});

test('expected date lookup cancellation is handled, but other failures propagate', async () => {
  const v: any = dateVm(jest.fn().mockRejectedValue(new Error('canceled')));
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  await expect(v.loadEarliestDate()).resolves.toBe(false);
  expect(v.earliestDate).toBeNull();
  v.activityStore.get_earliest_date.mockRejectedValueOnce(new Error('offline'));
  await expect(v.loadEarliestDate()).rejects.toThrow('offline');
});

test('a deferred refresh handles expected activity cancellation', async () => {
  const v = {
    priorityDisposed: false,
    prioritySaving: false,
    viewSavePending: false,
    timeperiod: {},
    settingsStore: {},
    activityStore: { ensure_loaded: jest.fn().mockRejectedValue(new Error('canceled')) },
    refreshGeneration: 0,
    refreshing: false,
  };
  await expect(Activity.methods.refresh.call(v, false)).resolves.toBeUndefined();
  expect(v.refreshing).toBe(false);
  v.activityStore.ensure_loaded.mockRejectedValueOnce(new Error('offline'));
  await expect(Activity.methods.refresh.call(v, false)).rejects.toThrow('offline');
});

test('switching host on All time aborts the old host load and clears the earliest date', () => {
  const v = vm();
  Activity.watch.host.call(v);
  expect(abort).toHaveBeenCalledTimes(1);
  expect(v.earliestDate).toBeNull();
  expect(v.loadEarliestDate).toHaveBeenCalled();
});

test('switching host on a bounded period leaves aborting to the refresh', () => {
  Activity.watch.host.call(vm({ periodLength: 'day' }));
  expect(abort).not.toHaveBeenCalled();
});

test('switching host during a priority save defers the abort', () => {
  const v: any = vm({ prioritySaving: true });
  Activity.watch.host.call(v);
  expect(abort).not.toHaveBeenCalled();
  expect(v.deferredHostAbort).toBe(true);
});

test('switching host while a layout save is pending defers the abort', () => {
  // The save may still be reading settings; aborting would fail it before it writes.
  const v: any = vm({ viewSavePending: true });
  Activity.watch.host.call(v);
  expect(abort).not.toHaveBeenCalled();
  expect(v.deferredHostAbort).toBe(true);
});

function flushVm(overrides = {}) {
  return vm({
    priorityDisposed: false,
    deferredHostAbort: true,
    priorityRefreshPending: false,
    priorityRefreshForce: false,
    ...overrides,
  });
}

test('the deferred abort runs once the save settles and restarts a cancelled date lookup', async () => {
  const v: any = flushVm({ earliestDate: null, priorityRefreshPending: true });
  await Activity.methods.flushDeferredRefresh.call(v);
  expect(abort).toHaveBeenCalledTimes(1);
  expect(v.deferredHostAbort).toBe(false);
  expect(v.loadEarliestDate).toHaveBeenCalledTimes(1);
  expect(v.refresh).toHaveBeenCalledTimes(1);
  expect(v.priorityRefreshPending).toBe(false);
});

test('the deferred flush starts the All-time query with the date the lookup recovered', async () => {
  // End-to-end for the case Greptile flagged on the isolated retry test: a Day
  // load aborts the shared client while a layout save is still reading settings,
  // so the host abort and the All-time refresh are both deferred. When the save
  // settles the lookup runs again, and the page has to load All-time results
  // starting at the recovered date instead of leaving Day data under All time.
  let finishCanceled;
  const getDate = jest
    .fn()
    .mockImplementationOnce(() => new Promise(resolve => (finishCanceled = resolve)))
    .mockResolvedValue({ date: '2020-01-01', approximate: false });
  const ensureLoaded = jest.fn().mockResolvedValue(undefined);
  const v: any = {
    ...flushVm({ earliestDate: null, viewSavePending: true }),
    ...dateVm(getDate),
    activityStore: { get_earliest_date: getDate, ensure_loaded: ensureLoaded },
    refreshGeneration: 0,
    refreshing: false,
    needsCategoryHistory: false,
    filter_afk: false,
    include_audible: false,
    include_stopwatch: false,
    include_category_history: false,
    filter_categories: [],
    always_active_pattern: null,
    navigationNow: 0,
    // Mirrors Activity.vue: All time has no timeperiod until the date is known.
    get timeperiod() {
      return this.earliestDate ? { start: this.earliestDate, length: [1, 'year'] } : null;
    },
  };
  v.loadEarliestDate = Activity.methods.loadEarliestDate.bind(v);
  v.refresh = Activity.methods.refresh.bind(v);
  // A Day load resuming after the settings reload cancels the in-flight lookup.
  abort.mockImplementation(() => {
    controller.abort();
    controller = new AbortController();
  });

  const firstLookup = v.loadEarliestDate();
  v.viewSavePending = false;
  await Activity.methods.flushDeferredRefresh.call(v);

  // The restarted lookup publishes the real date; the deferred refresh ran
  // before that and had no timeperiod yet.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(v.earliestDate).toBe('2020-01-01');
  expect(ensureLoaded).not.toHaveBeenCalled();

  // The timeperiod watcher is what loads the newly known range.
  Activity.watch.timeperiod.call(v);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ensureLoaded).toHaveBeenCalledTimes(1);
  expect(ensureLoaded.mock.calls[0][0]).toMatchObject({
    all_time: true,
    timeperiod: { start: '2020-01-01' },
  });

  // The canceled store fallback must still not overwrite the recovered range.
  finishCanceled({ date: '2026-01-01', approximate: true });
  await firstLookup;
  expect(v.earliestDate).toBe('2020-01-01');
});

test('the deferred abort waits while another save is still pending', async () => {
  const v: any = flushVm({ viewSavePending: true, priorityRefreshPending: true });
  await Activity.methods.flushDeferredRefresh.call(v);
  expect(abort).not.toHaveBeenCalled();
  expect(v.refresh).not.toHaveBeenCalled();
  expect(v.deferredHostAbort).toBe(true);
  expect(v.priorityRefreshPending).toBe(true);
});

test('settling the layout save flushes the deferred work', () => {
  const v: any = { flushDeferredRefresh: jest.fn() };
  Activity.watch.viewSavePending.call(v, true);
  expect(v.flushDeferredRefresh).not.toHaveBeenCalled();
  Activity.watch.viewSavePending.call(v, false);
  expect(v.flushDeferredRefresh).toHaveBeenCalledTimes(1);
});

test('a refresh during a layout save is coalesced instead of aborting the save', async () => {
  // refresh() reaches ensure_loaded, which aborts the shared client.
  const v: any = flushVm({ viewSavePending: true, priorityRefreshPending: false });
  await Activity.methods.refresh.call(v, true);
  expect(v.priorityRefreshPending).toBe(true);
  expect(v.priorityRefreshForce).toBe(true);
  expect(abort).not.toHaveBeenCalled();
});
