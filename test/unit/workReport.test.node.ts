import {
  buildWorkReportQuery,
  getSupportedWorkReportHosts,
  getUnsupportedWorkReportHosts,
  getWorkReportHostOptions,
  summarizeWorkSessions,
} from '~/util/workReport';

const buckets = [
  {
    id: 'aw-watcher-window_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'currentwindow',
    data: {},
  },
  {
    id: 'aw-watcher-afk_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'afkstatus',
    data: {},
  },
  {
    id: 'aw-watcher-window_phone',
    hostname: 'phone',
    device_id: 'phone',
    type: 'currentwindow',
    data: {},
  },
];

describe('workReport host helpers', () => {
  test('getWorkReportHostOptions disables hosts without AFK buckets', () => {
    expect(getWorkReportHostOptions(buckets as any)).toEqual([
      { value: 'laptop', text: 'laptop', disabled: false },
      { value: 'phone', text: 'phone (requires aw-watcher-afk)', disabled: true },
    ]);
  });

  test('getUnsupportedWorkReportHosts returns selected hosts missing AFK buckets', () => {
    expect(getUnsupportedWorkReportHosts(['laptop', 'phone'], buckets as any)).toEqual(['phone']);
  });

  test('getSupportedWorkReportHosts returns only hosts with AFK buckets', () => {
    expect(getSupportedWorkReportHosts(['laptop', 'phone'], buckets as any)).toEqual(['laptop']);
  });

  test('buildWorkReportQuery uses single-arg flood() for both window and afk buckets', () => {
    // Regression: aw-query's flood() takes one argument. A previous version
    // passed breakTimeSeconds as a second argument, which made aw-server
    // respond with HTTP 400 "Tried to call function flood with invalid amount
    // of arguments" and broke the whole report.
    const query = buildWorkReportQuery(['laptop'], '[]', []);
    expect(query).toContain('events_0 = flood(query_bucket("aw-watcher-window_laptop"));');
    expect(query).toContain('not_afk_0 = flood(query_bucket("aw-watcher-afk_laptop"));');
    // Must NOT contain flood() with two arguments
    expect(query).not.toMatch(/flood\([^)]+,[^)]+\)/);
  });

  test('buildWorkReportQuery produces a snapshot-stable query for multiple hosts', () => {
    const query = buildWorkReportQuery(['laptop', 'desktop'], '[]', [['Work']]);
    expect(query).toMatchSnapshot();
  });

  test('getSupportedWorkReportHosts preserves selected host order', () => {
    const moreBuckets = [
      ...buckets,
      {
        id: 'aw-watcher-window_desktop',
        hostname: 'desktop',
        device_id: 'desktop',
        type: 'currentwindow',
        data: {},
      },
      {
        id: 'aw-watcher-afk_desktop',
        hostname: 'desktop',
        device_id: 'desktop',
        type: 'afkstatus',
        data: {},
      },
    ];

    expect(getSupportedWorkReportHosts(['desktop', 'phone', 'laptop'], moreBuckets as any)).toEqual(
      ['desktop', 'laptop']
    );
  });
});

describe('summarizeWorkSessions', () => {
  const ev = (time: string, duration: number) => ({
    timestamp: `2026-10-02T${time}:00Z`,
    duration,
  });
  const fiveMinutes = 5 * 60;

  it('returns no sessions for no events', () => {
    expect(summarizeWorkSessions([], fiveMinutes)).toEqual({ bridgedSeconds: 0, sessions: 0 });
  });

  it('merges events separated by short gaps into one session', () => {
    // 09:00-09:10, 09:12-09:20, 09:23-09:30: gaps of 2 and 3 minutes
    const events = [ev('09:00', 600), ev('09:12', 480), ev('09:23', 420)];
    expect(summarizeWorkSessions(events, fiveMinutes)).toEqual({
      bridgedSeconds: 300,
      sessions: 1,
    });
  });

  it('starts a new session after a gap longer than the break time', () => {
    // 09:00-09:10, then a 20 minute break, then 09:30-09:40 and 09:41-09:45
    const events = [ev('09:41', 240), ev('09:00', 600), ev('09:30', 600)];
    expect(summarizeWorkSessions(events, fiveMinutes)).toEqual({
      bridgedSeconds: 60,
      sessions: 2,
    });
  });

  it('measures gaps from the latest end so far for nested events', () => {
    // 09:00-10:00 contains 09:10-09:11; 10:02 follows the outer event after 2 minutes
    const events = [ev('09:00', 3600), ev('09:10', 60), ev('10:02', 60)];
    expect(summarizeWorkSessions(events, fiveMinutes)).toEqual({
      bridgedSeconds: 120,
      sessions: 1,
    });
  });

  it('treats every gap as a break when the break time is zero', () => {
    const events = [ev('09:00', 60), ev('09:02', 60)];
    expect(summarizeWorkSessions(events, 0)).toEqual({ bridgedSeconds: 0, sessions: 2 });
  });
});
