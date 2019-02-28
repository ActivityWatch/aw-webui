import _ from 'lodash';

// TODO: Sanitize string input of buckets

// Helper function returning a query that defines a variable events_active
// that can be used to filter away non-active time.
// TODO: Handle events from all available browser buckets, as done in: https://github.com/ActivityWatch/aw-webui/pull/108
// TODO: Don't count audible as activity if window isn't active
function _events_active(afkbucket, browserbucket, audibleAsActive) {
  return (
    `events_active = [];
     events_afk = flood(query_bucket("${afkbucket}"));
     events_active = period_union(events_active, filter_keyvals(events_afk, "status", ["not-afk"]))`
  ) + (
    audibleAsActive ?
    `events_browser = flood(query_bucket("${browserbucket}"));
     events_audible = filter_keyvals(events_browser, "audible", [true]);
     events_active = period_union(events_active, events_audible);`
     : ''
  );
}

export function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK) {
  // TODO: Take into account audible browser activity (tricky)
  let code = (
    `events  = flood(query_bucket("${windowbucket}"));
     not_afk = flood(query_bucket("${afkbucket}"));
     not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);`
  ) + (
    filterAFK ?
    `not_afk = flood(query_bucket("' + afkbucket + '"));
     not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
     events  = filter_period_intersect(events, not_afk);`
    : ''
  ) + (
    `title_events  = merge_events_by_keys(events, ["app", "title"]);
     title_events  = sort_by_duration(title_events);
     app_events  = merge_events_by_keys(title_events, ["app"]);
     app_events  = sort_by_duration(app_events);
     events = sort_by_timestamp(events);
     app_chunks = chunk_events_by_key(events, "app");
     app_events  = limit_events(app_events, ${appcount});
     title_events  = limit_events(title_events, ${titlecount});
     duration = sum_durations(events);
     RETURN  = {"app_events": app_events, "title_events": title_events, "app_chunks": app_chunks, "duration": duration};`
  );
  let lines = code.split(";");
  return _.map(lines, (l) => l + ";");
}

export function appQuery(appbucket, limit) {
  limit = limit || 5;
  let code = (
    `events  = flood(query_bucket("${appbucket}"));`
  ) + (
    `events  = merge_events_by_keys(events, ["app"]);
    events  = sort_by_duration(events);
    events  = limit_events(events, ${limit});
    total_duration = sum_durations(events);
    RETURN  = {"events": events, "total_duration": total_duration};`
  );
  let lines = code.split(";");
  return _.map(lines, (l) => l + ";");
}

export function browserSummaryQuery(browserbucket, windowbucket, afkbucket, count, filterAFK, audibleAsActive) {
  var browser_appnames = "";
  if (browserbucket.endsWith("-chrome")){
    browser_appnames = JSON.stringify(["Google-chrome", "chrome.exe", "Chromium", "Google Chrome", "Chromium-browser", "Chromium-browser-chromium", "Google-chrome-beta", "Google-chrome-unstable"]);
  } else if (browserbucket.endsWith("-firefox")){
    browser_appnames = JSON.stringify(["Firefox", "Firefox.exe", "firefox", "firefox.exe", "Firefox Developer Edition", "Firefox Beta", "Nightly"]);
  }

  let code = (
    `events_browser = flood(query_bucket("${browserbucket}"));
     events_window_browser = filter_keyvals(flood(query_bucket("${windowbucket}")), "app", ${browser_appnames});`
  ) + (
    filterAFK ? _events_active(afkbucket, browserbucket, audibleAsActive) : ''
  ) + (
    `events_window_browser = filter_period_intersect(events_window_browser, events_active);
     events = filter_period_intersect(events, events_window_browser);
     events = split_url_events(events);
     urls = merge_events_by_keys(events, ["domain", "url"]);
     urls = limit_events(sort_by_duration(urls), ${count});
     domains = split_url_events(events);
     domains = merge_events_by_keys(domains, ["domain"]);
     domains = sort_by_duration(domains);
     domains = limit_events(domains, ${count});
     chunks = chunk_events_by_key(events, "domain");
     duration = sum_durations(events);
     RETURN = {"domains": domains, "urls": urls, "chunks": chunks, "duration": duration};`
  );
  let lines = code.split(";");
  return _.map(lines, (l) => l + ";");
}

export function editorActivityQuery (editorbucket, limit){
  let code = (
    `editorbucket = "${editorbucket}";
     events = flood(query_bucket(editorbucket));
     files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));
     files = limit_events(files, ${limit});
     languages = sort_by_duration(merge_events_by_keys(events, ["language"]));
     languages = limit_events(languages, ${limit});
     projects = sort_by_duration(merge_events_by_keys(events, ["project"]));
     projects = limit_events(projects, ${limit});
     duration = sum_durations(events);
     RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};`
  );
  let lines = code.split(";");
  return _.map(lines, (l) => l + ";");
}

export function dailyActivityQuery(afkbucket, browserbucket, audibleAsActive) {
  return _events_active(afkbucket, browserbucket, audibleAsActive).concat([
    'RETURN = events_active;'
  ]);
}

export function dailyActivityQueryAndroid(androidbucket) {
  return [
    `not_afk = sort_by_duration(flood(query_bucket('${androidbucket}')));`,
    'RETURN = limit_events(not_afk, 10);'
  ];
}

export default {
  windowQuery,
  browserSummaryQuery,
  appQuery,
  dailyActivityQuery,
  dailyActivityQueryAndroid,
  editorActivityQuery,
};
