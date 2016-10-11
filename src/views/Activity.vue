<template lang="jade">
h1(style="color: red;") (IN DEVELOPMENT)
h2 Window Activity {{ date }}

hr
p Viewname: {{ viewname }}
p Prev day: {{ prev_date }}
p Next day: {{ next_date }}
button(v-on:click="queryDate(prev_date)") Previous day
button(v-on:click="queryDate(next_date)") Next day

hr

h3(style="color: red;") {{ errormsg }}

p Showing activity between {{ starttime }} and {{ endtime }}

div
  p Eventcount: {{ eventcount }}
div(v-for="app in apps")
  h4 {{ app.name }}
  p Total: {{ app.duration }}
  table
    tr(v-for="(intex, title) in app.titles")
      td {{ title.duration }}
      td | {{ title.name }}


</template>

<style lang="scss">

</style>

<script>
import Resources from '../resources.js';

let $EventChunk = Resources.$EventChunk;
let $QueryView  = Resources.$QueryView;
let $CreateView  = Resources.$CreateView;
let $Bucket  = Resources.$Bucket;

export default {
  name: "Activity",
  data: () => {
    return {
      viewname: "",
      starttime: "",
      endtime: "",
      eventcount: 0,
      apps: {},
      chunks: {},
      prev_date: "",
      date: "",
      next_date: "",
      errormsg: "",
    }
  },
  ready: function() {
    // Date
    var date = this.$route.params.date;
    if (date == undefined){
      date = new Date().toISOString();
    }
    this.loadDay(date)
    // Create View
    var type = this.$route.params.type;
    var host = this.$route.params.host;
    var view = {"type": type, "host": host}
    
    if (type == "windowactivity"){
      this.$set("viewname", "aw-webui_" + type + "_" + host);
      var query = this.windowactivityQuery("aw-watcher-window_"+host, "aw-watcher-afk_"+host);
      this.createView(this.viewname, query);
    }
    else {
      this.$set("errormsg", "Unknown viewtype '"+type+"'");
    }
  },
  methods: {
    createView: function(viewname, query, callback){
      $CreateView.save({viewname: viewname}, {'query': query}).then((response) => {
        var data = response.json();
        this.query();
      });
    },
    queryDate: function(date){
      this.loadDay(date);
      this.query();
    },
    query: function(viewname){
      $QueryView.get({"viewname": this.viewname, "limit": -1, "start": this.datestartstr, "end": this.dateendstr}).then((response) => {
        var data = response.json();
        //console.log(data);
        this.chunks = data['chunks'];
        this.$set("chunks", this.chunks);
        this.eventcount = data['eventcount'];
        this.$set("eventcount", this.eventcount);
        this.parseChunksToApps(this.chunks);
      });
    },
    windowactivityQuery: function(windowbucket, afkbucket){
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
    timeToDateStr: function(date){
      var mystr = date.toISOString().substring(0,10);
      return mystr;
    },
    loadDay: function(date){
      // Get start time of date
      var datestart = new Date(Date.parse(date));
      datestart.setHours(0);
      datestart.setMinutes(0);
      datestart.setSeconds(0);
      datestart.setMilliseconds(0);
      // End time of date
      var dateend = new Date(datestart);
      dateend.setDate(dateend.getDate()+1);
      dateend = new Date(dateend-1);

      // Help vars
      var daylength = 86400000;
      var timezonediff = datestart.getTimezoneOffset()*60*1000;
      // Yeserday
      var prev_date = new Date(datestart.getTime()-daylength-timezonediff);
      // Tomorrow
      var next_date = new Date(datestart.getTime()+daylength-timezonediff);

      this.$set("prev_date", this.timeToDateStr(prev_date));
      this.$set("date", this.timeToDateStr(new Date(datestart-timezonediff)));
      this.$set("next_date", this.timeToDateStr(next_date));
      
      this.$set("starttime", datestart);
      this.$set("endtime", dateend);

      // Convert to iso8601
      this.datestartstr = datestart.toISOString();
      this.dateendstr = dateend.toISOString();
    },
    parseChunksToApps: function(chunks) {
      /*
        This code is ugly and unnecessarily complex, will hopefully be moved to aw-server in the future
      */
      // Parse chunks
      var applabels = []; // [name, full label]
      var titlelabels = []; // [name, full label]
      for (var label in chunks){
        var labeltype = label.split(':')[0];
        var labelvalue = label.split(':')[1];
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
          var sublabeltype = sublabel.split(':')[0];
          var sublabelvalue = sublabel.split(':')[1];
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
      // Convert second duration human readable form
      for (var appname in apps){
        var app = apps[appname];
        app['duration'] = this.secondsToDuration(app['duration']['value']);
        for (var titlename in app['titles']){
          var title = app['titles'][titlename];
          title['duration'] = this.secondsToDuration(title['duration']['value']);
        }
      }
      this.$set("apps", apps);
    },
  },
}
</script>
