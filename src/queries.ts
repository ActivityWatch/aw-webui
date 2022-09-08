import _ from 'lodash';

// TODO: Sanitize string input of buckets

function querystr_to_array(querystr: string): string[] {
  return querystr
    .split(';')
    .map(s => s.trim())
    .filter(s => s)
    .map(s => s + ';');
}

function escape_doublequote(s: string) {
  return s.replace(/"/g, '\\"');
}

// Hostname safe for using as a variable name
function safeHostname(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9_]/g, '');
}

interface Rule {
  type: string;
  regex?: string;
}

type Category = [string[], Rule];

interface BaseQueryParams {
  include_audible?: boolean;
  categories: Category[];
  filter_categories: string[][];
  bid_browsers?: string[];
  bid_stopwatch?: string;
  return_variable_suffix?: string;
}

interface DesktopQueryParams extends BaseQueryParams {
  bid_window: string;
  bid_afk: string;
  filter_afk: boolean;
}

interface AndroidQueryParams extends BaseQueryParams {
  bid_android: string;
}

interface MultiQueryParams extends BaseQueryParams {
  hosts: string[];
  filter_afk: boolean;
  // This can be used to override params on a per-host basis
  host_params: { [host: string]: DesktopQueryParams | AndroidQueryParams };
}

function get_params(
  params: MultiQueryParams,
  host: string
): DesktopQueryParams | AndroidQueryParams {
  // Return the params for a given host, based on the self params and any overrides in host_params.
  // If no overrides are found, return the base params.
  const new_params: DesktopQueryParams = {
    ...params,
    bid_window: 'aw-watcher-window_' + host,
    bid_afk: 'aw-watcher-afk_' + host,
    bid_browsers: [],
    return_variable_suffix: safeHostname(host),
  };

  const host_params = params.host_params[host];
  if (host_params) {
    if (!isDesktopParams(host_params)) {
      console.error(`Invalid host_params for host ${host}: ${JSON.stringify(host_params)}`);
    }
    // Only override the params if they are defined and set to a truthy value
    Object.keys(host_params).forEach(key => {
      if (host_params[key] && host_params[key].length > 0) {
        new_params[key] = host_params[key];
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

// Constructs a query that returns a fully-detailed list of events from the merging of several sources (window, afk, web).
// Performs:
//  - AFK filtering (if filter_afk is true)
//  - Categorization (if categories specified)
//  - Filters by category (if filter_categories set)
// Puts it's results in `events` and `not_afk` (if not_afk available for platform).
export function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
  // Needs escaping for regex patterns like '\w' to work (JSON.stringify adds extra unecessary escaping)
  const categories_str = JSON.stringify(params.categories).replace(/\\\\/g, '\\');
  const cat_filter_str = JSON.stringify(params.filter_categories);

  // For simplicity, we assume that bid_window and bid_android are exchangeable (note however it needs special treatment)
  const bid_window = isDesktopParams(params) ? params.bid_window : params.bid_android;

  return [
    // Fetch window/app events
    `events = flood(query_bucket("${bid_window}"));`,
    // On Android, merge events to avoid overload of events
    isAndroidParams(params) ? 'events = merge_events_by_keys(events, ["app"]);' : '',
    // Fetch not-afk events
    isDesktopParams(params)
      ? `not_afk = flood(query_bucket("${params.bid_afk}"));
         not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);`
      : '',
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
         events = period_union(events, stopwatch_events);`
      : '',
    // Categorize
    params.categories ? `events = categorize(events, ${categories_str});` : '',
    // Filter out selected categories
    params.filter_categories
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
  const queries: string[] = _.map(params.hosts, hostname => {
    return canonicalEvents(get_params(params, hostname));
  });

  // Now we need to combine the queries to get a single series of events.
  // To do this, we can use the union_no_overlap function, which merges events
  // but avoids overlaps by giving priority according to the order of hosts.
  let query = queries.join('\n');
  query += 'events = [];';
  query += 'not_afk = [];';
  for (let i = 0; i < queries.length; i++) {
    query += `
    events = union_no_overlap(events, events_${safeHostname(params.hosts[i])});
    not_afk = union_no_overlap(not_afk, not_afk_${safeHostname(params.hosts[i])});
    `;
  }

  return query;
}

const default_limit = 100; // Hardcoded limit per group

export function appQuery(
  appbucket: string,
  categories: Category[],
  filter_categories: string[][]
): string[] {
  appbucket = escape_doublequote(appbucket);
  const params: AndroidQueryParams = {
    bid_android: appbucket,
    categories,
    filter_categories,
  };

  const code = `
    ${canonicalEvents(params)}

    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "classname"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    events = sort_by_timestamp(events);
    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);
    RETURN  = {"app_events": app_events, "title_events": title_events, "cat_events": cat_events, "duration": duration, "active_events": app_events};
  `;
  return querystr_to_array(code);
}

const browser_appnames = {
  chrome: [
    // Chrome
    'Google Chrome',
    'Google-chrome',
    'chrome.exe',
    'google-chrome-stable',

    // Chromium
    'Chromium',
    'Chromium-browser',
    'Chromium-browser-chromium',
    'chromium.exe',

    // Pre-releases
    'Google-chrome-beta',
    'Google-chrome-unstable',

    // Brave (should this be merged with the brave entry?)
    'Brave-browser',
  ],
  firefox: [
    'Firefox',
    'Firefox.exe',
    'firefox',
    'firefox.exe',
    'Firefox Developer Edition',
    'firefoxdeveloperedition',
    'Firefox-esr',
    'Firefox Beta',
    'Nightly',
    // From: https://github.com/ActivityWatch/aw-watcher-web/issues/87
    'firefox-aurora',
    'firefox-trunk-dev',
  ],
  opera: ['opera.exe', 'Opera'],
  brave: ['brave.exe'],
  edge: [
    'msedge.exe', // Windows
    'Microsoft Edge', // macOS
    'Microsoft-Edge-Stable', // Arch Linux: https://github.com/ActivityWatch/activitywatch/issues/753
  ],
  vivaldi: ['Vivaldi-stable', 'Vivaldi-snapshot', 'vivaldi.exe'],
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

// Returns a list of active browser events (where the browser was the active window) from all browser buckets
function browserEvents(params: DesktopQueryParams): string {
  let code = `
    browser_events = [];
  `;

  _.each(browsersWithBuckets(params.bid_browsers), ([browserName, bucketId]) => {
    const browser_appnames_str = JSON.stringify(browser_appnames[browserName]);
    code += `events_${browserName} = flood(query_bucket("${bucketId}"));
       window_${browserName} = filter_keyvals(events, "app", ${browser_appnames_str});
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
    browser_duration = sum_durations(browser_events);

    RETURN = {
        "window": {
            "app_events": app_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        },
        "browser": {
            "domains": browser_domains,
            "urls": browser_urls,
            "duration": browser_duration
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
// NOTE: Only supports desktop devices (for now)
// NOTE: Doesn't support browser buckets (and therefore not browser audible detection either)
//       This is due to the 'unknown' hostname of browser buckets (will hopefully be fixed soon).
export function multideviceQuery(params: MultiQueryParams): string[] {
  return querystr_to_array(
    `
    ${canonicalMultideviceEvents(params)}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);

    RETURN = {
        "window": {
            "app_events": app_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        },
    };`
  );
}

export function editorActivityQuery(editorbuckets: string[]): string[] {
  let q = ['events = [];'];
  for (let editorbucket of editorbuckets) {
    editorbucket = escape_doublequote(editorbucket);
    q.push('events = concat(events, flood(query_bucket("' + editorbucket + '")));');
  }
  q = q.concat([
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    `files = limit_events(files, ${default_limit});`,
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    `languages = limit_events(languages, ${default_limit});`,
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    `projects = limit_events(projects, ${default_limit});`,
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};',
  ]);
  return q;
}

// Returns a query that yields a single event with the duration set to
// the sum of all non-afk time in the queried period
export function activityQuery(afkbucket: string): string[] {
  afkbucket = escape_doublequote(afkbucket);
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;',
  ];
}

// Equivalent function to activityQuery, but for Android (which doesn't have an afk bucket)
export function activityQueryAndroid(androidbucket: string): string[] {
  androidbucket = escape_doublequote(androidbucket);
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

// Returns a query that yields a dict with a key "cat_events" which is an
// array of one event per category, with the duration of each event set to the sum of the category durations.
export function categoryQuery(params: MultiQueryParams | DesktopQueryParams): string[] {
  const q = `
  ${isMultiParams(params) ? canonicalMultideviceEvents(params) : canonicalEvents(params)}
  cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
  RETURN = { "cat_events": cat_events };
`;
  return querystr_to_array(q);
}

export default {
  fullDesktopQuery,
  multideviceQuery,
  appQuery,
  activityQuery,
  activityQueryAndroid,
  categoryQuery,
  editorActivityQuery,
};
