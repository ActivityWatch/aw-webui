import Vue from 'vue';
import moment from 'moment';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Trends from '~/views/Trends.vue';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

describe('Trends view', () => {
  describe('host computed', () => {
    test('returns the :host route param when present', () => {
      const vm = {
        $route: { params: { host: 'laptop' } },
        bucketsStore: { knownHosts: ['desktop', 'laptop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('laptop');
    });

    test('ignores a stale :host param that is no longer selectable', () => {
      // e.g. a previously selectable /trends/unknown URL on an install where
      // only the stopwatch pseudo-host plus one real device exist: the select
      // is hidden, so honouring the stale param would trap the user.
      const vm = {
        $route: { params: { host: 'unknown' } },
        bucketsStore: { knownHosts: ['desktop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('desktop');
    });

    test('falls back to the first available host when no :host param', () => {
      // Regression: navigating to /trends without :host used to throw
      // "TypeError: can't access property endsWith, bid is undefined"
      // because the route param was undefined and queries got built with
      // bid_window=undefined.
      const vm = {
        $route: { params: {} },
        bucketsStore: { knownHosts: ['desktop', 'laptop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('desktop');
    });

    test('returns undefined when there are no hosts at all', () => {
      const vm = {
        $route: { params: {} },
        bucketsStore: { knownHosts: [] },
      };
      expect(Trends.computed.host.call(vm)).toBeUndefined();
    });

    test('offers only real devices in the host select', () => {
      const vm = { bucketsStore: { knownHosts: ['desktop'], hosts: ['unknown', 'desktop'] } };
      expect(Trends.computed.hostOptions.call(vm)).toEqual([{ value: 'desktop', text: 'desktop' }]);
    });
  });

  describe('dayPeriods', () => {
    test('slices days at the configured start of day, not calendar midnight', () => {
      // Regression: with startOfDay 04:00 the Activity view counts 00:00-04:00
      // as the previous day, but Trends sliced every period at midnight, so
      // after-midnight activity fell outside the current window and each bar
      // was offset by four hours.
      const vm = { settingsStore: { startOfDay: '04:00' } };
      const periods = Trends.methods.dayPeriods.call(
        vm,
        moment('2026-10-18'),
        moment('2026-10-20')
      );
      expect(periods).toEqual([
        `${moment('2026-10-18T04:00:00').format()}/${moment('2026-10-19T04:00:00').format()}`,
        `${moment('2026-10-19T04:00:00').format()}/${moment('2026-10-20T04:00:00').format()}`,
      ]);
    });

    test('keeps midnight slices when start of day is 00:00', () => {
      const vm = { settingsStore: { startOfDay: '00:00' } };
      const periods = Trends.methods.dayPeriods.call(
        vm,
        moment('2026-10-19'),
        moment('2026-10-20')
      );
      expect(periods).toEqual([
        `${moment('2026-10-19').format()}/${moment('2026-10-20').format()}`,
      ]);
    });
  });

  describe('query windows', () => {
    test('previous totals end where current day queries begin at 04:00', async () => {
      const query = jest
        .fn()
        .mockResolvedValue([{ cat_events: [{ data: { $category: ['Work'] }, duration: 600 }] }]);
      getClient.mockReturnValue({ query });
      const vm = {
        settingsStore: { startOfDay: '04:00' },
        buildCategoryQuery: () => ['RETURN = {};'],
      };
      vm.dayPeriods = Trends.methods.dayPeriods.bind(vm);

      const previous = await Trends.methods.queryTotals.call(
        vm,
        'host-a',
        moment('2026-10-05'),
        moment('2026-10-12')
      );
      const current = await Trends.methods.queryByDay.call(
        vm,
        'host-a',
        moment('2026-10-12'),
        moment('2026-10-19')
      );

      const boundary = moment('2026-10-12T04:00:00').format();
      expect(query).toHaveBeenNthCalledWith(
        1,
        [`${moment('2026-10-05T04:00:00').format()}/${boundary}`],
        ['RETURN = {};'],
        { name: 'trendsTotals', verbose: true }
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        [`${boundary}/${moment('2026-10-13T04:00:00').format()}`],
        ['RETURN = {};'],
        { name: 'trendsByDay', verbose: true }
      );
      expect(query).toHaveBeenCalledTimes(8);
      expect(query.mock.calls[0][0][0].split('/')[1]).toBe(query.mock.calls[1][0][0].split('/')[0]);
      expect(Object.keys(current.byPeriod)).toHaveLength(7);
      expect(previous).toEqual({ '["Work"]': 600 });
      expect(current.totals).toEqual({ '["Work"]': 4200 });
    });
  });

  describe('refresh', () => {
    test('bails out without querying when no host is resolvable', async () => {
      const ensureLoaded = jest.fn();
      const vm = {
        host: undefined,
        activityStore: { ensure_loaded: ensureLoaded },
        timeperiod: { start: new Date(), length: [7, 'day'] },
      };
      await Trends.methods.refresh.call(vm);
      expect(ensureLoaded).not.toHaveBeenCalled();
    });

    // Regression for the original bid.endsWith crash used to assert that
    // refresh() forwarded to activityStore.ensure_loaded. That code path
    // no longer exists — Trends now queries the aw-server directly via
    // getClient() and ensure_loaded() is not involved. The host-fallback
    // and no-host-bail-out tests above still cover the bug class.
  });
});

describe('Trends refresh ownership', () => {
  let wrapper;
  let route;
  let calls;
  let store;

  const hostOf = call => {
    const query = (call.query || []).join(' ');
    if (query.includes('aw-watcher-window_b')) return 'b';
    if (query.includes('aw-watcher-window_a')) return 'a';
    return undefined;
  };

  const callsFor = (host, name) =>
    calls.filter(call => !call.settled && hostOf(call) === host && call.name === name);

  // Resolve every query belonging to `host`, in order. The first per-day query
  // returns `dayEvents`, all following days are empty, and the totals query
  // returns `totalsEvents`.
  const resolveRefresh = async (host, { dayEvents = [], totalsEvents = [] } = {}) => {
    let firstDay = true;
    for (let guard = 0; guard < 200; guard++) {
      const dayCall = callsFor(host, 'trendsByDay')[0];
      if (!dayCall) break;
      dayCall.settled = true;
      dayCall.deferred.resolve([{ cat_events: firstDay ? dayEvents : [] }]);
      firstDay = false;
      await flush();
    }
    const totalsCall = callsFor(host, 'trendsTotals')[0];
    if (totalsCall) {
      totalsCall.settled = true;
      totalsCall.deferred.resolve([{ cat_events: totalsEvents }]);
      await flush();
    }
  };

  // Resolve the most recently started refresh. Older refreshes are blocked on
  // their own first day query, so the newest pending per-day call belongs to
  // the newest refresh.
  const resolveNewest = async ({ dayEvents = [], totalsEvents = [] } = {}) => {
    let firstDay = true;
    for (let guard = 0; guard < 200; guard++) {
      const pendingDays = calls.filter(call => !call.settled && call.name === 'trendsByDay');
      if (!pendingDays.length) break;
      const call = pendingDays[pendingDays.length - 1];
      call.settled = true;
      call.deferred.resolve([{ cat_events: firstDay ? dayEvents : [] }]);
      firstDay = false;
      await flush();
    }
    const pendingTotals = calls.filter(call => !call.settled && call.name === 'trendsTotals');
    if (pendingTotals.length) {
      const totals = pendingTotals[pendingTotals.length - 1];
      totals.settled = true;
      totals.deferred.resolve([{ cat_events: totalsEvents }]);
      await flush();
    }
  };

  const rejectRefresh = async host => {
    const dayCall = callsFor(host, 'trendsByDay')[0];
    if (dayCall) {
      dayCall.settled = true;
      dayCall.deferred.reject(new Error('network down'));
      await flush();
    }
  };

  beforeEach(async () => {
    calls = [];
    createTestingPinia({
      initialState: {
        buckets: {
          buckets: [
            bucket('a', 'window'),
            bucket('a', 'afk'),
            bucket('b', 'window'),
            bucket('b', 'afk'),
          ],
        },
      },
    });
    store = useBucketsStore();
    getClient.mockReturnValue({
      query: jest.fn((periods, query, options) => {
        const call = {
          periods,
          query,
          name: options && options.name,
          settled: false,
          deferred: deferred(),
        };
        calls.push(call);
        return call.deferred.promise;
      }),
    });
    route = Vue.observable({ params: { host: 'a' } });
  });

  afterEach(() => {
    if (wrapper) wrapper.destroy();
    wrapper = null;
    jest.clearAllMocks();
  });

  const mount = async () => {
    wrapper = shallowMount(Trends, {
      localVue,
      mocks: { $route: route },
      stubs: STUBS,
    });
    await flush();
    return wrapper;
  };

  test('a stale success does not overwrite the newly selected host and range', async () => {
    await mount();
    // First refresh is host a / 7 days.
    expect(callsFor('a', 'trendsByDay')).toHaveLength(1);
    expect(callsFor('a', 'trendsTotals')).toHaveLength(1);

    // The user switches to host b and a 30-day range while the first refresh
    // is still in flight.
    wrapper.vm.periodDays = 30;
    route.params.host = 'b';
    await flush();
    expect(callsFor('b', 'trendsByDay')).toHaveLength(1);

    // B finishes first and renders.
    await resolveRefresh('b', {
      dayEvents: [workEvent(30)],
      totalsEvents: [workEvent(20)],
    });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 30 });
    expect(wrapper.vm.previousTotals).toEqual({ '["Work"]': 20 });
    const renderedPeriod = Object.keys(wrapper.vm.byPeriod)[0];
    const renderedByPeriod = JSON.parse(JSON.stringify(wrapper.vm.byPeriod));

    // The stale A response lands last. It must not touch the rendered state.
    await resolveRefresh('a', {
      dayEvents: [workEvent(7)],
      totalsEvents: [workEvent(5)],
    });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 30 });
    expect(wrapper.vm.previousTotals).toEqual({ '["Work"]': 20 });
    expect(wrapper.vm.byPeriod).toEqual(renderedByPeriod);
    expect(wrapper.vm.byPeriod[renderedPeriod].cat_events).toEqual([workEvent(30)]);
    expect(wrapper.vm.loading).toBe(false);
  });

  test('an older refresh finishing does not clear loading while a newer one is pending', async () => {
    await mount();
    wrapper.vm.periodDays = 30;
    route.params.host = 'b';
    await flush();

    // The older A refresh settles completely while B is still pending.
    await resolveRefresh('a', {
      dayEvents: [workEvent(7)],
      totalsEvents: [workEvent(5)],
    });
    expect(wrapper.vm.loading).toBe(true);
    expect(wrapper.vm.currentTotals).toEqual({});

    await resolveRefresh('b', {
      dayEvents: [workEvent(30)],
      totalsEvents: [workEvent(20)],
    });
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 30 });
  });

  test('a stale failure does not clear the newer results', async () => {
    await mount();
    wrapper.vm.periodDays = 30;
    route.params.host = 'b';
    await flush();

    await resolveRefresh('b', {
      dayEvents: [workEvent(30)],
      totalsEvents: [workEvent(20)],
    });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 30 });

    await rejectRefresh('a');
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 30 });
    expect(wrapper.vm.previousTotals).toEqual({ '["Work"]': 20 });
    expect(wrapper.vm.byPeriod).not.toEqual({});
    expect(wrapper.vm.loading).toBe(false);
  });

  test('rapid period changes keep the last selected range', async () => {
    await mount();
    wrapper.vm.setPeriod(30);
    wrapper.vm.setPeriod(90);
    await flush();

    // Three refreshes are in flight: 7, 30 and 90 days.
    expect(calls.filter(call => !call.settled)).toHaveLength(6);

    // The newest (90 days) finishes first, then the older ones land.
    await resolveNewest({ dayEvents: [workEvent(90)], totalsEvents: [workEvent(80)] });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 90 });
    expect(wrapper.vm.loading).toBe(false);

    await resolveNewest({ dayEvents: [workEvent(30)], totalsEvents: [workEvent(20)] });
    await resolveNewest({ dayEvents: [workEvent(7)], totalsEvents: [workEvent(5)] });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 90 });
    expect(wrapper.vm.previousTotals).toEqual({ '["Work"]': 80 });
    expect(wrapper.vm.loading).toBe(false);
  });

  test('removing the selected host ignores its in-flight response', async () => {
    route.params.host = 'b';
    await mount();
    expect(callsFor('b', 'trendsByDay')).toHaveLength(1);

    // Host b disappears; the computed host falls back to a and refreshes.
    store.buckets = [bucket('a', 'window'), bucket('a', 'afk')];
    await flush();
    expect(wrapper.vm.host).toBe('a');
    expect(callsFor('a', 'trendsByDay')).toHaveLength(1);

    // The removed host's response lands while the fallback refresh is pending.
    await resolveRefresh('b', {
      dayEvents: [workEvent(42)],
      totalsEvents: [workEvent(40)],
    });
    expect(wrapper.vm.currentTotals).toEqual({});
    expect(wrapper.vm.loading).toBe(true);

    await resolveRefresh('a', {
      dayEvents: [workEvent(10)],
      totalsEvents: [workEvent(8)],
    });
    expect(wrapper.vm.currentTotals).toEqual({ '["Work"]': 10 });
    expect(wrapper.vm.loading).toBe(false);
  });

  test('in-flight day queries use the host snapshotted at refresh start', async () => {
    await mount();
    const day2Start = wrapper.vm.currentStart.clone().add(1, 'day').format();

    // Switch host mid-refresh. The old refresh keeps running; its remaining
    // per-day queries must keep querying host a.
    route.params.host = 'b';
    await flush();

    const firstDay = callsFor('a', 'trendsByDay')[0];
    firstDay.settled = true;
    firstDay.deferred.resolve([{ cat_events: [] }]);
    await flush();

    const day2 = calls.find(
      call => call.periods && call.periods[0] && call.periods[0].startsWith(day2Start)
    );
    expect(day2).toBeDefined();
    expect(day2.query.join(' ')).toContain('aw-watcher-window_a');
    expect(day2.query.join(' ')).not.toContain('aw-watcher-window_b');
  });
});
