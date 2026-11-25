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

test('an aborted lookup cannot publish a fallback even without a replacement', async () => {
  let finish;
  const v = dateVm(() => new Promise(resolve => (finish = resolve)));
  const lookup = Activity.methods.loadEarliestDate.call(v);
  controller.abort();
  finish({ date: '2026-01-01', approximate: true });
  expect(await lookup).toBe(false);
  expect(v.earliestDate).toBeNull();
});

test('expected date lookup cancellation is handled, but other failures propagate', async () => {
  const v = dateVm(jest.fn().mockRejectedValueOnce(new Error('canceled')));
  await expect(Activity.methods.loadEarliestDate.call(v)).resolves.toBe(false);
  expect(v.earliestDate).toBeNull();
  v.activityStore.get_earliest_date.mockRejectedValueOnce(new Error('offline'));
  await expect(Activity.methods.loadEarliestDate.call(v)).rejects.toThrow('offline');
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
