// TODO: Sanitize string input of buckets

function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK) {
  return [
    `events  = flood(query_bucket("${windowbucket}"));`,
    `not_afk = flood(query_bucket("${afkbucket}"));`,
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
  ].concat(filterAFK ? [
    'events  = filter_period_intersect(events, not_afk);',
  ] : []).concat([
    'title_events  = merge_events_by_keys(events, ["app", "title"]);',
    'title_events  = sort_by_duration(title_events);',
    'app_events  = merge_events_by_keys(title_events, ["app"]);',
    'app_events  = sort_by_duration(app_events);',

    'events = sort_by_timestamp(events);',
    'app_chunks = chunk_events_by_key(events, "app");',
    `app_events  = limit_events(app_events, ${appcount});`,
    `title_events  = limit_events(title_events, ${titlecount});`,
    'duration = sum_durations(events);',
    'RETURN  = {"app_events": app_events, "title_events": title_events, "app_chunks": app_chunks, "duration": duration};',
  ]);
}

function browserSummaryQuery(browserbucket, windowbucket, afkbucket, count, filterAFK) {
  let browserAppnames = '';
  if (browserbucket.endsWith('-chrome')) {
    browserAppnames = '["Google-chrome", "chrome.exe", "Chromium", "Google Chrome"]';
  } else if (browserbucket.endsWith('-firefox')) {
    browserAppnames = '["Firefox", "Firefox.exe", "firefox", "firefox.exe"]';
  }

  return [
    `events = flood(query_bucket("${browserbucket}"));`,
    `window_browser = flood(query_bucket("${windowbucket}"));`,
    `window_browser = filter_keyvals(window_browser, "app", ${browserAppnames});`,
  ].concat(filterAFK ? [
    `not_afk = flood(query_bucket("${afkbucket}"));`,
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'window_browser = filter_period_intersect(window_browser, not_afk);',
  ] : [])
    .concat([
      'events = filter_period_intersect(events, window_browser);',
      'events = split_url_events(events);',
      'urls = merge_events_by_keys(events, ["domain", "url"]);',
      'urls = sort_by_duration(urls);',
      `urls = limit_events(urls, ${count});`,
      'domains = split_url_events(events);',
      'domains = merge_events_by_keys(domains, ["domain"]);',
      'domains = sort_by_duration(domains);',
      `domains = limit_events(domains, ${count});`,
      'chunks = chunk_events_by_key(events, "domain");',
      'duration = sum_durations(events);',
      'RETURN = {"domains": domains, "urls": urls, "chunks": chunks, "duration": duration};',
    ]);
}

function editorActivityQuery(editorbucket, limit) {
  return [
    `editorbucket = "${editorbucket}";`,
    'events = flood(query_bucket(editorbucket));',
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    `files = limit_events(files, ${limit});`,
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    `languages = limit_events(languages, ${limit});`,
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    `projects = limit_events(projects, ${limit});`,
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};',
  ];
}

function dailyActivityQuery(afkbucket) {
  return [
    `afkbucket = "${afkbucket}";`,
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;',
  ];
}

module.exports = {
  windowQuery,
  browserSummaryQuery,
  editorActivityQuery,
  dailyActivityQuery,
};
