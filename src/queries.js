import _ from 'lodash';

// TODO: Sanitize string input of buckets

function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK) {
  let code = (
    `events  = flood(query_bucket("${windowbucket}"));
     not_afk = flood(query_bucket("${afkbucket}"));
     not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);`
  ) + (
    filterAFK ? 'events  = filter_period_intersect(events, not_afk);' : ''
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

function browserSummaryQuery(browserbucket, windowbucket, afkbucket, count, filterAFK) {
  var query = [];
  // if it's a list, then add all browsers names.
  if(!!browserbucket && browserbucket.constructor === Array){
    var chrome_bucket;
    var firefox_bucket;
    var chrome_appnames = '["Google-chrome", "chrome.exe", "Chromium", "Google Chrome", "Chromium-browser-chromium"]'; 
    var firefox_appnames = '["Firefox", "Firefox.exe", "firefox", "firefox.exe"]';
    if(browserbucket[0].indexOf("chrome") !== -1){
      chrome_bucket = browserbucket[0];
      firefox_bucket = browserbucket[1];
    }
    else{
      chrome_bucket = browserbucket[1];
      firefox_bucket = browserbucket[0];
    }
    query = [
    'events_chrome = flood(query_bucket("' + chrome_bucket + '"));',
    'events_firefox = flood(query_bucket("' + firefox_bucket + '"));',
    'window_browser = flood(query_bucket("' + windowbucket + '"));',
    'window_chrome = filter_keyvals(window_browser, "app", ' + chrome_appnames + ');',
    'window_firefox = filter_keyvals(window_browser, "app", ' + firefox_appnames + ');',]
    .concat(filterAFK ? [
    'not_afk = flood(query_bucket("' + afkbucket + '"));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'window_chrome = filter_period_intersect(window_chrome, not_afk);',
    'window_firefox = filter_period_intersect(window_firefox, not_afk);',
    ] : [])
    .concat([
    'events_chrome = filter_period_intersect(events_chrome, window_chrome);',
    'events_chrome = split_url_events(events_chrome);',
    'events_firefox = filter_period_intersect(events_firefox, window_firefox);',
    'events_firefox = split_url_events(events_firefox);',
    'events = sum_event_lists(events_chrome, events_firefox);',]);
  } 
  else{
    var browser_appnames = "";
    if (browserbucket.endsWith("-chrome")){
    browser_appnames = '["Google-chrome", "chrome.exe", "Chromium", "Google Chrome", "Chromium-browser-chromium"]';
    } else if (browserbucket.endsWith("-firefox")){
    browser_appnames = '["Firefox", "Firefox.exe", "firefox", "firefox.exe"]';
    }
    query = ['events = flood(query_bucket("' + browserbucket + '"));',
    'window_browser = flood(query_bucket("' + windowbucket + '"));',
    'window_browser = filter_keyvals(window_browser, "app", ' + browser_appnames + ');',]
    .concat(filterAFK ? [
    'not_afk = flood(query_bucket("' + afkbucket + '"));',
    'not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);',
    'window_browser = filter_period_intersect(window_browser, not_afk);',
    ] : [])
    .concat([
      'events = filter_period_intersect(events, window_browser);',
      'events = split_url_events(events);',]);
  }
  return query.concat([
    'urls = merge_events_by_keys(events, ["domain", "url"]);',
    'urls = sort_by_duration(urls);',
    'urls = limit_events(urls, ' + count + ');',
    'domains = split_url_events(events);',
    'domains = merge_events_by_keys(domains, ["domain"]);',
    'domains = sort_by_duration(domains);',
    'domains = limit_events(domains, ' + count + ');',
    'chunks = chunk_events_by_key(events, "domain");',
    'duration = sum_durations(events);',
    'RETURN = {"domains": domains, "urls": urls, "chunks": chunks, "duration": duration};',
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
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};'
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
