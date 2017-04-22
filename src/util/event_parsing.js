import moment from 'moment';

function sort_events_by_duration(eventlist){
  eventlist.sort(function(a,b){
    if (a['duration'] < b['duration'])
      return 1;
    else
      return -1;
  });
}

function parse_chunks_to_apps(chunks) {
  /*
    This code is ugly and somewhat complex, will hopefully be moved to aw-server in the future
  */
  var applist = [];
  for (var app in chunks){
    var titlelist = [];
    var titles = chunks[app]["data"]["title"]["values"];
    for (var title in titles){
      var t = { "title": title };
      if ("duration" in titles[title])
        t["duration"] = titles[title]["duration"]["value"];
      titlelist.push(t);
    }
    sort_events_by_duration(titlelist);
    var a = { "name": app };
    if ("duration" in chunks[app])
      a["duration"] = chunks[app]["duration"]["value"]
    applist.push(a);
  }
  sort_events_by_duration(applist);
  return applist;
}

function parse_eventlist_by_apps(eventlist){
  /*
    This code is ugly and somewhat complex, will hopefully be moved to aw-server in the future
  */
  var apptimeline = [];
  var prev_app = null;
  var curr_app = null;
  var curr_title = null;
  var curr_event = null;
  for (var event_i in eventlist){
    var event = eventlist[event_i];
    for (var label_i in event.label){
      curr_app = event.label;
      curr_title = event["data"]["title"]
    }
    if (curr_app != prev_app){
      if (prev_app != null){
        apptimeline.push(curr_event);
      }
      curr_event = {
        "appname": curr_app,
        "duration": 0,
        "timestamp": event["timestamp"],
        //"time": moment(event.timestamp).format('HH:mm:ss'), // This is cleaner, i do not know why it doesn't work though
        "time": moment(new Date(event.timestamp)).format('HH:mm:ss'),
        "titles": []
      };
    }
    curr_event["duration"] += event["duration"]["value"];
    curr_event["titles"].push({
      "title": curr_title,
      "duration": event["duration"]["value"],
      "timestamp": event["timestamp"]
    });

    prev_app = curr_app;
  }
  if (curr_event != null)
    apptimeline.push(curr_event);

  //console.log(apptimeline);
  return apptimeline
}

export default {
    sort_events_by_duration: sort_events_by_duration,
    parse_chunks_to_apps: parse_chunks_to_apps,
    parse_eventlist_by_apps: parse_eventlist_by_apps,
}
