<template lang="jade">
h2 Window Activity {{ datestr }}

button(v-on:click="queryDate(time.get_prev_day(date))") Previous day
button(v-on:click="queryDate(time.get_next_day(date))") Next day

hr

h3(style="color: red;") {{ errormsg }}

h4 Total time: {{ duration }}

hr

h4 Summary

accordion(:one-at-atime="false")
  panel(v-for="app in appsummary", :header="app.name + '  (' + app.duration + ')'", :is-open="false")
    table
      tr(v-for="(index, title) in app.titles")
        td {{ title.duration }}
        td {{ title.name }}

hr

h4 Timeline

div#timeline

hr

p Showing activity for: {{ date }}

p Events queried: {{ eventcount }}

</template>

<style lang="scss">

</style>

<script>
import Resources from '../resources.js';
import moment from 'moment';
import renderTimeline from '../visualizations/timeline.js';
var time = require("../util/time.js");

var panel = require('vue-strap').panel;
var accordion = require('vue-strap').accordion;

let $EventChunk = Resources.$EventChunk;
let $QueryView  = Resources.$QueryView;
let $CreateView  = Resources.$CreateView;
let $Bucket  = Resources.$Bucket;

var daylength = 86400000;

export default {
  name: "Activity",
  components: {
    'panel': panel,
    'accordion': accordion
  },
  data: () => {
    return {
      host: "",
      duration: "",
      eventcount: 0,
      appsummary: [],
      apptimeline: [],
      date: null,
      time: time,
      datestr: "",
      errormsg: "",
    }
  },

  ready: function() {
    // Set host
    this.$set("host", this.$route.params.host);

    // Date
    var date = this.$route.params.date;
    if (date == undefined){
      date = new Date().toISOString();
    }
    this.queryDate(date)
  },

  methods: {
    queryDate: function(date){
      this.setDay(date);
      this.query();
    },
    query: function(){
      console.log(this.$route.params)
      var window_bucket_name = "aw-watcher-window_"+this.host;
      var afk_bucket_name = "aw-watcher-afk_"+this.host;

      var summary_view_name = "windowactivity_summary@"+this.host;
      var query = this.windowSummaryQuery(window_bucket_name, afk_bucket_name);
      $CreateView.save({viewname: summary_view_name}, {'query': query}).then((response) => {
        var data = response.json();
        this.queryView(summary_view_name);
      });

      var timeline_view_name = "windowactivity_timeline@"+this.host;
      var query = this.windowTimelineQuery("aw-watcher-window_"+this.host, "aw-watcher-afk_"+this.host);
      $CreateView.save({viewname: timeline_view_name}, {'query': query}).then((response) => {
        var data = response.json();
        this.queryView(timeline_view_name);
      });
    },
    queryView: function(viewname){
      $QueryView.get({"viewname": viewname, "limit": -1, "start": moment(this.date).format(), "end": moment(this.date).add(1, 'days').format()}).then((response) => {
        console.log(viewname)
        var data = response.json();
        var chunks = data["chunks"];
        var eventlist = data["eventlist"];
        this.$set("duration", time.seconds_to_duration(data["duration"]["value"]));
        this.$set("eventcount", data["eventcount"]+this.eventcount);
        if (chunks != undefined)
          this.parseChunksToApps(chunks);
        if (eventlist != undefined)
          this.parseEventListToApps(eventlist);
      });
    },


    windowTimelineQuery: function(windowbucket, afkbucket){
      return {
        'chunk': false,
        'transforms':
        [
          {
            'bucket': windowbucket,
            'filters': [
              {
                'name': 'timeperiod_intersect',
                'transforms':
                [
                  {
                    'bucket': afkbucket,
                    'filters':
                    [
                      {
                        'name': 'include_labels',
                        'labels': ['not-afk'],
                      },
                    ]
                  },
                ]
              },
            ],
          },
        ]
      };
    },


    windowSummaryQuery: function(windowbucket, afkbucket){
      return {
        'chunk': true,
        'transforms':
        [
          {
            'bucket': windowbucket,
            'filters': [
              {
                'name': 'timeperiod_intersect',
                'transforms':
                [
                  {
                    'bucket': afkbucket,
                    'filters':
                    [
                      {
                        'name': 'include_labels',
                        'labels': ['not-afk'],
                      },
                    ]
                  },
                ]
              },
            ],
          },
        ]
      };
    },

    /*

        Parsers

    */

    parseEventListToApps: function(eventlist){
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
      this.$set("apptimeline", apptimeline);
      var e = document.getElementById("timeline")
      renderTimeline(e, apptimeline);
    },


    parseChunksToApps: function(chunks) {
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
        app['duration'] = time.seconds_to_duration(app['duration']['value']);
        for (var titlename in app['titles']){
          var title = app['titles'][titlename];
          title['duration'] = time.seconds_to_duration(title['duration']['value']);
        }
      }
      // Set list
      this.$set("appsummary", applist);
    },

    setDay: function(datestr){
      this.$set("date", time.get_day_start(datestr));
      this.$set("datestr", this.date.format('YY-MM-DD'));
    },
  },
}
</script>
