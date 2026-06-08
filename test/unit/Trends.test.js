import Trends from '~/views/Trends.vue';

describe('Trends view', () => {
  describe('host computed', () => {
    test('returns the :host route param when present', () => {
      const vm = {
        $route: { params: { host: 'laptop' } },
        bucketsStore: { hosts: ['desktop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('laptop');
    });

    test('falls back to the first available host when no :host param', () => {
      // Regression: navigating to /trends without :host used to throw
      // "TypeError: can't access property endsWith, bid is undefined"
      // because the route param was undefined and queries got built with
      // bid_window=undefined.
      const vm = {
        $route: { params: {} },
        bucketsStore: { hosts: ['desktop', 'laptop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('desktop');
    });

    test('returns undefined when there are no hosts at all', () => {
      const vm = {
        $route: { params: {} },
        bucketsStore: { hosts: [] },
      };
      expect(Trends.computed.host.call(vm)).toBeUndefined();
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
