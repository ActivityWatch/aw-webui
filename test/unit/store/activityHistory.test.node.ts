import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { hasFetchedHistory, useActivityStore } from '~/stores/activity';

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
    const [placeholders] = store.getActiveHistoryAroundTimeperiod(timeperiod);
    // An unfetched period next to a fetched one without any events
    expect(hasFetchedHistory([placeholders, []])).toBe(true);
  });
});
