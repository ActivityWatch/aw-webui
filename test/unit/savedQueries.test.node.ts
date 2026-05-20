import moment from 'moment';

import {
  buildSavedQuery,
  buildSavedQueryId,
  getDefaultSavedQueryName,
  resolveSavedQueryDates,
  sortSavedQueries,
} from '~/util/savedQueries';

describe('saved query helpers', () => {
  test('rebuilds relative dates from saved offsets', () => {
    const savedQuery = buildSavedQuery({
      id: 'daily-coding-time',
      name: 'Daily Coding Time',
      query_code: 'RETURN = [];',
      startdate: '2026-05-20',
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      now: moment('2026-05-20T15:45:00Z'),
    });

    expect(savedQuery.start_offset).toBe(0);
    expect(savedQuery.end_offset).toBe(-24);

    expect(resolveSavedQueryDates(savedQuery, moment('2026-05-27T08:00:00Z'))).toEqual({
      startdate: '2026-05-27',
      enddate: '2026-05-28',
    });
  });

  test('slugifies and de-duplicates saved query ids', () => {
    expect(buildSavedQueryId('Daily Coding Time', ['daily-coding-time'])).toBe(
      'daily-coding-time-2'
    );
    expect(buildSavedQueryId('!!!', [])).toBe('saved-query');
  });

  test('derives a default name from the first non-empty query line', () => {
    expect(
      getDefaultSavedQueryName('\n  merged_events = merge_events();\nRETURN = merged_events;')
    ).toBe('merged_events = merge_events();');
    expect(getDefaultSavedQueryName('   \n  ', moment('2026-05-20T00:00:00Z'))).toBe(
      'Query 2026-05-20'
    );
  });

  test('sorts saved queries by name and then id', () => {
    expect(
      sortSavedQueries([
        { id: 'b', name: 'Work', query_code: '' },
        { id: 'a', name: 'Work', query_code: '' },
        { id: 'c', name: 'Browser', query_code: '' },
      ]).map(query => query.id)
    ).toEqual(['c', 'a', 'b']);
  });
});
