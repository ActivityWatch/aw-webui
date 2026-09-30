import Vue from 'vue';
import '~/util/filters';

describe('vue duration/date filters', () => {
  test('registers iso8601 and formats a timestamp', () => {
    const iso8601 = Vue.filter('iso8601');
    expect(iso8601('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
  });

  test('registers shortdate and shorttime', () => {
    expect(Vue.filter('shortdate')('2024-06-15T12:34:00')).toBe('2024-06-15');
    expect(Vue.filter('shorttime')('2024-06-15T12:34:00')).toBe('12:34');
  });

  test('registers friendlyduration using the shipped seconds_to_duration helper', () => {
    expect(Vue.filter('friendlyduration')(65)).toBe('1m 5s');
  });
});
