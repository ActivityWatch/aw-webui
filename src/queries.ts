import _ from 'lodash';

// TODO: Sanitize string input of buckets

function querystr_to_array(querystr: string): string[] {
  return querystr
    .split(';')
    .filter(l => l)
    .map(l => l + ';');
}

interface QueryParams {
  bid_window: string;
  bid_afk: string;
  bid_browsers?: string[];
  filter_afk: boolean;
  include_audible?: boolean;
  classes: Record<string, any>;
}

// Constructs a query that returns a fully-detailed list of events from the merging of several sources (window, afk, web).
// Puts it's results in `not_afk` and `events`.
function canonicalEvents(params: QueryParams): string {
  return `
    events  = flood(query_bucket("${params.bid_window}"));
    not_afk = flood(query_bucket("${params.bid_afk}"));
    not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
    ${params.filter_afk
      ? 'events  = filter_period_intersect(events, not_afk);'
      : ''}
  `;
}

export function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK, classes, filterCategories: string[][]): string[] {
  windowbucket = windowbucket.replace('"', '\\"');
  afkbucket = afkbucket.replace('"', '\\"');
  const params: QueryParams = { bid_window: windowbucket, bid_afk: afkbucket, classes: classes, filter_afk: filterAFK };
  const code =
    `
      ${canonicalEvents(params)}
      events = categorize(events, ${JSON.stringify(params.classes)});
    `
      +
        (filterCategories ? `events = filter_keyvals(events, "$category", ${JSON.stringify(filterCategories)});` : '')
      +
    `
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    events = sort_by_timestamp(events);
    app_events  = limit_events(app_events, ${appcount});
    title_events  = limit_events(title_events, ${titlecount});
    duration = sum_durations(events);
    RETURN  = {"app_events": app_events, "title_events": title_events, "cat_events": cat_events, "duration": duration, "active_events": not_afk};`;
  return querystr_to_array(code);
}

export function appQuery(appbucket: string, limit = 5): string[] {
  appbucket = appbucket.replace('"', '\\"');
  const code = `
    events  = query_bucket("${appbucket}");
    events  = merge_events_by_keys(events, ["app"]);
    events  = sort_by_duration(events);
    events  = limit_events(events, ${limit});
    total_duration = sum_durations(events);
    RETURN  = {"events": events, "total_duration": total_duration};
  `;
  return querystr_to_array(code);
}

const appnames = {
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
    "firefoxdeveloperedition",
    'Firefox Beta',
    'Nightly',
  ],
  opera: ['opera.exe', 'Opera'],
  brave: ['brave.exe'],
  vivaldi: [
    'Vivaldi-stable',
    'Vivaldi-snapshot',
    'vivaldi.exe',
  ],
};

// Returns a list of (browserName, bucketId) pairs for found browser buckets
function browsersWithBuckets(browserbuckets: string[]): [string, string][] {
  const browsername_to_bucketid: [string, string|undefined][] = _.map(Object.keys(appnames), browserName => {
    const bucketId = _.find(browserbuckets, bucket_id => _.includes(bucket_id, browserName));
    return [browserName, bucketId];
  });
  // Skip browsers for which a bucket couldn't be found
  return _.filter(browsername_to_bucketid, ([, bucketId]) => bucketId !== undefined);
}

// Returns a list of active browser events (where the browser was the active window) from all browser buckets
function browserEvents(params: QueryParams): string {
  // If multiple browser buckets were found
  // AFK filtered later in the process
  let code = `
    ${canonicalEvents({...params, filter_afk: false})}
    window = events;
    events = [];
  `;

  _.each(browsersWithBuckets(params.bid_browsers), ([browserName, bucketId]) => {
    const appnames_str = JSON.stringify(appnames[browserName]);
    code +=
      `events_${browserName} = flood(query_bucket("${bucketId}"));
       window_${browserName} = filter_keyvals(window, "app", ${appnames_str});
       ${params.filter_afk
         ? `window_${browserName} = filter_period_intersect(window_${browserName}, not_afk);`
         : ''}
       events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
       events_${browserName} = split_url_events(events_${browserName});
       events = sort_by_timestamp(concat(events, events_${browserName}));`;
  });
  return code;
}

export function browserSummaryQuery(browserbuckets: string[], windowbucket: string, afkbucket: string, limit = 5, filterAFK = true): string[] {
  // Escape `"`
  browserbuckets = _.map(browserbuckets, b => b.replace('"', '\\"'));
  windowbucket = windowbucket.replace('"', '\\"');
  afkbucket = afkbucket.replace('"', '\\"');

  // TODO: Get classes
  const params: QueryParams = { bid_window: windowbucket, bid_afk: afkbucket, bid_browsers: browserbuckets, classes: {}, filter_afk: filterAFK };

  return querystr_to_array(
   `${browserEvents(params)}
    urls = merge_events_by_keys(events, ["url"]);
    urls = sort_by_duration(urls);
    urls = limit_events(urls, ${limit});
    domains = split_url_events(events);
    domains = merge_events_by_keys(domains, ["$domain"]);
    domains = sort_by_duration(domains);
    domains = limit_events(domains, ${limit});
    duration = sum_durations(events);
    RETURN = {"domains": domains, "urls": urls, "duration": duration};`);
}

export function editorActivityQuery(editorbuckets: string[], limit): string[] {
  let q = ['events = [];'];
  for (let editorbucket of editorbuckets) {
    editorbucket = editorbucket.replace('"', '\\"');
    q.push('events = concat(events, flood(query_bucket("' + editorbucket + '")));');
  }
  q = q.concat([
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    'files = limit_events(files, ' + limit + ');',
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    'languages = limit_events(languages, ' + limit + ');',
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    'projects = limit_events(projects, ' + limit + ');',
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};'
  ]);
  return q;
}

export function dailyActivityQuery(afkbucket: string): string[] {
  afkbucket = afkbucket.replace('"', '\\"');
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;',
  ];
}

export function dailyActivityQueryAndroid(androidbucket: string): string[] {
  androidbucket = androidbucket.replace('"', '\\"');
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

export default {
  windowQuery,
  browserSummaryQuery,
  appQuery,
  dailyActivityQuery,
  dailyActivityQueryAndroid,
  editorActivityQuery,
};
