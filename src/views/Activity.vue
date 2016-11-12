<template lang="jade">
h2 Window Activity {{ date }}

hr
p Viewname: {{ viewname }}
button(v-on:click="queryDate(getPrevDay(date))") Previous day
button(v-on:click="queryDate(getNextDay(date))") Next day

hr

h3(style="color: red;") {{ errormsg }}

accordion(:one-at-atime="false")
  panel(v-for="app in appsummary", :header="app.name + '  (' + app.duration + ')'", :is-open="false")
    table
      tr(v-for="(index, title) in app.titles")
        td {{ title.duration }}
        td {{ title.name }}

accordion
  panel(v-for="activity in apptimeline", :header="activity.app + '  (' + activity.duration + ')'", :footer="activity.timestamp+'test'", :is-open="false")
    p Timestamp: {{ activity.timestamp }}
    table
      tr(v-for="title_entry in activity.titles")
        td {{ title_entry.duration }}
        td {{ title_entry.title }}

hr

p Showing activity between {{ starttime }} and {{ endtime }}

p Events queried: {{ eventcount }}

</template>

<style lang="scss">

</style>

<script>
import Resources from '../resources.js';

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
      viewname: "",
      starttime: "",
      endtime: "",
      eventcount: 0,
      appsummary: [],
      apptimeline: [],
      chunks: {},
      eventlist: [],
      date: null,
      datestartstr: "",
      dateendstr: "",
      errormsg: "",
    }
  },

  ready: function() {
    // Date
    var date = this.$route.params.date;
    if (date == undefined){
      date = new Date().toISOString();
    }
    this.setDay(date)
    // Create View
    var type = this.$route.params.type;
    var host = this.$route.params.host;
    var view = {"type": type, "host": host}

    this.$set("viewname", "aw-webui_" + type + "_" + host);
    if (type == "windowactivity_summary"){
      var query = this.windowSummaryQuery("aw-watcher-window_"+host, "aw-watcher-afk_"+host);
      $CreateView.save({viewname: this.viewname}, {'query': query}).then((response) => {
        var data = response.json();
        this.query();
      });
    }
    else if (type == "windowactivity_timeline"){
      var query = this.windowTimelineQuery("aw-watcher-window_"+host, "aw-watcher-afk_"+host);
      $CreateView.save({viewname: this.viewname}, {'query': query}).then((response) => {
        var data = response.json();
        this.query();
      });
    }
    else {
      this.$set("errormsg", "Unknown viewtype '"+type+"'");
    }
  },

  methods: {
    queryDate: function(date){
      this.setDay(date);
      this.query();
    },
    query: function(viewname){
      $QueryView.get({"viewname": this.viewname, "limit": -1, "start": this.datestartstr, "end": this.dateendstr}).then((response) => {
        var data = response.json();
        //console.log(data);
        this.$set("chunks", data["chunks"]);
        this.$set("eventlist", data["eventlist"]);
        this.$set("eventcount", data["eventcount"]);
        this.parseChunksToApps(this.chunks);
        this.parseEventListToApps(this.eventlist);
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
            "app": curr_app,
            "duration": 0,
            "timestamp": event["timestamp"],
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
      for (var activity_i in apptimeline){
        var activity = apptimeline[activity_i];
        for (var title_i in activity.titles){
          var title = activity.titles[title_i];
          title["duration"] = this.secondsToDuration(title["duration"]);
        }
        activity["duration"] = this.secondsToDuration(activity["duration"]);

      }
      //console.log(apptimeline);
      this.$set("apptimeline", apptimeline);
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
        console.log(app);
        app['duration'] = this.secondsToDuration(app['duration']['value']);
        for (var titlename in app['titles']){
          var title = app['titles'][titlename];
          title['duration'] = this.secondsToDuration(title['duration']['value']);
        }
      }
      // Set list
      this.$set("appsummary", applist);
    },


    /*

        Date/time functions

    */


    setDay: function(datestr){
      var datestart = this.getDay(datestr);
      // End time of date
      var dateend = new Date(datestart);
      dateend.setDate(dateend.getDate()+1);
      dateend = new Date(dateend-1);

      var timezonediff = datestart.getTimezoneOffset()*60*1000;
      this.$set("date", this.timeToDateStr(new Date(datestart-timezonediff)));

      this.$set("starttime", datestart);
      this.$set("endtime", dateend);

      // Convert to iso8601
      this.$set("datestartstr", this.starttime.toISOString());
      this.$set("dateendstr", this.endtime.toISOString());
    },

    timeToDateStr: function(date){
      var mystr = date.toISOString().substring(0,10);
      return mystr;
    },

    getDay: function(datestr){
      // Get start time of date
      var datestart = new Date(Date.parse(datestr));
      datestart.setHours(0);
      datestart.setMinutes(0);
      datestart.setSeconds(0);
      datestart.setMilliseconds(0);

      return datestart;
    },

    getPrevDay(datestr){
      var datestart = this.getDay(datestr);
      var timezonediff = datestart.getTimezoneOffset()*60*1000;
      var prev_date = new Date(datestart.getTime()-daylength-timezonediff);
      return prev_date;
    },

    getNextDay(datestr){
      var datestart = this.getDay(datestr);
      var timezonediff = datestart.getTimezoneOffset()*60*1000;
      var next_date = new Date(datestart.getTime()+daylength-timezonediff);
      return next_date;

    },

    secondsToDuration: function(seconds){
        var result = "";
        var hrs = Math.floor(seconds/60/60);
        var min = Math.floor(seconds/60%60);
        var sec = Math.floor(seconds%60);
        if (hrs != 0)
            result += hrs + "h";
        if (hrs != 0 || min != 0)
            result += min + "m";
        if (hrs == 0)
            result += sec + "s";
        return result;
    },


  },
}
</script>
