/**
 * Provider-independent activity context for single-pass LLM analysis.
 *
 * Builds a compact, bounded summary from AFK-filtered and categorized events so a
 * model with no ActivityWatch tools can answer useful questions without receiving
 * raw personal event data.
 *
 * ## Privacy
 *
 * All statistics are derived locally; only the derived shape below leaves the device.
 *
 * Fields that MAY contain sensitive information:
 * - `apps[].app`            — application names (e.g. a therapy or banking app)
 * - `domains[].domain`      — browser domains (host only, never the full URL)
 * - `categories[].category` — the user's own category names
 *
 * Fields that never leave the device: window titles, full URLs, event timestamps.
 * Titles are reduced to a per-app distinct count (`apps[].titleCount`).
 *
 * Two opt-in filters narrow what is exported (see {@link PrivacyOptions}):
 * - `excludeUncategorized` — drop activity that matched no category rule
 * - `excludePrivateCategories` — drop categories the user marked `data.private`
 *
 * Both report their effect in {@link ActivityContext.privacy} so the user can see
 * exactly how much activity was withheld before generating.
 */

/** A single AFK-filtered, categorized window event. */
export interface ContextEvent {
  timestamp: string;
  duration: number; // seconds
  data: {
    app?: string;
    title?: string;
    $category?: string[];
    [key: string]: unknown;
  };
}

/** A browser event merged by domain (`$domain`), as returned by the query layer. */
export interface DomainEvent {
  duration: number; // seconds
  data: {
    $domain?: string;
    [key: string]: unknown;
  };
}

/** A category the user marked as private/sensitive. */
export type CategoryName = string[];

export interface PrivacyOptions {
  /** Drop activity that matched no category rule. */
  excludeUncategorized: boolean;
  /** Drop activity in these categories (and their sub-categories). */
  privateCategories: CategoryName[];
}

export interface BuildContextInput {
  events: ContextEvent[];
  domainEvents?: DomainEvent[];
  /** Total time the window watcher recorded, before AFK filtering. */
  trackedSeconds: number;
  start: Date;
  end: Date;
  hosts: string[];
  timezone: string;
  privacy: PrivacyOptions;
  limits?: Partial<ContextLimits>;
}

export interface ContextLimits {
  apps: number;
  domains: number;
  categories: number;
}

export const DEFAULT_LIMITS: ContextLimits = { apps: 15, domains: 10, categories: 15 };

export interface AppStat {
  app: string;
  duration: number;
  /** Share of exported active time, 0-1. */
  share: number;
  /** Number of distinct window titles seen. The titles themselves are not exported. */
  titleCount: number;
}

export interface DomainStat {
  domain: string;
  duration: number;
  share: number;
}

export interface CategoryStat {
  /** Full category path, e.g. `['Work', 'Programming']`. */
  category: string[];
  duration: number;
  share: number;
}

export interface DayStat {
  /** ISO date (YYYY-MM-DD) in the context timezone. */
  date: string;
  duration: number;
}

export interface FocusStats {
  /**
   * Number of transitions between different apps in the AFK-filtered timeline.
   * Consecutive events in the same app count as one block, not a switch.
   */
  appSwitches: number;
  /** Number of same-app blocks. */
  blockCount: number;
  /** Duration of the longest uninterrupted same-app block, in seconds. */
  longestBlockSeconds: number;
  /** Median block duration, in seconds. */
  medianBlockSeconds: number;
}

export interface TruncationNote {
  shown: number;
  total: number;
  /** Time in the entries that were dropped by the limit. */
  otherSeconds: number;
}

export interface PrivacyReport {
  excludeUncategorized: boolean;
  /** Categories excluded because the user marked them private. */
  excludedCategories: string[][];
  /** Active time withheld by the privacy filters, in seconds. */
  excludedSeconds: number;
  /** Share of active time that survived the filters, 0-1. */
  coverage: number;
}

export interface ActivityContext {
  range: {
    start: string;
    end: string;
    days: number;
    timezone: string;
  };
  hosts: string[];
  coverage: {
    /** Time recorded by the window watcher, before AFK filtering. */
    trackedSeconds: number;
    /** Time left after AFK filtering, before privacy filters. */
    activeSeconds: number;
    /** Time actually summarized below, after privacy filters. */
    exportedSeconds: number;
    /** activeSeconds / trackedSeconds, 0-1. `null` when nothing was tracked. */
    activeShare: number | null;
  };
  apps: AppStat[];
  domains: DomainStat[];
  categories: CategoryStat[];
  daily: DayStat[];
  focus: FocusStats;
  privacy: PrivacyReport;
  truncation: {
    apps: TruncationNote;
    domains: TruncationNote;
    categories: TruncationNote;
  };
}

export const UNCATEGORIZED = ['Uncategorized'];

function isUncategorized(category: string[] | undefined): boolean {
  if (!category || category.length === 0) return true;
  return category.length === UNCATEGORIZED.length && category[0] === UNCATEGORIZED[0];
}

/**
 * True when `category` is `parent` or a sub-category of it.
 * `['Work', 'Programming']` is under `['Work']`, but `['Workout']` is not.
 */
export function isUnderCategory(category: string[], parent: string[]): boolean {
  if (parent.length === 0 || category.length < parent.length) return false;
  return parent.every((segment, i) => category[i] === segment);
}

/**
 * Categories the user marked private via category metadata (`data.private === true`).
 *
 * Privacy is user-controlled metadata rather than a hard-coded list of names, so it
 * survives renames and works for categories we have never heard of.
 */
export function privateCategoriesFrom(
  classes: { name: string[]; data?: Record<string, any> }[]
): CategoryName[] {
  return classes.filter(c => c.data?.private === true).map(c => c.name);
}

function shouldExclude(category: string[] | undefined, privacy: PrivacyOptions): boolean {
  if (privacy.excludeUncategorized && isUncategorized(category)) return true;
  if (!category) return false;
  return privacy.privateCategories.some(p => isUnderCategory(category, p));
}

function share(duration: number, total: number): number {
  return total > 0 ? duration / total : 0;
}

/** Take the top `limit` entries and describe what the cut dropped. */
function truncate<T extends { duration: number }>(
  entries: T[],
  limit: number
): [T[], TruncationNote] {
  const shown = entries.slice(0, limit);
  const dropped = entries.slice(limit);
  return [
    shown,
    {
      shown: shown.length,
      total: entries.length,
      otherSeconds: dropped.reduce((sum, e) => sum + e.duration, 0),
    },
  ];
}

function dayKey(timestamp: string, timezone: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'unknown';
  try {
    // en-CA renders as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Find the UTC millisecond timestamp of the next local midnight after `fromMs`
 * in the given timezone, using a binary search over a ≤25h window.
 */
function nextMidnightAfter(fromMs: number, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  const currentDate = fmt.format(new Date(fromMs));
  let lo = fromMs;
  let hi = fromMs + 25 * 60 * 60 * 1000; // definitely the next day
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (fmt.format(new Date(mid)) === currentDate) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return hi;
}

/**
 * Accumulate an event's duration into `dayDurations`, splitting at local-midnight
 * boundaries so events that span midnight are correctly apportioned across days.
 */
function accumulateByDay(
  event: ContextEvent,
  timezone: string,
  dayDurations: Record<string, number>
): void {
  const duration = event.duration || 0;
  if (duration <= 0) return;
  const startMs = new Date(event.timestamp).getTime();
  if (isNaN(startMs)) {
    // Unparseable timestamp — fall back to assigning all to the start key.
    const key = dayKey(event.timestamp, timezone);
    dayDurations[key] = (dayDurations[key] || 0) + duration;
    return;
  }
  const endMs = startMs + duration * 1000;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  let cursor = startMs;
  while (cursor < endMs) {
    const dateStr = fmt.format(new Date(cursor));
    const midnight = nextMidnightAfter(cursor, timezone);
    const sliceEnd = Math.min(midnight, endMs);
    dayDurations[dateStr] = (dayDurations[dateStr] || 0) + (sliceEnd - cursor) / 1000;
    cursor = sliceEnd;
  }
}

/**
 * Focus statistics over the AFK-filtered timeline.
 *
 * Events are assumed to be sorted by timestamp. Consecutive events in the same app
 * are merged into one block, so `appSwitches` counts real context switches rather
 * than watcher heartbeats.
 */
export function computeFocusStats(events: ContextEvent[]): FocusStats {
  const blocks: number[] = [];
  let currentApp: string | null = null;
  let currentDuration = 0;

  for (const event of events) {
    const app = event.data?.app || 'unknown';
    if (app === currentApp) {
      currentDuration += event.duration || 0;
    } else {
      if (currentApp !== null) blocks.push(currentDuration);
      currentApp = app;
      currentDuration = event.duration || 0;
    }
  }
  if (currentApp !== null) blocks.push(currentDuration);

  const sorted = [...blocks].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;

  return {
    appSwitches: Math.max(0, blocks.length - 1),
    blockCount: blocks.length,
    longestBlockSeconds: blocks.length ? Math.max(...blocks) : 0,
    medianBlockSeconds: median,
  };
}

export function buildActivityContext(input: BuildContextInput): ActivityContext {
  const limits = { ...DEFAULT_LIMITS, ...(input.limits || {}) };
  const events = input.events || [];

  const activeSeconds = events.reduce((sum, e) => sum + (e.duration || 0), 0);

  const kept: ContextEvent[] = [];
  const excludedCategoryKeys = new Set<string>();
  let excludedSeconds = 0;
  for (const event of events) {
    const category = event.data?.$category;
    if (shouldExclude(category, input.privacy)) {
      excludedSeconds += event.duration || 0;
      excludedCategoryKeys.add(JSON.stringify(category ?? UNCATEGORIZED));
    } else {
      kept.push(event);
    }
  }
  const exportedSeconds = kept.reduce((sum, e) => sum + (e.duration || 0), 0);

  // Apps, with distinct-title counts (the titles themselves stay local).
  const appDurations: Record<string, number> = {};
  const appTitles: Record<string, Set<string>> = {};
  for (const event of kept) {
    const app = event.data?.app || 'unknown';
    appDurations[app] = (appDurations[app] || 0) + (event.duration || 0);
    if (!appTitles[app]) appTitles[app] = new Set();
    if (event.data?.title) appTitles[app].add(event.data.title);
  }
  const allApps: AppStat[] = Object.entries(appDurations)
    .map(([app, duration]) => ({
      app,
      duration,
      share: share(duration, exportedSeconds),
      titleCount: appTitles[app]?.size ?? 0,
    }))
    .sort((a, b) => b.duration - a.duration);

  // Categories.
  const categoryDurations: Record<string, number> = {};
  for (const event of kept) {
    const key = JSON.stringify(event.data?.$category ?? UNCATEGORIZED);
    categoryDurations[key] = (categoryDurations[key] || 0) + (event.duration || 0);
  }
  const allCategories: CategoryStat[] = Object.entries(categoryDurations)
    .map(([key, duration]) => ({
      category: JSON.parse(key) as string[],
      duration,
      share: share(duration, exportedSeconds),
    }))
    .sort((a, b) => b.duration - a.duration);

  // Domains. Browser events carry no category, so only the uncategorized filter
  // can apply — and it cannot, so domains are dropped entirely when either filter
  // is on rather than leaking activity the user asked to withhold.
  const privacyFilterActive =
    input.privacy.excludeUncategorized || input.privacy.privateCategories.length > 0;
  const domainDurations: Record<string, number> = {};
  if (!privacyFilterActive) {
    for (const event of input.domainEvents || []) {
      const domain = event.data?.$domain;
      if (!domain) continue;
      domainDurations[domain] = (domainDurations[domain] || 0) + (event.duration || 0);
    }
  }
  const domainTotal = Object.values(domainDurations).reduce((sum, d) => sum + d, 0);
  const allDomains: DomainStat[] = Object.entries(domainDurations)
    .map(([domain, duration]) => ({ domain, duration, share: share(duration, domainTotal) }))
    .sort((a, b) => b.duration - a.duration);

  // Daily distribution. Events that span local midnight are split so their
  // duration is correctly apportioned across both days.
  const dayDurations: Record<string, number> = {};
  for (const event of kept) {
    accumulateByDay(event, input.timezone, dayDurations);
  }
  const daily: DayStat[] = Object.entries(dayDurations)
    .map(([date, duration]) => ({ date, duration }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const [apps, appsTruncation] = truncate(allApps, limits.apps);
  const [domains, domainsTruncation] = truncate(allDomains, limits.domains);
  const [categories, categoriesTruncation] = truncate(allCategories, limits.categories);

  const days = Math.max(
    1,
    Math.round((input.end.getTime() - input.start.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    range: {
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      days,
      timezone: input.timezone,
    },
    hosts: input.hosts,
    coverage: {
      trackedSeconds: input.trackedSeconds,
      activeSeconds,
      exportedSeconds,
      activeShare: input.trackedSeconds > 0 ? activeSeconds / input.trackedSeconds : null,
    },
    apps,
    domains,
    categories,
    daily,
    focus: computeFocusStats(kept),
    privacy: {
      excludeUncategorized: input.privacy.excludeUncategorized,
      excludedCategories: Array.from(excludedCategoryKeys).map(k => JSON.parse(k) as string[]),
      excludedSeconds,
      coverage: activeSeconds > 0 ? exportedSeconds / activeSeconds : 1,
    },
    truncation: {
      apps: appsTruncation,
      domains: domainsTruncation,
      categories: categoriesTruncation,
    },
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatShare(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Render the context as the compact text actually sent to the provider. */
export function formatActivityContext(ctx: ActivityContext): string {
  const lines: string[] = [];

  lines.push(
    `Activity context — ${ctx.range.start.slice(0, 10)} to ${ctx.range.end.slice(0, 10)} ` +
      `(${ctx.range.days} day(s), ${ctx.range.timezone})`
  );
  lines.push(`Host(s): ${ctx.hosts.join(', ') || 'unknown'}`);
  const activeShare =
    ctx.coverage.activeShare === null ? 'n/a' : formatShare(ctx.coverage.activeShare);
  lines.push(
    `Tracked: ${formatDuration(ctx.coverage.trackedSeconds)} — ` +
      `active after AFK filtering: ${formatDuration(ctx.coverage.activeSeconds)} (${activeShare})`
  );
  lines.push(`Summarized below: ${formatDuration(ctx.coverage.exportedSeconds)}`);

  if (ctx.privacy.excludedSeconds > 0 || ctx.privacy.excludedCategories.length > 0) {
    lines.push('');
    // Deliberately omit category names here: they may themselves be sensitive
    // (e.g. "Health", "Finance") even though their activity is excluded.
    const n = ctx.privacy.excludedCategories.length;
    lines.push(
      `Privacy filter: withheld ${formatDuration(ctx.privacy.excludedSeconds)} ` +
        `(${formatShare(1 - ctx.privacy.coverage)} of active time) from ` +
        `${n} excluded ${n === 1 ? 'category' : 'categories'}`
    );
  }

  if (ctx.categories.length) {
    lines.push('');
    lines.push('Categories:');
    for (const c of ctx.categories) {
      lines.push(
        `  ${c.category.join(' > ')}: ${formatDuration(c.duration)} (${formatShare(c.share)})`
      );
    }
    if (ctx.truncation.categories.otherSeconds > 0) {
      lines.push(
        `  (+${ctx.truncation.categories.total - ctx.truncation.categories.shown} more, ` +
          `${formatDuration(ctx.truncation.categories.otherSeconds)})`
      );
    }
  }

  if (ctx.apps.length) {
    lines.push('');
    lines.push('Applications (distinct-title count in parentheses; titles not included):');
    for (const a of ctx.apps) {
      lines.push(
        `  ${a.app}: ${formatDuration(a.duration)} (${formatShare(a.share)}, ${
          a.titleCount
        } titles)`
      );
    }
    if (ctx.truncation.apps.otherSeconds > 0) {
      lines.push(
        `  (+${ctx.truncation.apps.total - ctx.truncation.apps.shown} more, ` +
          `${formatDuration(ctx.truncation.apps.otherSeconds)})`
      );
    }
  }

  if (ctx.domains.length) {
    lines.push('');
    lines.push('Browser domains (host only, no paths or query strings):');
    for (const d of ctx.domains) {
      lines.push(`  ${d.domain}: ${formatDuration(d.duration)} (${formatShare(d.share)})`);
    }
    if (ctx.truncation.domains.otherSeconds > 0) {
      lines.push(
        `  (+${ctx.truncation.domains.total - ctx.truncation.domains.shown} more, ` +
          `${formatDuration(ctx.truncation.domains.otherSeconds)})`
      );
    }
  }

  if (ctx.daily.length) {
    lines.push('');
    lines.push('Active time per day:');
    for (const d of ctx.daily) {
      lines.push(`  ${d.date}: ${formatDuration(d.duration)}`);
    }
  }

  lines.push('');
  lines.push('Focus:');
  lines.push(`  App switches: ${ctx.focus.appSwitches} across ${ctx.focus.blockCount} block(s)`);
  lines.push(`  Longest uninterrupted block: ${formatDuration(ctx.focus.longestBlockSeconds)}`);
  lines.push(`  Median block: ${formatDuration(ctx.focus.medianBlockSeconds)}`);

  return lines.join('\n');
}
