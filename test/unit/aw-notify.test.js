import { parseAwNotifyConfig, parseThresholds } from '~/util/aw-notify';

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

describe('parseAwNotifyConfig', () => {
  const canonicalAlert = {
    category: 'Work',
    label: '💼 Work',
    thresholds_minutes: [60, 120, 240],
    positive: true,
  };

  test('accepts the full aw-notify-rs config shape', () => {
    const config = {
      alerts: [canonicalAlert],
      hourly_checkins: true,
      new_day_greetings: false,
      server_monitoring: true,
      productivity_score: true,
      http_port: 0,
    };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('preserves an explicitly empty alert list', () => {
    expect(parseAwNotifyConfig({ alerts: [] })).toEqual({ alerts: [] });
  });

  test('migrates the original Android array shape', () => {
    expect(
      parseAwNotifyConfig([
        { category: null, label: 'All', thresholdMinutes: [60, 240], positive: false },
      ])
    ).toEqual({
      alerts: [{ category: 'All', label: 'All', thresholds_minutes: [60, 240], positive: false }],
    });
  });

  test.each([
    null,
    [],
    { alerts: 'bad' },
    { alerts: [{ ...canonicalAlert, category: null }] },
    { alerts: [{ ...canonicalAlert, thresholds_minutes: [] }] },
    { alerts: [{ ...canonicalAlert, thresholds_minutes: [0] }] },
    { alerts: [canonicalAlert], hourly_checkins: 'yes' },
    { alerts: [canonicalAlert], http_port: 70000 },
  ])('rejects unsupported config %p', config => {
    expect(parseAwNotifyConfig(config)).toBeNull();
  });
});
