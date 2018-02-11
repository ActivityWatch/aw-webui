import moment from 'moment';

function parse_eventlist_by_apps(eventlist) {
  /*
    This code is ugly and somewhat complex, will hopefully be moved to aw-server in the future
  */
  var apptimeline = [];
  var prev_app = null;
  var curr_app = null;
  var curr_title = null;
  var curr_event = null;
  for (var event_i in eventlist) {
    var event = eventlist[event_i];
    curr_app = event.data.app;
    curr_title = event.data.title;
    if (curr_app != prev_app) {
      if (prev_app != null) {
        apptimeline.push(curr_event);
      }
      curr_event = {
        appname: curr_app,
        duration: 0,
        //"time": moment(event.timestamp).format('HH:mm:ss'), // This is cleaner, i do not know why it doesn't work though
        time: moment(new Date(event.timestamp)).format('HH:mm:ss'),
        titles: [],
      };
    }
    curr_event['duration'] += event.duration;
    curr_event['titles'].push({
      title: curr_title,
      duration: event.duration,
      timestamp: event['timestamp'],
    });

    prev_app = curr_app;
  }
  if (curr_event != null) apptimeline.push(curr_event);

  //console.log(apptimeline);
  return apptimeline;
}

export default {
  parse_eventlist_by_apps: parse_eventlist_by_apps,
};
