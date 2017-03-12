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
  panel(v-for="app in appsummary", :header="app.name + '  (' + time.seconds_to_duration(app.duration) + ')'", :is-open="false")
    table
      tr(v-for="(index, title) in app.titles")
        td {{ time.seconds_to_duration(title.duration) }}
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
var event_parsing = require("../util/event_parsing.js");

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
          this.$set("appsummary", event_parsing.parse_chunks_to_apps(chunks));
        if (eventlist != undefined){
          this.$set("apptimeline", event_parsing.parse_eventlist_by_apps(eventlist));
          var e = document.getElementById("timeline")
          renderTimeline(e, this.apptimeline);
        }
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



    setDay: function(datestr){
      this.$set("date", time.get_day_start(datestr));
      this.$set("datestr", this.date.format('YY-MM-DD'));
    },
  },
}
</script>
