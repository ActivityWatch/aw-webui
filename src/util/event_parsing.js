const _ = require('lodash');
const Moment = require('moment');
const MomentRange = require('moment-range');

const moment = MomentRange.extendMoment(Moment);

function _addRangeToEvent(e) {
    e.range = moment.range(moment(e.timestamp), moment(e.timestamp).add(e.duration, "seconds"));
}

function _filterPeriodIntersect(events, filterevents) {
    // Equivalent to aw_core.transforms.filter_period_intersect
    events = _.sortBy(events, (e) => e.timestamp);
    filterevents = _.sortBy(filterevents, (e) => e.timestamp);

    _.each(events, _addRangeToEvent);
    _.each(filterevents, _addRangeToEvent);

    let e_i = 0;
    let f_i = 0;

    let filteredEvents = [];
    while(e_i < events.length && f_i < filterevents.length) {
        let event = events[e_i];
        let filterevent = filterevents[f_i];

        let er = event.range;
        let fr = filterevent.range;

        let ir = er.intersect(fr);
        if(ir !== null) {
            event.range = ir;
            event.timestamp = ir.start;
            event.duration = ir.diff("seconds", true);
            filteredEvents.push(event);
            e_i += 1;
        } else {
            if(er.end <= fr.start) {
                e_i += 1;
            } else if(fr.end <= er.start) {
                f_i += 1;
            } else {
                console.warn("This state should be impossible");
                e_i += 1;
                f_i += 1;
            }
        }
    }

    return filteredEvents;
}

function filterAFKTime(events, afkevents) {
    afkevents = _.filter(afkevents, (e) => e.data.status == "not-afk");
    return _filterPeriodIntersect(events, afkevents);
}

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
        t["duration"] = titles[title]["duration"];
      titlelist.push(t);
    }
    sort_events_by_duration(titlelist);
    var a = { "name": app };
    if ("duration" in chunks[app])
      a["duration"] = chunks[app]["duration"]
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
    curr_app = event.data.app;
    curr_title = event.data.title;
    if (curr_app != prev_app){
      if (prev_app != null){
        apptimeline.push(curr_event);
      }
      curr_event = {
        "appname": curr_app,
        "duration": 0,
        //"time": moment(event.timestamp).format('HH:mm:ss'), // This is cleaner, i do not know why it doesn't work though
        "time": moment(new Date(event.timestamp)).format('HH:mm:ss'),
        "titles": []
      };
    }
    curr_event["duration"] += event.duration;
    curr_event["titles"].push({
      "title": curr_title,
      "duration": event.duration,
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
    filterAFKTime: filterAFKTime,
}
