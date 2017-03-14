<template lang="jade">
h2 Window Activity {{ datestr }}

h5 {{ host }}

h3(style="color: red;") {{ errormsg }}

div.btn-group
  button.btn.btn-default(v-on:click="queryDate(time.get_prev_day(date))")
    span(aria-hidden="true" class="glyphicon glyphicon-arrow-left")
    |  Previous day
  button.btn.btn-default(v-on:click="queryDate(time.get_next_day(date))")
    span(aria-hidden="true" class="glyphicon glyphicon-arrow-right")
    |  Next day
button.btn.btn-default(v-on:click="query()", style="margin-left: 1rem;")
  span(aria-hidden="true" class="glyphicon glyphicon-refresh")
  |  Refresh

hr

h4 Summary

h5 Total time: {{ time.seconds_to_duration(duration) }}

div#appsummary

hr

h4 Timeline

div#apptimeline

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
import renderSummary from '../visualizations/summary.js';
import time from "../util/time.js";
import event_parsing from "../util/event_parsing.js";

var panel = require('vue-strap').panel;
var accordion = require('vue-strap').accordion;

let $QueryView  = Resources.$QueryView;
let $CreateView  = Resources.$CreateView;
let $Info  = Resources.$Info;

var daylength = 86400000;

export default {
  name: "Activity",
  components: {
    'panel': panel,
    'accordion': accordion
  },
  data: () => {
    return {
      // Libraries
      time: time,
      // Init variables
      host: "",
      testing: false,
      // Date variables
      date: null,
      datestr: "",
      // Query variables
      duration: "",
      eventcount: 0,
      errormsg: "",
    }
  },

  watch: {
    '$route': function(to, from) {
      console.log("Route changed")
      this.$set("host", this.$route.params.host);
      document.getElementById("appsummary").innerHTML = "";
      document.getElementById("apptimeline").innerHTML = "";
      this.query();
    },

    'errormsg': function(to, from){
      console.log(to);
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
$Info.get().then(
  (response) => { // Success
    if (response.status > 304){
      var msg = "Request error "+response.status+" at get info";
      this.$set("errormsg", msg)
    }
    else {
      console.log(response);
      var data = response.json();
      this.$set("testing", data.testing);
      this.queryDate(date);
    }
  },
  (response) => { // Error
    var msg = "Request error "+response.status+" at get info. Server offline?";
    this.$set("errormsg", msg)
  }
)
},

methods: {

queryDate: function(date){
  this.setDay(date);
  this.query();
},

setDay: function(datestr){
    this.$set("date", time.get_day_start(datestr));
      this.$set("datestr", this.date.format('YYYY-MM-DD'));
    },

    query: function(){
      this.$set('duration', "");
      this.$set('eventcount', 0);
      this.$set('errormsg', "");

      if (this.testing){
        console.log("Using testing buckets");
        var window_bucket_name = "aw-watcher-window-testing_"+this.host;
        var afk_bucket_name = "aw-watcher-afk-testing_"+this.host;
      }
      else {
        var window_bucket_name = "aw-watcher-window_"+this.host;
        var afk_bucket_name = "aw-watcher-afk_"+this.host;
      }

      var summary_view_name = "windowactivity_summary@"+this.host;
      var query = this.windowSummaryQuery(window_bucket_name, afk_bucket_name);
      $CreateView.save({viewname: summary_view_name}, {'query': query}).then(
        (response) => { // Success
          if (response.status > 304){
            var msg = "Request error "+response.status+" at create view";
            this.$set("errormsg", msg)
          }
          else {
            var data = response.json();
            this.queryView(summary_view_name);
          }
        },
        (response) => { // Error
          var msg = "Request error "+response.status+" at create view";
          this.$set("errormsg", msg);
        }
      );

      var timeline_view_name = "windowactivity_timeline@"+this.host;
      var query = this.windowTimelineQuery(window_bucket_name, afk_bucket_name);
      $CreateView.save({viewname: timeline_view_name}, {'query': query}).then(
        (response) => { // Success
          if (response.status > 304){
            var msg = "Request error "+response.status+" at create view";
            this.$set("errormsg", msg)
          }
          else {
            var data = response.json();
            this.queryView(timeline_view_name);
          }
        },
        (response) => { // Error
          var msg = "Request error "+response.status+" at create view";
          this.$set("errormsg", msg);
        }
      );
    },

    queryView: function(viewname){
      $QueryView.get({"viewname": viewname,
                      "limit": -1,
                      "start": moment(this.date).format(),
                      "end": moment(this.date).add(1, 'days').format()})
        .then(
        (response) => {
          if (response.status > 304){
            var msg = "Server error "+response.status+" at view query";
            this.$set("errormsg", msg)
          }
          else {
            console.log(viewname)
            var data = response.json();
            var chunks = data["chunks"];
            var eventlist = data["eventlist"];
            this.$set("duration", data["duration"]["value"]);
            this.$set("eventcount", data["eventcount"]+this.eventcount);
            if (chunks != undefined){
              var appsummary = event_parsing.parse_chunks_to_apps(chunks);
              var e = document.getElementById("appsummary")
              renderSummary(e, appsummary);
            }
            if (eventlist != undefined){
              var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
              var e = document.getElementById("apptimeline")
              renderTimeline(e, apptimeline, this.duration);
            }
          }
        },
        (response) => {
          var msg = "Request error "+response.status+" at view query";
          this.$set("errormsg", msg)
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
  },
}
</script>
