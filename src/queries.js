// TODO: Sanitize string input of buckets

function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK) {
  return [
    'events  = flood(query_bucket("' + windowbucket + '"));',
  ].concat(filterAFK ? [
    'not_afk = flood(query_bucket("' + afkbucket + '"));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'events  = filter_period_intersect(events, not_afk);',
  ] : []).concat([
    'title_events  = merge_events_by_keys(events, ["app", "title"]);',
    'title_events  = sort_by_duration(title_events);',
    'app_events  = merge_events_by_keys(title_events, ["app"]);',
    'app_events  = sort_by_duration(app_events);',

    'events = sort_by_timestamp(events);',
    'app_events  = limit_events(app_events, ' + appcount + ');',
    'title_events  = limit_events(title_events, ' + titlecount + ');',

    'RETURN  = [events, not_afk, app_events, title_events];',
  ]);
}

function browserSummaryQuery(browserbucket, windowbucket, afkbucket, count, filterAFK) {
  var browser_appnames = "";
  if (browserbucket.endsWith("-chrome")){
    browser_appnames = '["Google-chrome", "chrome.exe", "Chromium", "Google Chrome"]';
  } else if (browserbucket.endsWith("-firefox")){
    browser_appnames = '["Firefox", "Firefox.exe", "firefox"]';
  }

  return [
    'events = flood(query_bucket("' + browserbucket + '"));',
    'window_browser = flood(query_bucket("' + windowbucket + '"));',
    'window_browser = filter_keyvals(window_browser, "app", ' + browser_appnames + ');',
  ].concat(filterAFK ? [
    'not_afk = flood(query_bucket("' + afkbucket + '"));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'window_browser = filter_period_intersect(window_browser, not_afk);',
  ] : [])
  .concat([
    'events = filter_period_intersect(events, window_browser);',
    'events = split_url_events(events);',
    'events = merge_events_by_keys(events, ["domain"]);',
    'events = sort_by_duration(events);',
    'events = limit_events(events, ' + count + ');',
    'RETURN = events;',
  ]);
}

function editorActivityQuery (editorbucket, limit){
  return [
    'editorbucket = "' + editorbucket + '";',
    'events = flood(query_bucket(editorbucket));',
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    'files = limit_events(files, ' + limit + ');',
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    'languages = limit_events(languages, ' + limit + ');',
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    'projects = limit_events(projects, ' + limit + ');',
    'RETURN = {"files": files, "languages": languages, "projects": projects};'
  ];
}

function dailyActivityQuery (afkbucket){
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;'
  ];
}

module.exports = {
    "windowQuery": windowQuery,
    "browserSummaryQuery": browserSummaryQuery,
    "editorActivityQuery": editorActivityQuery,
    "dailyActivityQuery": dailyActivityQuery,
}
