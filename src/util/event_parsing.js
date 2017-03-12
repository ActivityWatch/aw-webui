import moment from 'moment';

module.exports = {
    parse_chunks_to_apps: function(chunks) {
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

      // Sort titles by duration
      for (var app in apps){
        apps[app]['titles'].sort(function(a,b){
          if (a['duration']['value'] < b['duration']['value'])
            return 1;
          else
            return -1;
        });
      }
      // Convert apps to a list and sort by duration
      var applist = [];
      for (var app in apps){
        applist.push(apps[app]);
      }
      applist.sort(function(a,b){
        if (a['duration']['value'] < b['duration']['value'])
          return 1;
        else
          return -1;
      });
      // Convert second duration human readable form
      for (var appi in applist){
        var app = applist[appi];
        //console.log(app);
        app['duration'] = app['duration']['value']
        for (var titlename in app['titles']){
          var title = app['titles'][titlename];
          title['duration'] = title['duration']['value']
        }
      }
      // Set list
      return applist
    },

    parse_eventlist_by_apps: function(eventlist){
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
          var labeltype = label.split(':')[0];
          var labelvalue = label.split(':')[1];
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

      // Change seconds duration to readable format
      /*
      for (var activity_i in apptimeline){
        var activity = apptimeline[activity_i];
        for (var title_i in activity.titles){
          var title = activity.titles[title_i];
          title["duration"] = time.seconds_to_duration(title["duration"]);
        }
        activity["duration"] = time.seconds_to_duration(activity["duration"]);

      }
      */
      //console.log(apptimeline);
      return apptimeline
    },
}
