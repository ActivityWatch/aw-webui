import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { hasFetchedHistory, useActivityStore } from '~/stores/activity';
import { timeperiodToStr } from '~/util/timeperiod';

describe('active history placeholders', () => {
  const timeperiod = { start: moment('2026-09-29'), length: [1, 'day'] } as any;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('a history of only unfetched periods is not treated as fetched', () => {
    const store = useActivityStore();
    const periods = store.getActiveHistoryAroundTimeperiod(timeperiod);
    expect(periods.length).toBeGreaterThan(0);
    expect(hasFetchedHistory(periods)).toBe(false);
  });

  test('one fetched period counts, even with no activity in it', () => {
    const store = useActivityStore();
    const [unfetched] = store.getActiveHistoryAroundTimeperiod(timeperiod);
    // An unfetched period next to a fetched one without any events
    expect(hasFetchedHistory([unfetched, { period: unfetched.period, events: [] }])).toBe(true);
  });

  test('a fetched period is no longer a placeholder', () => {
    const store = useActivityStore();
    const [first] = store.getActiveHistoryAroundTimeperiod(timeperiod);
    store.active.history[timeperiodToStr(first.period)] = [];
    expect(hasFetchedHistory(store.getActiveHistoryAroundTimeperiod(timeperiod))).toBe(true);
  });
});
