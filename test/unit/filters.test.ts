import { iso8601, shortdate, shorttime, friendlyduration } from '~/util/filters';

// Vue 3 has no global filters; these are exported and exposed as template helpers.
describe('duration/date template helpers', () => {
  test('iso8601 formats a timestamp', () => {
    expect(iso8601('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
  });

  test('shortdate and shorttime', () => {
    expect(shortdate('2024-06-15T12:34:00')).toBe('2024-06-15');
    expect(shorttime('2024-06-15T12:34:00')).toBe('12:34');
  });

  test('friendlyduration uses the shipped seconds_to_duration helper', () => {
    expect(friendlyduration(65)).toBe('1m 5s');
  });
});
