import { parseThresholds } from '~/util/aw-notify';

describe('parseThresholds', () => {
  test('parses comma-separated positive whole minutes', () => {
    expect(parseThresholds('15, 30, 60')).toEqual([15, 30, 60]);
  });

  test.each(['', '60.5', '60, abc', '60, -5', '60, 0', '60,'])(
    'rejects invalid threshold input %p',
    input => {
      expect(parseThresholds(input)).toBeNull();
    }
  );
});
