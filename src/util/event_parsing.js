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
  // Parse chunks
  var applabels = []; // [name, full label]
  var titlelabels = []; // [name, full label]
  for (var label in chunks){
    var slice_i = label.indexOf(':')
    var labeltype = label.slice(0,slice_i);
    var labelvalue = label.slice(slice_i+1);
    if (chunks[label]['duration'] === undefined){
      console.error("Chunk has no duration: "+Object.keys(chunks[label]));
    }
    else if (labeltype == "appname"){
      applabels.push([labelvalue, label]);
    }
    else if (labeltype == "title"){
      titlelabels.push([labelvalue, label]);
    }
  }
  //console.log(applabels);
  //console.log(titlelabels);

  // Add apps
  var apps = {};
  for (var i in applabels){
    var name = applabels[i][0];
    var label = applabels[i][1];
    apps[name] = {
      'name':     name,
      'duration': chunks[label]['duration'],
      'titles': [],
    };
  }
  //console.log(apps);

  // Add titles
  for (var i in titlelabels){
    var name = titlelabels[i][0];
    var label = titlelabels[i][1];
    // Find appname from sublabels
    var appname = null;
    for (var i in chunks[label]['other_labels']){
      var sublabel = chunks[label]['other_labels'][i];
      var slice_i = sublabel.indexOf(':');
      var sublabeltype = sublabel.slice(0,slice_i);
      var sublabelvalue = sublabel.slice(slice_i+1);
      if (sublabeltype == "appname" && sublabelvalue in apps){
        appname = sublabelvalue;
      }
    }
    if (appname){
      apps[appname]['titles'].push({
        'name': name,
        'duration': chunks[label]['duration'],
      });
      //console.log("Added title to "+appname+": "+name);
    }
  }
  //console.log(apps);

  // Convert apps to a list and sort by duration
  var applist = [];
  for (var app in apps){
    applist.push(apps[app]);
  }
  // Set duration to seconds
  for (var appi in applist){
    var app = applist[appi];
    app['duration'] = app['duration']['value']
    for (var titlename in app['titles']){
      var title = app['titles'][titlename];
      title['duration'] = title['duration']['value']
    }
  }
  // Sort apps and titles by duration
  sort_events_by_duration(applist);
  for (var appi in applist){
    var app = applist[appi];
    sort_events_by_duration(app.titles)
  }
  // Set list
  return applist
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
      var label = event.label[label_i];
      var slice_i = label.indexOf(':')
      var labeltype = label.slice(0,slice_i);
      var labelvalue = label.slice(slice_i+1);
      if (labeltype == "appname"){
        curr_app = labelvalue;
      }
      else if (labeltype == "title"){
        curr_title = labelvalue;
      }
    }
    //console.log("Parsing "+curr_app+"-"+curr_title);
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
    curr_event["duration"] += event["duration"][0]["value"];
    curr_event["titles"].push({
      "title": curr_title,
      "duration": event["duration"][0]["value"],
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
