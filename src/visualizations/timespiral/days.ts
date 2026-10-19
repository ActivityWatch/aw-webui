// Data for the timespiral: categorized events per activity day, and a loader
// that fetches the days around the focus first.
import { ms2L, L2ms } from './time';

const DAY_MS = 86_400_000;

export const SEP = ' > ';
/** Gaps shorter than this (in days) between events of the same category are bridged when drawing. */
export const BRIDGE = 60 / 86400;

export interface Seg {
  s: number; // start (local days)
  e: number; // end (local days)
  dur: number; // elapsed time, in days (differs from e - s across DST changes)
  key: string; // full category path joined with SEP
  top: string; // top-level category
  app: string;
  title: string;
}

/** A contiguous stretch of one category, as drawn. */
export interface Run {
  s: number;
  e: number;
  key: string;
  top: string;
  cat: string[];
}

export interface Day {
  d: number;
  segs: Seg[];
  runs: Run[];
  /** Active time per top-level category, in days. */
  totals: Map<string, number>;
  /** When the request for this data was made (ms). */
  loadedAt: number;
}

interface QueryEvent {
  timestamp: string;
  duration: number;
  data: { $category?: string[]; app?: string; title?: string; url?: string };
}

/** Builds a day from the events of its period [start, end) (local days). */
export function toDay(
  d: number,
  start: number,
  end: number,
  events: QueryEvent[],
  loadedAt = Date.now()
): Day {
  const startMs = L2ms(start);
  const endMs = L2ms(end);
  const segs: Seg[] = [];
  for (const ev of events) {
    if (!(ev.duration > 0)) continue;
    const t0 = Math.max(startMs, Date.parse(ev.timestamp));
    const t1 = Math.min(endMs, Date.parse(ev.timestamp) + ev.duration * 1000);
    if (t1 <= t0) continue;
    const cat = ev.data.$category || ['Uncategorized'];
    const s = ms2L(t0);
    segs.push({
      s,
      // When clocks go back, local time can run backwards during an event.
      e: Math.max(s, ms2L(t1)),
      dur: (t1 - t0) / DAY_MS,
      key: cat.join(SEP),
      top: cat[0],
      app: ev.data.app || '',
      title: ev.data.title || ev.data.url || '',
    });
  }
  segs.sort((a, b) => a.s - b.s);

  const runs: Run[] = [];
  const totals = new Map<string, number>();
  for (const sg of segs) {
    totals.set(sg.top, (totals.get(sg.top) || 0) + sg.dur);
    const last = runs[runs.length - 1];
    // Events don't overlap in time, but can on the local clock when it goes back (DST).
    const s = last ? Math.max(sg.s, last.e) : sg.s;
    if (sg.e <= s) continue;
    if (last && last.key === sg.key && s - last.e < BRIDGE) {
      last.e = sg.e;
    } else {
      runs.push({ s, e: sg.e, key: sg.key, top: sg.top, cat: sg.key.split(SEP) });
    }
  }
  return { d, segs, runs, totals, loadedAt };
}

/** The run at time L, and the event in it closest to L (gaps within a run are bridged). */
export function findAt(day: Day, L: number): { run: Run; seg?: Seg } | null {
  const runs = day.runs;
  let lo = 0;
  let hi = runs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (runs[mid].e <= L) lo = mid + 1;
    else if (runs[mid].s > L) hi = mid - 1;
    else {
      const run = runs[mid];
      let seg: Seg | undefined;
      let best = Infinity;
      for (const sg of day.segs) {
        if (sg.e < run.s || sg.s > run.e || sg.key !== run.key) continue;
        const dist = L < sg.s ? sg.s - L : L > sg.e ? L - sg.e : 0;
        if (dist < best) {
          best = dist;
          seg = sg;
        }
      }
      return { run, seg };
    }
  }
  return null;
}

/** Fetches the query results (lists of events) for each of the given periods (local days). */
export type FetchPeriods = (periods: [number, number][]) => Promise<QueryEvent[][]>;

export interface LoaderOptions {
  /** Start of day, in days (04:00 = 1/6). */
  offset: number;
  /** First day to load (days before have no data). */
  first: number;
  /** Days per request. */
  batch?: number;
  /** Concurrent requests. */
  concurrency?: number;
  /** How long (ms) the data of a day that hasn't ended yet is reused. */
  maxAge?: number;
  /** How long (ms) to wait before retrying a day that failed to load. */
  retryAfter?: number;
  onLoad?: (d: number) => void;
  onError?: (err: unknown) => void;
}

/** Loads days on demand, most wanted first. */
export class DayLoader {
  days = new Map<number, Day>();
  pending = new Set<number>();
  /** Days whose request failed, and when (retried after a while). */
  failed = new Map<number, number>();
  private queue: number[] = [];
  private active = 0;
  private stopped = false;

  constructor(private fetchPeriods: FetchPeriods, private opts: LoaderOptions) {}

  period(d: number): [number, number] {
    return [d + this.opts.offset, d + 1 + this.opts.offset];
  }

  /** True when the data for day d can be used as is. */
  fresh(day: Day, now = Date.now()): boolean {
    const ended = day.loadedAt >= L2ms(this.period(day.d)[1]);
    return ended || now - day.loadedAt < (this.opts.maxAge ?? 60_000);
  }

  /** Request days, most important first. Replaces earlier requests that haven't started. */
  want(wanted: number[]): void {
    const now = Date.now();
    const need = wanted.filter(d => {
      if (d < this.opts.first || this.pending.has(d)) return false;
      const failedAt = this.failed.get(d);
      if (failedAt !== undefined && now - failedAt < (this.opts.retryAfter ?? 10_000)) return false;
      const day = this.days.get(d);
      return !day || !this.fresh(day, now);
    });
    this.queue = need;
    this.pump();
  }

  stop(): void {
    this.stopped = true;
    this.queue = [];
  }

  private pump(): void {
    const batchSize = this.opts.batch ?? 4;
    while (!this.stopped && this.active < (this.opts.concurrency ?? 2) && this.queue.length) {
      const batch = this.queue.splice(0, batchSize);
      batch.forEach(d => this.pending.add(d));
      this.active++;
      // Freshness counts from the request, not the reply: data requested before
      // a day ended may be incomplete even if the reply arrives after.
      const requestedAt = Date.now();
      this.fetchPeriods(batch.map(d => this.period(d)))
        .then(results => {
          if (this.stopped) return;
          batch.forEach((d, i) => {
            const [start, end] = this.period(d);
            this.days.set(d, toDay(d, start, end, results[i] || [], requestedAt));
            this.failed.delete(d);
            this.opts.onLoad?.(d);
          });
        })
        .catch(err => {
          if (this.stopped) return;
          const at = Date.now();
          batch.forEach(d => this.failed.set(d, at));
          this.opts.onError?.(err);
        })
        .finally(() => {
          batch.forEach(d => this.pending.delete(d));
          this.active--;
          this.pump();
        });
    }
  }
}
