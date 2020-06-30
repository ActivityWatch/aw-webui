import _ from 'lodash';

// TODO: Sanitize string input of buckets

function querystr_to_array(querystr: string): string[] {
  return querystr
    .split(';')
    .filter(l => l)
    .map(l => l + ';');
}

interface BaseQueryParams {
  include_audible?: boolean;
  classes: Record<string, any>;
  filter_classes: string[][];
}

interface DesktopQueryParams extends BaseQueryParams {
  bid_window: string;
  bid_afk: string;
  filter_afk: boolean;
  bid_browsers?: string[];
}

interface AndroidQueryParams extends BaseQueryParams {
  bid_android: string;
  bid_browsers?: string[];
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
function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
  // Needs escaping for regex patterns like '\w' to work (JSON.stringify adds extra unecessary escaping)
  const classes_str = JSON.stringify(params.classes).replace('\\\\', '\\');
  const cat_filter_str = JSON.stringify(params.filter_classes);
  const bid_window = isDesktopParams(params) ? params.bid_window : params.bid_android;

  return `
    events = flood(query_bucket("${bid_window}"));
    ${
      isDesktopParams(params)
        ? `not_afk = flood(query_bucket("${params.bid_afk}"));
           not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);`
        : ''
    }
    ${isAndroidParams(params) ? 'events = merge_events_by_keys(events, ["app"]);' : ''}

    ${
      isDesktopParams(params) && params.filter_afk
        ? 'events = filter_period_intersect(events, not_afk);'
        : ''
    }
    ${params.classes ? `events = categorize(events, ${classes_str});` : ''}
    ${
      params.filter_classes
        ? `events = filter_keyvals(events, "$category", ${cat_filter_str});`
        : ''
    }
  `;
}

const default_limit = 100; // Hardcoded limit per group

export function appQuery(appbucket: string, classes, filterCategories: string[][]): string[] {
  appbucket = appbucket.replace('"', '\\"');
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
    'Google-chrome',
    'chrome.exe',
    'Chromium',
    'Google Chrome',
    'Chromium-browser',
    'Chromium-browser-chromium',
    'Google-chrome-beta',
    'Google-chrome-unstable',
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
  edge: ['msedge.exe'],
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
       browser_events = sort_by_timestamp(concat(browser_events, events_${browserName}));`;
  });
  return code;
}

export function fullDesktopQuery(
  browserbuckets: string[],
  windowbucket: string,
  afkbucket: string,
  filterAFK = true,
  classes,
  filterCategories: string[][]
): string[] {
  // Escape `"`
  browserbuckets = _.map(browserbuckets, b => b.replace('"', '\\"'));
  windowbucket = windowbucket.replace('"', '\\"');
  afkbucket = afkbucket.replace('"', '\\"');

  // TODO: Get classes
  const params: DesktopQueryParams = {
    bid_window: windowbucket,
    bid_afk: afkbucket,
    bid_browsers: browserbuckets,
    classes: classes,
    filter_classes: filterCategories,
    filter_afk: filterAFK,
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

    ${browserEvents(params)}
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
    editorbucket = editorbucket.replace('"', '\\"');
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

export function dailyActivityQuery(afkbucket: string): string[] {
  afkbucket = afkbucket.replace('"', '\\"');
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;',
  ];
}

export function dailyActivityQueryAndroid(androidbucket: string): string[] {
  androidbucket = androidbucket.replace('"', '\\"');
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

export default {
  fullDesktopQuery,
  appQuery,
  dailyActivityQuery,
  dailyActivityQueryAndroid,
  editorActivityQuery,
};
