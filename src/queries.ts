import _ from 'lodash';

// TODO: Sanitize string input of buckets

function querystr_to_array(querystr: string): string[] {
  return querystr
    .split(';')
    .filter(l => l)
    .map(l => l + ';');
}

function escape_doublequote(s: string) {
  return s.replace(/"/g, '\\"');
}

interface Rule {
  type: string;
  regex?: string;
}

interface BaseQueryParams {
  include_audible?: boolean;
  classes: [string[], Rule][];
  filter_classes: string[][];
  bid_browsers?: string[];
}

interface DesktopQueryParams extends BaseQueryParams {
  bid_window: string;
  bid_afk: string;
  filter_afk: boolean;
}

interface AndroidQueryParams extends BaseQueryParams {
  bid_android: string;
}

function isDesktopParams(object: any): object is DesktopQueryParams {
  return 'bid_window' in object;
}

function isAndroidParams(object: any): object is AndroidQueryParams {
  return 'bid_android' in object;
}

// Constructs a query that returns a fully-detailed list of events from the merging of several sources (window, afk, web).
// Performs:
//  - AFK filtering (if filter_afk is true)
//  - Categorization (if classes specified)
//  - Filters by category (if filter_classes set)
// Puts it's results in `events` and `not_afk` (if not_afk available for platform).
export function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
  // Needs escaping for regex patterns like '\w' to work (JSON.stringify adds extra unecessary escaping)
  const classes_str = JSON.stringify(params.classes).replace(/\\\\/g, '\\');
  const cat_filter_str = JSON.stringify(params.filter_classes);

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
    params.bid_browsers
      ? isDesktopParams(params) &&
        browserEvents(params) +
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
    // Categorize
    params.classes ? `events = categorize(events, ${classes_str});` : '',
    // Filter out selected categories
    params.filter_classes ? `events = filter_keyvals(events, "$category", ${cat_filter_str});` : '',
  ].join('\n');
}

const default_limit = 100; // Hardcoded limit per group

export function appQuery(appbucket: string, classes, filterCategories: string[][]): string[] {
  appbucket = escape_doublequote(appbucket);
  const params: AndroidQueryParams = {
    bid_android: appbucket,
    classes: classes,
    filter_classes: filterCategories,
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
  ],
  opera: ['opera.exe', 'Opera'],
  brave: ['brave.exe'],
  edge: [
    'msedge.exe', // Windows
    'Microsoft Edge', // macOS
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

export function fullDesktopQuery(
  browserbuckets: string[],
  windowbucket: string,
  afkbucket: string,
  filterAFK = true,
  classes,
  filterCategories: string[][],
  include_audible: boolean
): string[] {
  // Escape `"`
  browserbuckets = _.map(browserbuckets, escape_doublequote);
  windowbucket = escape_doublequote(windowbucket);
  afkbucket = escape_doublequote(afkbucket);

  // TODO: Get classes
  const params: DesktopQueryParams = {
    bid_window: windowbucket,
    bid_afk: afkbucket,
    bid_browsers: browserbuckets,
    classes: classes,
    filter_classes: filterCategories,
    filter_afk: filterAFK,
    include_audible,
  };

  return querystr_to_array(
    `
    ${canonicalEvents(params)}
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

export function hourlyCategoryQuery(params: DesktopQueryParams) {
  const q = `
    ${canonicalEvents(params)}
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
    RETURN = { "cat_events": cat_events };
  `;
  return querystr_to_array(q);
}

export function dailyActivityQuery(afkbucket: string): string[] {
  afkbucket = escape_doublequote(afkbucket);
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;',
  ];
}

export function dailyActivityQueryAndroid(androidbucket: string): string[] {
  androidbucket = escape_doublequote(androidbucket);
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

export default {
  fullDesktopQuery,
  appQuery,
  dailyActivityQuery,
  hourlyCategoryQuery,
  dailyActivityQueryAndroid,
  editorActivityQuery,
};
