import _ from 'lodash';

// TODO: Sanitize string input of buckets

export function querystr_to_array(querystr: string): string[] {
  // Split on ';' but only when not inside a double-quoted string literal.
  // A naive .split(';') breaks category rules whose regex contains semicolons,
  // e.g. `"regex": "foo;bar"` would be shredded before reaching the server.
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inEscape = false;

  for (const char of querystr) {
    if (inEscape) {
      current += char;
      inEscape = false;
    } else if (char === '\\' && inString) {
      current += char;
      inEscape = true;
    } else if (char === '"') {
      inString = !inString;
      current += char;
    } else if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed + ';');
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed + ';');

  return statements;
}

function escape_doublequote(s: string) {
  return s.replace(/"/g, '\\"');
}

// Hostname safe for using as a variable name
export function safeHostname(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9_]/g, '');
}

interface Rule {
  type: string;
  regex?: string;
  ignore_case?: boolean;
  select_keys?: string[];
}

type Category = [string[], Rule];

export interface BaseQueryParams {
  include_audible?: boolean;
  categories: Category[];
  filter_categories: string[][];
  bid_browsers?: string[];
  bid_stopwatch?: string;
  return_variable_suffix?: string;
}

export interface DesktopQueryParams extends BaseQueryParams {
  bid_window: string;
  bid_afk: string;
  filter_afk: boolean;
  always_active_pattern?: string;
}

export interface AndroidQueryParams extends BaseQueryParams {
  bid_android: string;
  /** True when the bucket is an aw-import-screentime (iOS) bucket.
   *  ScreenTime events carry a "title" key; aw-watcher-android events do not.
   *  Keep false (the default) for regular Android watcher buckets so that
   *  merge_events_by_keys does not drop every event due to a missing key. */
  isIos?: boolean;
  /** Keep the raw (flooded) app events instead of pre-merging them by app.
   *  Required whenever the events are combined with other timelines, as in
   *  the multidevice query: merge_events_by_keys collapses every app into a
   *  single event at its first timestamp (with the summed duration) and
   *  returns them in arbitrary order, which union_no_overlap (it expects
   *  sorted, positioned events) then clips against the other devices. */
  keep_event_timestamps?: boolean;
}

export interface MultiQueryParams extends BaseQueryParams {
  hosts: string[];
  filter_afk: boolean;
  always_active_pattern: string;
  // This can be used to override params on a per-host basis.  Only the
  // keys present (and non-empty) are applied, so partial objects such as
  // {bid_window, bid_afk} are valid overrides.
  host_params: { [host: string]: Partial<DesktopQueryParams> | Partial<AndroidQueryParams> };
}

// Query-variable suffix for the i-th host of a multidevice query. The index
// keeps it unique: different hostnames can map to the same safeHostname()
// (e.g. "work-laptop" and "worklaptop"), and would otherwise overwrite each
// other's events.
function hostVariableSuffix(params: MultiQueryParams, i: number): string {
  return `${safeHostname(params.hosts[i])}_${i}`;
}

function get_params(params: MultiQueryParams, i: number): DesktopQueryParams | AndroidQueryParams {
  const host = params.hosts[i];
  // Return the params for a given host, based on the self params and any overrides in host_params.
  // If no overrides are found, return the base (desktop) params.
  const host_params = params.host_params[host];

  // A host with only an android/ScreenTime bucket (no afkstatus bucket, e.g.
  // a phone synced via aw-sync) queries via the android path instead, which
  // has no afk filter — see buildMultideviceHostParams.
  if (host_params && isAndroidParams(host_params) && host_params.bid_android) {
    const new_params: AndroidQueryParams = {
      ...params,
      bid_android: host_params.bid_android,
      isIos: host_params.isIos,
      keep_event_timestamps: true,
      return_variable_suffix: hostVariableSuffix(params, i),
    };
    return new_params;
  }

  const new_params: DesktopQueryParams = {
    ...params,
    bid_window: 'aw-watcher-window_' + host,
    bid_afk: 'aw-watcher-afk_' + host,
    bid_browsers: [],
    return_variable_suffix: hostVariableSuffix(params, i),
  };

  if (host_params) {
    if (!isDesktopParams(host_params)) {
      console.error(`Invalid host_params for host ${host}: ${JSON.stringify(host_params)}`);
    }
    // Only override the params if they are defined and set to a truthy value
    const overrides = host_params as Record<string, unknown>;
    const target = new_params as unknown as Record<string, unknown>;
    Object.keys(overrides).forEach(key => {
      const value = overrides[key];
      if ((typeof value === 'string' || Array.isArray(value)) && value.length > 0) {
        target[key] = value;
      }
    });
  }
  return new_params;
}

function isDesktopParams(object: any): object is DesktopQueryParams {
  return 'bid_window' in object;
}

function isAndroidParams(object: any): object is AndroidQueryParams {
  return 'bid_android' in object;
}

function isMultiParams(object: any): object is MultiQueryParams {
  return 'hosts' in object;
}

// Use query_bucket directly when we have a full bucket ID (contains hostname after the prefix).
// Fall back to find_bucket only when the ID is partial (ends with '_', meaning hostname is unknown).
// This avoids find_bucket matching wrong buckets when similar names exist (e.g. host vs host.local).
// See: https://github.com/ActivityWatch/aw-webui/issues/590
function queryBucket(bid: string): string {
  if (bid.endsWith('_')) {
    return `query_bucket(find_bucket("${bid}"))`;
  }
  return `query_bucket("${bid}")`;
}

// Constructs a query that returns a fully-detailed list of events from the merging of several sources (window, afk, web).
// Performs:
//  - AFK filtering (if filter_afk is true)
//  - Categorization (if categories specified)
//  - Filters by category (if filter_categories set)
// Puts it's results in `events` and `not_afk` (if not_afk available for platform).
export function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
  // Needs escaping for regex patterns like '\w' to work (JSON.stringify adds extra unnecessary escaping)
  const categories_str = params.categories
    ? JSON.stringify(params.categories).replace(/\\\\/g, '\\')
    : '';
  const always_active_pattern_str = isDesktopParams(params)
    ? params.always_active_pattern
    : undefined;
  const cat_filter_str = JSON.stringify(params.filter_categories);

  // For simplicity, we assume that bid_window and bid_android are exchangeable (note however it needs special treatment)
  const bid_window = isDesktopParams(params) ? params.bid_window : params.bid_android;

  return [
    // Fetch window/app events
    `events = flood(${queryBucket(bid_window)});`,
    // On Android, merge events to avoid overload of events.
    // aw-watcher-android events carry "app"/"package"/"classname" but NOT "title";
    // merge_events_by_keys drops events missing any requested key, so including
    // "title" here collapses all Android watcher events to zero duration
    // (regression introduced in bf0fc84 to support iOS ScreenTime, which DOES
    // carry "title").  Only add "title" when the bucket is an iOS ScreenTime import.
    // Skipped when the events are combined with other devices' timelines
    // (see AndroidQueryParams.keep_event_timestamps).
    isAndroidParams(params) && !params.keep_event_timestamps
      ? params.isIos
        ? 'events = merge_events_by_keys(events, ["app", "title"]);'
        : 'events = merge_events_by_keys(events, ["app"]);'
      : '',
    // Fetch not-afk events. When there is no AFK bucket (bid_afk is empty),
    // emit an empty not_afk list so later references to the variable
    // (including `return_variable_suffix`, used by the multidevice query)
    // don't fail. Android/ScreenTime buckets have no afkstatus concept at
    // all (matching the single-device Android view, which treats all app
    // events as active — see appQuery's "active_events": app_events), so
    // their app/window events themselves count as not-afk instead of an
    // empty list, otherwise mobile hosts would contribute zero events to
    // the multidevice active timeline despite having counted duration.
    isDesktopParams(params)
      ? params.bid_afk
        ? `not_afk = flood(${queryBucket(params.bid_afk)});
           not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);` +
          (always_active_pattern_str
            ? `not_treat_as_afk = filter_keyvals_regex(events, "app", "${always_active_pattern_str}");
               not_afk = period_union(not_afk, not_treat_as_afk);
               not_treat_as_afk = filter_keyvals_regex(events, "title", "${always_active_pattern_str}");
               not_afk = period_union(not_afk, not_treat_as_afk);`
            : '')
        : 'not_afk = [];'
      : 'not_afk = events;',
    // Fetch browser events
    isDesktopParams(params) && params.bid_browsers
      ? browserEvents(params) +
        // Include focused and audible browser events as indications of not-afk
        (params.include_audible
          ? `audible_events = filter_keyvals(browser_events, "audible", [true]);
             not_afk = period_union(not_afk, audible_events);`
          : '')
      : '',
    // Filter out window events when the user was afk
    isDesktopParams(params) && params.filter_afk
      ? 'events = filter_period_intersect(events, not_afk);'
      : '',
    params.bid_stopwatch
      ? `stopwatch_events = query_bucket("${params.bid_stopwatch}");
         events = union_no_overlap(stopwatch_events, events);`
      : 'stopwatch_events = [];',
    // Categorize
    params.categories ? `events = categorize(events, ${categories_str});` : '',
    // Filter out selected categories. Only emit when the list is non-empty: an
    // empty allow-list would drop every event rather than skip the filter.
    params.filter_categories && params.filter_categories.length > 0
      ? `events = filter_keyvals(events, "$category", ${cat_filter_str});`
      : '',
    // "Return" events by setting variable named with return_variable if set
    params.return_variable_suffix
      ? `events_${params.return_variable_suffix} = events;
         not_afk_${params.return_variable_suffix} = not_afk;`
      : '',
  ].join('\n');
}

export function canonicalMultideviceEvents(params: MultiQueryParams): string {
  // First, query each device individually
  const queries: string[] = _.map(params.hosts, (_hostname, i) => {
    return canonicalEvents(get_params(params, i));
  });

  // Now we need to combine the queries to get a single series of events.
  // To do this, we can use the union_no_overlap function, which merges events
  // but avoids overlaps by giving priority according to the order of hosts.
  let query = queries.join('\n');
  query += 'events = [];';
  query += 'not_afk = [];';
  for (let i = 0; i < queries.length; i++) {
    query += `
    events = union_no_overlap(events, events_${hostVariableSuffix(params, i)});
    not_afk = union_no_overlap(not_afk, not_afk_${hostVariableSuffix(params, i)});
    `;
  }

  return query;
}

export const default_limit = 100; // Hardcoded limit per group

export function appQuery(
  appbucket: string,
  categories: Category[],
  filter_categories: string[][],
  isIos = false,
  limit = default_limit
): string[] {
  appbucket = escape_doublequote(appbucket);
  const params: AndroidQueryParams = {
    bid_android: appbucket,
    categories,
    filter_categories,
    isIos,
  };

  // aw-watcher-android events have no "title" key; only ScreenTime (iOS) does.
  // Merging on "title" when it is absent drops every event (see canonicalEvents).
  // ScreenTime (iOS) events carry "app" and "title" but NOT "classname";
  // merging on "classname" when absent drops every event.
  const titleMergeKeys = isIos ? '["app", "title"]' : '["app", "classname"]';

  const code = `
    ${canonicalEvents(params)}

    title_events = sort_by_duration(merge_events_by_keys(events, ${titleMergeKeys}));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    app_cat_events = sort_by_duration(merge_events_by_keys(events, ["app", "$category"]));

    events = sort_by_timestamp(events);
    app_events  = limit_events(app_events, ${limit});
    title_events  = limit_events(title_events, ${limit});
    duration = sum_durations(events);
    RETURN  = {"app_events": app_events, "app_cat_events": app_cat_events, "title_events": title_events, "cat_events": cat_events, "duration": duration, "active_events": app_events};
  `;
  return querystr_to_array(code);
}

// Exact app names (Flatpak app IDs and similar reverse-domain identifiers) used for bucket discovery and as a
// fallback for names that don't match the regex patterns below. Process name
// variants (upper/lowercase, spacing, .exe suffix) are handled by
// browser_appname_regex using (?i) flag. See test/unit/queries.test.node.ts for
// the complete list of known app names these patterns cover.
export const browser_appnames: Record<string, string[]> = {
  // Chromium forks (Dia, Arc) run the chrome extension by default, so their
  // web events land in the chrome bucket. Reverse-domain identifiers don't
  // match the process-name regex below and have to live here (#927).
  chrome: [
    // Desktop (Flatpak / macOS bundle IDs)
    'com.google.Chrome',
    'com.google.ChromeDev',
    'org.chromium.Chromium',
    'company.thebrowser.dia',
    // Android package names — Chromium-based browsers that use the chrome extension bucket
    'com.android.chrome',
    'com.chrome.beta',
    'com.chrome.dev',
    'com.chrome.canary',
    'org.bromite.cromite', // Cromite is a Chromium fork; its extension identifies as chrome
  ],
  firefox: [
    // Desktop
    'org.mozilla.firefox',
    'io.gitlab.librewolf-community',
    'net.waterfox.waterfox',
    // Android
    'org.mozilla.fenix',
    'org.mozilla.firefox_beta',
    'org.mozilla.focus',
  ],
  opera: ['com.opera.Opera', 'com.opera.browser', 'com.opera.browser.beta'],
  brave: [
    'com.brave.Browser',
    'com.brave.browser',
    'com.brave.browser_beta',
    'com.brave.browser_nightly',
  ],
  edge: [
    'com.microsoft.Edge',
    'com.microsoft.EdgeDev',
    'com.microsoft.emmx',
    'com.microsoft.emmx.beta',
  ],
  arc: [],
  vivaldi: ['com.vivaldi.Vivaldi', 'com.vivaldi.browser'],
  orion: ['Orion'],
  yandex: ['ru.yandex.Browser'],
  zen: ['app.zen_browser.zen'],
  floorp: ['one.ablaze.floorp'],
  helium: ['net.imput.helium'],
};

// Returns a list of (browserName, bucketId) pairs for found browser buckets
function browsersWithBuckets(browserbuckets: string[]): [string, string][] {
  const browsername_to_bucketid: [string, string | undefined][] = _.map(
    Object.keys(browser_appnames),
    browserName => {
      const bucketId = _.find(browserbuckets, bucket_id => _.includes(bucket_id, browserName));
      return [browserName, bucketId];
    }
  );
  // Skip browsers for which a bucket couldn't be found
  return _.filter(browsername_to_bucketid, ([, bucketId]) => bucketId !== undefined);
}

// Case-insensitive regex patterns covering all OS/platform process name variants
// (Windows .exe, Linux lowercase, macOS capitalized, versioned names like firefox-esr-esr140).
// Used with filter_keyvals_regex in addition to the exact names in browser_appnames.
// The full set of historical app names these patterns replace is documented in the unit tests.
// See: test/unit/queries.test.node.ts, https://github.com/ActivityWatch/aw-webui/issues/749
//
// Chromium forks (Arc, Dia) run the chrome build of the extension, which announces itself
// as chrome unless the user overrides the browser name in the extension settings. So by
// default their events land in the chrome bucket and their app names have to be matched
// here (#927, ActivityWatch/activitywatch#1094). Fork alternatives are $-anchored so
// names like "archive" / "Dialog" don't match.
//
// Helium is not a Chromium fork itself, but it can run the Chrome Web Store
// extension build, which reports the "Helium" app name into the chrome bucket
// the same way (#898). It's listed here rather than in browser_appname_regex.helium
// so it gets the same dedicated-bucket exclusion as Arc/Dia below.
//
// When a dedicated fork bucket participates (today: settings-override Arc, or a
// standalone Helium bucket), only that fork is stripped from the chrome stream so
// the dedicated bucket owns those events without dropping other chrome-bucket
// forks (Dia has no dedicated bucket).
const CHROME_BASE_ALTS = ['google[-_ ]?chrome', 'chrome', 'chromium'];
const CHROME_FORK_ALTS: Record<string, string> = {
  arc: 'arc(\\.exe)?$',
  dia: 'dia(\\.exe)?$',
  helium: 'helium(\\.exe)?$',
};

export function chromeAppnameRegex(excludeForks: Iterable<string> = []): string {
  const excluded = new Set(excludeForks);
  const alts = [
    ...CHROME_BASE_ALTS,
    ...Object.entries(CHROME_FORK_ALTS)
      .filter(([name]) => !excluded.has(name))
      .map(([, alt]) => alt),
  ];
  return `(?i)^(${alts.join('|')})`;
}

export const browser_appname_regex: Record<string, string> = {
  chrome: chromeAppnameRegex(),
  firefox: '(?i)(firefox|librewolf|waterfox|nightly)',
  opera: '(?i)(opera)',
  brave: '(?i)(brave)',
  edge: '(?i)^(microsoft[-_ ]?edge|msedge)',
  arc: '(?i)^arc(\\.exe)?$',
  vivaldi: '(?i)(vivaldi)',
  orion: '(?i)(orion)',
  yandex: '(?i)(yandex)',
  zen: '(?i)(zen)',
  floorp: '(?i)(floorp)',
  helium: '(?i)(helium)',
};

// Returns a list of active browser events (where the browser was the active window) from all browser buckets
function browserEvents(params: DesktopQueryParams): string {
  const browsers = browsersWithBuckets(params.bid_browsers);
  // The chrome regex matches forks so a fork without a dedicated bucket still
  // counts (#927). A settings-override Arc bucket can coexist with the default
  // chrome bucket, and then the same Arc activity would be counted by both
  // streams. There is no exclude primitive common to both aw-server
  // implementations (exclude_keyvals is Rust-only), so the chrome stream
  // strips only the forks that actually have a dedicated bucket.
  // Dia stays on the chrome stream: it has no dedicated bucket today.
  const dedicatedChromeForks = browsers
    .map(([browserName]) => browserName)
    .filter(name => name in CHROME_FORK_ALTS);

  let code = `
    browser_events = [];
  `;

  _.each(browsers, ([browserName, bucketId]) => {
    const browser_appnames_str = JSON.stringify(browser_appnames[browserName]);
    code += `events_${browserName} = flood(query_bucket("${bucketId}"));
       window_${browserName} = filter_keyvals(events, "app", ${browser_appnames_str});`;

    // Add regex-based matching to cover case/spacing/versioning variants (e.g., Firefox.exe, firefox-esr-esr140).
    let pattern = browser_appname_regex[browserName];
    if (browserName === 'chrome' && dedicatedChromeForks.length > 0) {
      pattern = chromeAppnameRegex(dedicatedChromeForks);
    }
    if (pattern) {
      // JSON.stringify adds extra unnecessary escaping for backslashes (e.g. '\.' becomes '\\.')
      // which breaks regex patterns like arc(\.exe)?$ on Windows. Undo the double-escaping.
      const pattern_str = JSON.stringify(pattern).replace(/\\\\/g, '\\');
      code += `
       window_${browserName}_re = filter_keyvals_regex(events, "app", ${pattern_str});
       window_${browserName} = sort_by_timestamp(concat(window_${browserName}, window_${browserName}_re));`;
    }

    code += `
       events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
       events_${browserName} = split_url_events(events_${browserName});
       browser_events = concat(browser_events, events_${browserName});
       browser_events = sort_by_timestamp(browser_events);`;
  });

  return code;
}

export function fullDesktopQuery(params: DesktopQueryParams): string[] {
  return querystr_to_array(
    `
    ${canonicalEvents({
      ...params,
      // Escape `"`
      bid_window: escape_doublequote(params.bid_window),
      bid_afk: escape_doublequote(params.bid_afk),
      bid_browsers: _.map(params.bid_browsers, escape_doublequote),
    })}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    app_cat_events = sort_by_duration(merge_events_by_keys(events, ["app", "$category"]));

    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);
    ` + // Browser events are retrieved in canonicalQuery
      `
    browser_events = split_url_events(browser_events);
    browser_urls = merge_events_by_keys(browser_events, ["url"]);
    browser_urls = sort_by_duration(browser_urls);
    browser_urls = limit_events(browser_urls, ${default_limit});
    browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
    browser_domains = sort_by_duration(browser_domains);
    browser_domains = limit_events(browser_domains, ${default_limit});
    browser_titles = merge_events_by_keys(browser_events, ["title"]);
    browser_titles = sort_by_duration(browser_titles);
    browser_titles = limit_events(browser_titles, ${default_limit});
    browser_duration = sum_durations(browser_events);
    stopwatch_events = merge_events_by_keys(stopwatch_events, ["label"]);
    stopwatch_events = sort_by_duration(stopwatch_events);
    stopwatch_events = limit_events(stopwatch_events, ${default_limit});

    RETURN = {
        "window": {
            "app_events": app_events,
            "app_cat_events": app_cat_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        },
        "browser": {
            "domains": browser_domains,
            "urls": browser_urls,
            "titles": browser_titles,
            "duration": browser_duration
        },
        "stopwatch": {
            "stopwatch_events": stopwatch_events
        }
    };`
  );
}

// Performs a query that combines data from multiple devices.
// A multidevice-variant of fullDesktopQuery (with limitations).
//
// 1. Performs one canonicalEvents query per device.
// 2. Combines the results into a single list of events using the transform union_no_overlap (which gives priority to events earlier in the list of devices).
// 3. Compute the statistics of interest.
//
// NOTE: Events from devices are picked in the order of the hostnames array, such that if overlaps are detected the conflict will be resolved by choosing events from the earlier device.
// NOTE: Desktop hosts (window+afk buckets) and android/ScreenTime-only hosts
//       (no afkstatus bucket) are both supported, per buildMultideviceHostParams.
//       Android hosts have no afk filter, matching the single-device Android view.
// NOTE: Doesn't support browser buckets (and therefore not browser audible detection either)
//       This is due to the 'unknown' hostname of browser buckets (will hopefully be fixed soon).
export function multideviceQuery(params: MultiQueryParams): string[] {
  // app_events is computed from events directly, not chained off
  // title_events: aw-watcher-android events have no "title" key, so
  // merge_events_by_keys(events, ["app", "title"]) drops them from
  // title_events entirely (see canonicalEvents). Chaining app_events off
  // title_events would silently exclude mobile hosts' app-level
  // breakdown even though their duration is counted; title breakdown
  // (which mobile hosts can't provide) stays desktop-only.
  return querystr_to_array(
    `
    ${canonicalMultideviceEvents(params)}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    app_cat_events = sort_by_duration(merge_events_by_keys(events, ["app", "$category"]));

    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);

    RETURN = {
        "window": {
            "app_events": app_events,
            "app_cat_events": app_cat_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        }
    };`
  );
}

// Bundle ID -> app name pairs of ScreenTime (iOS) imports, whose events carry
// the bundle ID as "app" and the human-readable name as "title". Used to show
// app names in combined (multidevice) views, like the single-device view does.
export function screentimeNamesQuery(bucketIds: string[]): string[] {
  const q = ['events = [];'];
  for (const bid of bucketIds) {
    q.push(`events = concat(events, query_bucket("${escape_doublequote(bid)}"));`);
  }
  q.push('RETURN = merge_events_by_keys(events, ["app", "title"]);');
  return q;
}

export function editorActivityQuery(editorbuckets: string[], limit = default_limit): string[] {
  let q = ['events = [];'];
  for (const editorbucket of editorbuckets) {
    q.push(`events = concat(events, flood(query_bucket("${escape_doublequote(editorbucket)}")));`);
  }
  q = q.concat([
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    `files = limit_events(files, ${limit});`,
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    `languages = limit_events(languages, ${limit});`,
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    `projects = limit_events(projects, ${limit});`,
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};',
  ]);
  return q;
}

// Returns a query that yields a single event with the duration set to
// the sum of all non-afk time in the queried period
// TODO: Would ideally account for `filter_afk` and `always_active_pattern`
// TODO: rename to something like `activeDurationQuery`
// FIXME: Doesn't respect audible-as-active and always-active-pattern
export function activityQuery(afkbuckets: string[]): string[] {
  let q = ['not_afk = [];'];
  for (const afkbucket of afkbuckets) {
    q = q.concat([
      `not_afk_curr = query_bucket("${escape_doublequote(afkbucket)}");`,
      `not_afk_curr = filter_keyvals(not_afk_curr, "status", ["not-afk"]);`,
      `not_afk = union_no_overlap(not_afk, not_afk_curr);`,
    ]);
  }
  q = q.concat(['not_afk = merge_events_by_keys(not_afk, ["status"]);', 'RETURN = not_afk;']);
  return q;
}

// Equivalent function to activityQuery, but for Android (which doesn't have an afk bucket)
export function activityQueryAndroid(androidbucket: string): string[] {
  androidbucket = escape_doublequote(androidbucket);
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

// Active-time query across several devices, used for the period-usage bars
// in multidevice mode. Desktop hosts contribute their not-afk periods,
// mobile hosts (no afkstatus bucket) their app-usage events, matching how
// the multidevice query treats them. period_union makes simultaneous use of
// two devices count once. Returns the total active duration (seconds).
export function multideviceActivityQuery(afkbuckets: string[], androidbuckets: string[]): string[] {
  let q = ['not_afk = [];'];
  for (const afkbucket of afkbuckets) {
    q = q.concat([
      `not_afk_curr = query_bucket("${escape_doublequote(afkbucket)}");`,
      `not_afk_curr = filter_keyvals(not_afk_curr, "status", ["not-afk"]);`,
      `not_afk = period_union(not_afk, not_afk_curr);`,
    ]);
  }
  for (const androidbucket of androidbuckets) {
    q = q.concat([
      `not_afk = period_union(not_afk, query_bucket("${escape_doublequote(androidbucket)}"));`,
    ]);
  }
  q = q.concat(['RETURN = sum_durations(not_afk);']);
  return q;
}

// Returns a query that yields a dict with a key "cat_events" which is an
// array of one event per category, with the duration of each event set to the sum of the category durations.
// Query for the single-pass activity-analysis context (see AISummaryView).
//
// Returns the AFK-filtered, categorized timeline plus browser domains and the
// unfiltered tracked duration, so the client can derive bounded statistics locally
// without downloading a raw, uncapped bucket. Titles and URLs stay on the device;
// see src/util/activityContext.ts for what is actually exported.
export function analysisContextQuery(params: DesktopQueryParams): string[] {
  // browser_domains is intentionally not limited here. buildActivityContext
  // computes truncation metadata (total + otherSeconds) over the full domain list;
  // a server-side cap would make the reported totals wrong. Domain events are
  // one short string per domain, so the response stays small; the client applies
  // the display limit with correct truncation accounting.
  return querystr_to_array(
    `
    ${canonicalEvents({
      ...params,
      bid_window: escape_doublequote(params.bid_window),
      bid_afk: escape_doublequote(params.bid_afk),
      bid_browsers: _.map(params.bid_browsers, escape_doublequote),
    })}
    events = sort_by_timestamp(events);
    browser_events = split_url_events(browser_events);
    browser_domains = sort_by_duration(merge_events_by_keys(browser_events, ["$domain"]));
    tracked_events = ${queryBucket(escape_doublequote(params.bid_window))};
    RETURN = {
        "events": events,
        "browser_domains": browser_domains,
        "tracked_duration": sum_durations(tracked_events)
    };`
  );
}

export function categoryQuery(
  params: MultiQueryParams | DesktopQueryParams | AndroidQueryParams
): string[] {
  const q = `
  ${isMultiParams(params) ? canonicalMultideviceEvents(params) : canonicalEvents(params)}
  cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
  RETURN = { "cat_events": cat_events };
`;
  return querystr_to_array(q);
}

// Query browser buckets standalone, without requiring window/afk watchers.
// Used on Android and other platforms where only aw-watcher-web is running.
export function browserOnlyQuery(browserbuckets: string[]): string[] {
  const escaped = browserbuckets.map(escape_doublequote);

  let code = `browser_events = [];`;
  escaped.forEach((bucketId, i) => {
    code += `
    events_browser_${i} = flood(query_bucket("${bucketId}"));
    browser_events = concat(browser_events, events_browser_${i});`;
  });

  code += `
    browser_events = split_url_events(browser_events);
    browser_urls = merge_events_by_keys(browser_events, ["url"]);
    browser_urls = sort_by_duration(browser_urls);
    browser_urls = limit_events(browser_urls, ${default_limit});
    browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
    browser_domains = sort_by_duration(browser_domains);
    browser_domains = limit_events(browser_domains, ${default_limit});
    browser_titles = merge_events_by_keys(browser_events, ["title"]);
    browser_titles = sort_by_duration(browser_titles);
    browser_titles = limit_events(browser_titles, ${default_limit});
    browser_duration = sum_durations(browser_events);
    RETURN = {
      "browser": {
        "domains": browser_domains,
        "urls": browser_urls,
        "titles": browser_titles,
        "duration": browser_duration
      }
    };`;

  return querystr_to_array(code);
}

// Query that blends Android app data with browser URL data (intersection).
// For each browser that has both an aw-watcher-web bucket AND matching Android
// app events, URL events are filtered to the periods when the browser was in
// the foreground on the Android device.  This mirrors how fullDesktopQuery
// blends window focus + browser URLs on desktop.
//
// Returns { browser: { domains, urls, titles, duration } } — the same shape
// as query_browser_only / fullDesktopQuery so query_browser_completed can
// consume it unchanged.
export function androidBrowserQuery(
  bid_android: string,
  bid_browsers: string[],
  categories: Category[],
  filter_categories: string[][],
  isIos = false
): string[] {
  bid_android = escape_doublequote(bid_android);
  const escaped_browsers = bid_browsers.map(escape_doublequote);
  // keep_event_timestamps: merge_events_by_keys collapses each app into one
  // event at its first timestamp with summed duration, so URL intersection
  // would match the wrong clock times (Chrome 09:00–09:10 and 10:00–10:10
  // become a 20-minute event starting at 09:00). Same flag the multidevice
  // path uses when combining Android events with another timeline.
  // filter_categories is accepted for signature parity with appQuery but
  // must not apply here: selecting a category that excludes the browser app
  // would drop its foreground periods (and therefore its URLs) even when
  // those sites belong to the selected category. Desktop selects browser
  // periods before the category filter; the previous Android browser-only
  // query ignored it too.
  const params: AndroidQueryParams = {
    bid_android,
    categories,
    filter_categories,
    isIos,
    keep_event_timestamps: true,
  };
  // Unlike the desktop selector, keep every profile bucket for each browser.
  const browsers: [string, string][] = Object.keys(browser_appnames).flatMap(browserName =>
    escaped_browsers
      .filter(
        bucketId =>
          bucketId === `aw-watcher-web-${browserName}` ||
          bucketId.startsWith(`aw-watcher-web-${browserName}_`)
      )
      .map(bucketId => [browserName, bucketId] as [string, string])
  );

  // Mirror browserEvents() but rely on the `events` variable set by
  // canonicalEvents(AndroidQueryParams) — which holds the android app events.
  // Exact filter_keyvals matching against "package" therefore selects the
  // periods when a browser was in the foreground on the Android device, giving
  // a proper intersection rather than raw URL totals.
  let browser_code = `browser_events = [];`;
  _.each(browsers, ([browserName, bucketId]) => {
    const appnames_str = JSON.stringify(browser_appnames[browserName]);
    browser_code += `
      events_${browserName} = flood(query_bucket("${bucketId}"));
      window_${browserName} = filter_keyvals(events, "package", ${appnames_str});`;
    // Mobile watcher events put display labels in app and exact IDs in package.
    // Desktop substring regexes
    // can select a different browser (e.g. Firefox's "nightly" matches Brave Nightly).
    browser_code += `
      events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
      events_${browserName} = split_url_events(events_${browserName});
      browser_events = concat(browser_events, events_${browserName});
      browser_events = sort_by_timestamp(browser_events);`;
  });

  // A custom extension name has no known package mapping. Preserve the
  // previous browser-only behavior for those buckets instead of dropping them.
  const matchedBuckets = new Set(browsers.map(([, bucketId]) => bucketId));
  escaped_browsers
    .filter(bucketId => !matchedBuckets.has(bucketId))
    .forEach((bucketId, i) => {
      browser_code += `
      events_custom_${i} = flood(query_bucket("${bucketId}"));
      events_custom_${i} = split_url_events(events_custom_${i});
      browser_events = concat(browser_events, events_custom_${i});`;
    });

  const code = `
    ${canonicalEvents({ ...params, filter_categories: [] })}
    ${browser_code}
    browser_urls = merge_events_by_keys(browser_events, ["url"]);
    browser_urls = sort_by_duration(browser_urls);
    browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
    browser_domains = sort_by_duration(browser_domains);
    browser_titles = merge_events_by_keys(browser_events, ["title"]);
    browser_titles = sort_by_duration(browser_titles);
    browser_duration = sum_durations(browser_events);
    RETURN = {
      "browser": {
        "domains": browser_domains,
        "urls": browser_urls,
        "titles": browser_titles,
        "duration": browser_duration
      }
    };
  `;
  return querystr_to_array(code);
}

export default {
  fullDesktopQuery,
  analysisContextQuery,
  multideviceQuery,
  appQuery,
  androidBrowserQuery,
  activityQuery,
  activityQueryAndroid,
  multideviceActivityQuery,
  screentimeNamesQuery,
  categoryQuery,
  editorActivityQuery,
  browserOnlyQuery,
};
