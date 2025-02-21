import { seconds_to_duration } from '~/util/time';

describe('seconds_to_duration', () => {
  test('should format 8145 seconds as "2h 15m 45s"', () => {
    expect(seconds_to_duration(8145)).toBe('2h 15m 45s');
  });

  test('should format 3630 seconds as "1h 0m 30s"', () => {
    expect(seconds_to_duration(3630)).toBe('1h 0m 30s');
  });

  test('should format 3600 seconds as "1h 0m 0s"', () => {
    expect(seconds_to_duration(3630)).toBe('1h 0m 0s');
  });

  test('should format 1830 seconds as "30m 30s"', () => {
    expect(seconds_to_duration(1830)).toBe('30m 30s');
  });

  test('should format 60 seconds as "1m 0s"', () => {
    expect(seconds_to_duration(60)).toBe('1m 0s');
  });

  test('should format 30 seconds as "30s"', () => {
    expect(seconds_to_duration(30)).toBe('30s');
  });
});
