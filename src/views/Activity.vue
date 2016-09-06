<template lang="jade">
h1(style="color: red;") (IN DEVELOPMENT)
h2 Window Activity Today

hr

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

export default {
  name: "Activity",
  data: () => {
    return {
      starttime: "",
      endtime: "",
      eventcount: 0,
      apps: {},
      chunks: {},
    }
  },
  methods: {
    createView: function(viewname, starttime, endtime){
      $CreateView.save({viewname: viewname}, {
        'query':
        {
          'chunk': true,
          'transforms': 
          [
            {  // TODO: Remove hardcoding
              'bucket': "aw-watcher-window-testing_johan-desktop",
              'filters':
              [
                {
                  'name': 'timeperiod_intersect',
                  'transforms':
                  [
                    {   // TODO: Remove hardcoding
                      'bucket': 'aw-watcher-afk-testing_johan-desktop',
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
        }
      }).then((response) => {
        var data = response.json();
        this.queryView(viewname, starttime, endtime);
      });
    },

    queryView: function(viewname, starttime, endtime){
      $QueryView.get({"viewname": viewname, "limit": -1, "start": starttime, "end": endtime}).then((response) => {
        var data = response.json();
        console.log(data);
        this.chunks = data['chunks'];
        this.$set("chunks", this.chunks);
        this.eventcount = data['eventcount'];
        this.$set("eventcount", this.eventcount);
        this.parseChunksToApps(this.chunks);
      });
    },
    
    parseChunksToApps: function(chunks) {
      // Parse chunks
      var applabels = []; // [name, full label]
      var titlelabels = []; // [name, full label]
      for (var label in chunks){
        var labeltype = label.split(':')[0];
        var labelvalue = label.split(':')[1];
        if (labeltype == "appname"){
          applabels.push([labelvalue, label]);
        }
        if (labeltype == "title"){
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
      console.log(apps);

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
          })
      }
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
    secondsToDuration: function(seconds){
        var result = "";
        var hrs = Math.floor(seconds/60/60);
        var min = Math.floor(seconds/60%60);
        var sec = Math.floor(seconds%60);
        if (hrs != 0)
            result += hrs + "h";
        if (min != 0)
            result += min + "m";
        if (sec != 0 && hrs == 0)
            result += sec + "s";
        console.log(result);
        return result;
    },
  },
  ready: function() {
    // Get start time of today
    this.start = new Date();
    this.start.setHours(0);
    this.start.setMinutes(0);
    this.start.setSeconds(0);
    this.start.setMilliseconds(0);
    // End time of today
    this.end = new Date(this.start);
    this.end.setDate(this.end.getDate()+1);
    this.end = new Date(this.end-1);
    // Convert to iso8601
    this.start = this.start.toISOString();
    this.end = this.end.toISOString();
    
    // TODO: Make this not hardcoded
    this.bucket = "aw-watcher-window_johan-desktop"

    this.$set("starttime", this.start);
    this.$set("endtime", this.end);

    //this.getEventChunk(this.bucket, this.start, this.end);
    this.createView('windows_johan-desktop', this.start, this.end);
  }
}
</script>
