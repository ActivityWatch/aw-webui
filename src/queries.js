import _ from 'lodash';

// TODO: Sanitize string input of buckets

export function summaryQuery(windowbucket, afkbucket, count) {
  windowbucket = windowbucket.replace('"', '\\"');
  afkbucket = afkbucket.replace('"', '\\"');
  let code = (
   `events  = flood(query_bucket("${windowbucket}"));
    not_afk = flood(query_bucket("${afkbucket}"));
    not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);
    events  = filter_period_intersect(events, not_afk);
    title_events  = merge_events_by_keys(events, ["app", "title"]);
    title_events  = sort_by_duration(title_events);
    app_events  = merge_events_by_keys(title_events, ["app"]);
    app_events  = sort_by_duration(app_events);
    app_events  = limit_events(app_events, ${count});
    title_events  = limit_events(title_events, ${count});
    RETURN  = {"app_events": app_events, "title_events": title_events};`
  );
  let lines = code.split(";");
  return _.map(lines, (l) => l + ";");
}

export function windowQuery(windowbucket, afkbucket, appcount, titlecount, filterAFK) {
  windowbucket = windowbucket.replace('"', '\\"');
  afkbucket = afkbucket.replace('"', '\\"');
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

export function browserSummaryQuery(browserbuckets, windowbucket, afkbucket, limit, filterAFK) {
  // Merge in progress
}

export function appQuery(appbucket, limit) {
  appbucket = appbucket.replace('"', '\\"');
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

export function editorActivityQuery(editorbucket, limit) {
  editorbucket = editorbucket.replace('"', '\\"');
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

export function dailyActivityQuery(afkbucket) {
  afkbucket = afkbucket.replace('"', '\\"');
  return [
    'afkbucket = "' + afkbucket + '";',
    'not_afk = flood(query_bucket(afkbucket));',
    'not_afk = merge_events_by_keys(not_afk, ["status"]);',
    'RETURN = not_afk;'
  ];
}

export function dailyActivityQueryAndroid(androidbucket) {
  androidbucket = androidbucket.replace('"', '\\"');
  return [
    `not_afk = sort_by_duration(flood(query_bucket("${androidbucket}")));`,
    'RETURN = limit_events(not_afk, 10);'
  ];
}

export default {
  summaryQuery,
  windowQuery,
  browserSummaryQuery,
  appQuery,
  dailyActivityQuery,
  dailyActivityQueryAndroid,
  editorActivityQuery,
};
