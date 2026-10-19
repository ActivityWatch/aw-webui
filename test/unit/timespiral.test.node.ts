import { ms2L, L2ms, fmtDur, activityDay } from '~/visualizations/timespiral/time';
import {
  View,
  BAND,
  point,
  hitTest,
  radius,
  dayTransform,
  dayBand,
} from '~/visualizations/timespiral/geometry';
import { toDay, findAt, DayLoader, BRIDGE } from '~/visualizations/timespiral/days';

const view = (F: number, rho = 0, q = 1.2): View => ({ cx: 400, cy: 300, R: 200, q, F, rho });

const ev = (L: number, minutes: number, cat: string[], app = 'app', title = '') => ({
  timestamp: new Date(L2ms(L)).toISOString(),
  duration: minutes * 60,
  data: { $category: cat, app, title },
});

describe('time', () => {
  it('round-trips between ms and local days', () => {
    const ms = Date.parse('2026-03-14T15:09:26Z');
    expect(L2ms(ms2L(ms))).toBeCloseTo(ms, 0);
  });

  it('puts local midnight on an integer', () => {
    const midnight = new Date(2026, 5, 1).getTime();
    expect(ms2L(midnight) % 1).toBeCloseTo(0, 9);
  });

  it('finds the activity day with a start-of-day offset', () => {
    const offset = 4 / 24;
    expect(activityDay(100 + 3 / 24, offset)).toBe(99);
    expect(activityDay(100 + 5 / 24, offset)).toBe(100);
  });

  it('formats durations', () => {
    expect(fmtDur(42 / 1440)).toBe('42m');
    expect(fmtDur(185 / 1440)).toBe('3h 05m');
  });
});

describe('geometry', () => {
  it('puts the focused time at radius R, at the top when rotated with time', () => {
    const F = 20000.3;
    const [x, y] = point(view(F, F - Math.floor(F)), F);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeCloseTo(100, 6);
  });

  it('puts midnight at the top for a fixed clock', () => {
    const [x, y] = point(view(20000.3), 20000);
    expect(x).toBeCloseTo(400, 6);
    expect(y).toBeLessThan(300);
  });

  it('grows by q per turn', () => {
    const v = view(20000.5);
    expect(radius(v, 20000.5) / radius(v, 19999.5)).toBeCloseTo(1.2, 9);
  });

  it('hitTest inverts point', () => {
    const v = view(20000.7, 0.2, 1.15);
    for (const [L, k] of [
      [20000.7, 0],
      [20000.25, 0.2],
      [19998.9, -0.3],
      [19995.01, 0.1],
    ]) {
      const [x, y] = point(v, L, k);
      const h = hitTest(v, x, y) as { L: number; k: number };
      expect(h.L).toBeCloseTo(L, 9);
      expect(h.k).toBeCloseTo(k, 9);
    }
  });

  it('dayTransform maps day-local shapes onto the screen', () => {
    const v = view(20000.4, 0.4);
    const d = 19999;
    const [a, b, c, dd, e, f] = dayTransform(v, d);
    // Outer edge of the band at 06:00 on day d.
    const pts = dayBand(v.q, 0.25, 0.25, -BAND, BAND);
    const [lx, ly] = [pts[0], pts[1]];
    const [x, y] = point(v, d + 0.25, BAND);
    expect(a * lx + c * ly + e).toBeCloseTo(x, 6);
    expect(b * lx + dd * ly + f).toBeCloseTo(y, 6);
  });
});

describe('days', () => {
  const d = 20000;

  it('categorizes, clips to the day and merges runs', () => {
    const day = toDay(d, d, d + 1, [
      ev(d - 0.01, 30, ['Work', 'Programming']), // starts the day before
      ev(d + 0.5, 10, ['Work', 'Programming'], 'code'),
      ev(d + 0.5 + 10 / 1440 + BRIDGE / 2, 10, ['Work', 'Programming'], 'code'), // bridged
      ev(d + 0.6, 20, ['Media']),
      ev(d + 0.7, 0, ['Media']), // empty
    ]);
    expect(day.segs).toHaveLength(4);
    expect(day.segs[0].s).toBe(d);
    expect(day.runs.map(r => r.key)).toEqual(['Work > Programming', 'Work > Programming', 'Media']);
    expect(day.runs[1].e - day.runs[1].s).toBeCloseTo(20 / 1440 + BRIDGE / 2, 9);
    // Totals count actual event time, not the bridged gaps.
    const clipped = 30 / 1440 - 0.01;
    expect(day.totals.get('Work')).toBeCloseTo(clipped + 20 / 1440, 9);
    expect(day.totals.get('Media')).toBeCloseTo(20 / 1440, 9);
  });

  it('defaults to Uncategorized', () => {
    const day = toDay(d, d, d + 1, [
      { timestamp: new Date(L2ms(d + 0.5)).toISOString(), duration: 60, data: {} },
    ]);
    expect(day.runs[0].cat).toEqual(['Uncategorized']);
  });

  it('finds the run and nearest event under a time', () => {
    const day = toDay(d, d, d + 1, [
      ev(d + 0.5, 10, ['Work'], 'a'),
      ev(d + 0.5 + 10.5 / 1440, 10, ['Work'], 'b'),
      ev(d + 0.6, 10, ['Media'], 'c'),
    ]);
    const appAt = (L: number) => findAt(day, L)?.seg?.app;
    expect(appAt(d + 0.5 + 5 / 1440)).toBe('a');
    expect(appAt(d + 0.5 + 15 / 1440)).toBe('b');
    // In the bridged gap: the run, and the closer event.
    expect(findAt(day, d + 0.5 + 10.2 / 1440)?.run.key).toBe('Work');
    expect(appAt(d + 0.5 + 10.2 / 1440)).toBe('a');
    expect(appAt(d + 0.6 + 1 / 1440)).toBe('c');
    expect(findAt(day, d + 0.3)).toBeNull();
  });
});

describe('DayLoader', () => {
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  it('loads wanted days in batches, in order, and skips days before the first', async () => {
    const calls: [number, number][][] = [];
    const loader = new DayLoader(
      async periods => {
        calls.push(periods);
        return periods.map(() => []);
      },
      { offset: 0.25, first: 10, batch: 2, concurrency: 1 }
    );
    loader.want([12, 11, 13, 9]);
    await flush();
    await flush();
    expect(calls).toEqual([
      [
        [12.25, 13.25],
        [11.25, 12.25],
      ],
      [[13.25, 14.25]],
    ]);
    expect([...loader.days.keys()].sort()).toEqual([11, 12, 13]);
    // Past days are not fetched again.
    loader.want([12]);
    await flush();
    expect(calls).toHaveLength(2);
  });

  it('refetches a day that had not ended when it was loaded', () => {
    const loader = new DayLoader(async () => [], { offset: 0, first: 0, maxAge: 1000 });
    const today = Math.floor(ms2L(Date.now()));
    const now = Date.now();
    const day = toDay(today, today, today + 1, []);
    day.loadedAt = now - 5000;
    expect(loader.fresh(day, now)).toBe(false);
    day.loadedAt = now - 500;
    expect(loader.fresh(day, now)).toBe(true);
    const past = toDay(today - 2, today - 2, today - 1, []);
    past.loadedAt = L2ms(today - 1) + 1000; // loaded after it ended
    expect(loader.fresh(past, now)).toBe(true);
  });

  it('dates freshness from the request, not the reply', async () => {
    let resolve: (v: never[][]) => void = () => undefined;
    const loader = new DayLoader(() => new Promise(r => (resolve = r)), { offset: 0, first: 0 });
    const t0 = Date.now();
    loader.want([7]);
    await new Promise(r => setTimeout(r, 20));
    resolve([[]]);
    await flush();
    const day = loader.days.get(7);
    expect(day && day.loadedAt).toBeLessThanOrEqual(t0 + 10);
  });

  it('retries failed days after a while', async () => {
    let failing = true;
    const loader = new DayLoader(
      async periods => {
        if (failing) throw new Error('nope');
        return periods.map(() => []);
      },
      { offset: 0, first: 0, retryAfter: 0, onError: () => undefined }
    );
    loader.want([5]);
    await flush();
    expect(loader.failed.has(5)).toBe(true);
    failing = false;
    loader.want([5]);
    await flush();
    expect(loader.days.has(5)).toBe(true);
    expect(loader.failed.has(5)).toBe(false);
  });
});
