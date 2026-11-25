import ActivityComponent from '~/views/activity/Activity.vue';

const abort = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ abort }) }));

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

beforeEach(() => abort.mockClear());

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
