import {
  AW_NOTIFY_STALE_AFTER_MS,
  awNotifyLiveness,
  parseAwNotifyConfig,
  parseThresholds,
} from '~/util/aw-notify';

describe('parseThresholds', () => {
  test('parses comma-separated positive whole minutes', () => {
    expect(parseThresholds('15, 30, 60')).toEqual([15, 30, 60]);
  });

  test('accepts the Arabic comma separator', () => {
    expect(parseThresholds('60، 120، 240')).toEqual([60, 120, 240]);
  });

  test.each(['', '60.5', '60, abc', '60, -5', '60, 0', '60,', '60،'])(
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

  test('accepts enabled: true', () => {
    const config = { enabled: true, alerts: [canonicalAlert] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('accepts enabled: false', () => {
    const config = { enabled: false, alerts: [] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('accepts missing enabled (undefined)', () => {
    const config = { alerts: [] };
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

  test('migrates an empty original Android array', () => {
    expect(parseAwNotifyConfig([])).toEqual({ alerts: [] });
  });

  test.each([
    null,
    { alerts: 'bad' },
    { alerts: [{ ...canonicalAlert, category: null }] },
    { alerts: [{ ...canonicalAlert, thresholds_minutes: [] }] },
    { alerts: [{ ...canonicalAlert, thresholds_minutes: [0] }] },
    { alerts: [canonicalAlert], hourly_checkins: 'yes' },
    { alerts: [canonicalAlert], http_port: 70000 },
    { alerts: [canonicalAlert], enabled: 'yes' },
  ])('rejects unsupported config %p', config => {
    expect(parseAwNotifyConfig(config)).toBeNull();
  });
});

describe('awNotifyLiveness', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const endingAgo = (ms: number, duration = 5) => ({
    timestamp: new Date(now.getTime() - ms - duration * 1000).toISOString(),
    duration,
  });

  test('never when there is no heartbeat bucket or event', () => {
    expect(awNotifyLiveness([], now)).toBe('never');
    expect(awNotifyLiveness([null], now)).toBe('never');
  });

  test('running when the latest heartbeat ended within the stale window', () => {
    expect(awNotifyLiveness([endingAgo(2_000)], now)).toBe('running');
    expect(awNotifyLiveness([endingAgo(AW_NOTIFY_STALE_AFTER_MS)], now)).toBe('running');
  });

  test('counts the merged event duration, not just its start', () => {
    // A long merged run started an hour ago but its last pulse was 3 s ago.
    expect(awNotifyLiveness([endingAgo(3_000, 3600)], now)).toBe('running');
  });

  test('stopped when every heartbeat is older than the stale window', () => {
    expect(awNotifyLiveness([endingAgo(AW_NOTIFY_STALE_AFTER_MS + 1)], now)).toBe('stopped');
    expect(awNotifyLiveness([endingAgo(3_600_000), null], now)).toBe('stopped');
  });

  test('running if any host bucket is fresh', () => {
    expect(awNotifyLiveness([endingAgo(3_600_000), endingAgo(1_000)], now)).toBe('running');
  });

  test('a heartbeat ending slightly in the future (clock skew) counts as running', () => {
    expect(awNotifyLiveness([endingAgo(-5_000)], now)).toBe('running');
  });
});
