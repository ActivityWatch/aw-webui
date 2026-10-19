import { execFileSync } from 'child_process';
import path from 'path';
import { ms2L } from '~/visualizations/timespiral/time';
import { toDay } from '~/visualizations/timespiral/days';

// Node reads TZ once at startup and CI runs without one (UTC, no DST), so replay
// this file in a child Jest under a zone with DST (see timeperiodDst.test.node.ts).
const REPO_ROOT = path.resolve(__dirname, '../..');
const ZONE = 'Europe/Stockholm';

if (!process.env.AW_DST_ZONE) {
  test(`timespiral DST cases replay under TZ=${ZONE}`, () => {
    const run = () =>
      execFileSync(
        process.execPath,
        [
          require.resolve('jest/bin/jest'),
          '--selectProjects',
          'node',
          '--runInBand',
          '--coverage=false',
          '--runTestsByPath',
          __filename,
        ],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, TZ: ZONE, AW_DST_ZONE: ZONE },
          stdio: 'pipe',
          timeout: 90000,
        }
      );
    expect(run).not.toThrow();
  }, 95000);
}

const describeZone = process.env.AW_DST_ZONE === ZONE ? describe : describe.skip;

describeZone('timespiral across DST changes', () => {
  const HOUR = 1 / 24;
  const dayOf = (iso: string) => {
    const d = Math.floor(ms2L(Date.parse(iso)));
    return (events: { timestamp: string; duration: number }[]) =>
      toDay(
        d,
        d,
        d + 1,
        events.map(e => ({ ...e, data: { $category: ['Work'] } }))
      );
  };

  it('counts elapsed time when clocks go forward', () => {
    // 01:30 to 03:30 on the clock, but one real hour.
    const day = dayOf('2026-03-29T00:30:00Z')([
      { timestamp: '2026-03-29T00:30:00Z', duration: 3600 },
    ]);
    expect(day.totals.get('Work')).toBeCloseTo(HOUR, 9);
    expect(day.segs[0].e - day.segs[0].s).toBeCloseTo(2 * HOUR, 9);
  });

  it('keeps events in the repeated hour when clocks go back', () => {
    // 02:30 (CEST) to 02:30 (CET): the clock ends where it started.
    const day = dayOf('2026-10-25T00:30:00Z')([
      { timestamp: '2026-10-25T00:30:00Z', duration: 3600 },
      { timestamp: '2026-10-25T01:30:00Z', duration: 1800 },
    ]);
    expect(day.segs).toHaveLength(2);
    expect(day.totals.get('Work')).toBeCloseTo(1.5 * HOUR, 9);
  });
});
