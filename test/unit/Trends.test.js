import moment from 'moment';
import Trends from '~/views/Trends.vue';

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
