<template lang="pug">
div
  h2 Window Activity for {{ dateShort }}

  p Host: {{ host }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  b-alert(show)
    | Check out the new today view! Currently in alpha.
    b-button(style="float: right" :to="'/today/' + host" size="sm" variant="info") Open today view

  //div.alert.alert-info(role="alert")
    small
      | This page is currently considered early work and is known to have issues:
      li
        a(href='https://github.com/ActivityWatch/aw-webui/issues/22')
          | Needs a date selector

  b-button-group
    b-button(:to="'/activity/' + host + '/' + previousDay()")
      icon(name="arrow-left")
      |  Previous day
    b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today")
      |  Next day
      icon(name="arrow-right")
  b-button(v-on:click="query()", style="margin-left: 1rem;")
    icon(name="refresh")
    |  Refresh

  hr

  h4 Summary

  p Total time: {{ readableDuration }}

  div#appsummary-container

  hr

  h4 Timeline

  div#apptimeline-container

  hr

  p
    //| Showing activity from {{ datestart }} until 24 hours later
    //br
    | Events queried: {{ eventcount }}

</template>

<style lang="scss">

#apptimeline-container {
    white-space: nowrap;
    font-family: sans-serif;
    font-size: 11pt;
    line-height: 1.2em;
}

</style>

<script>
import Resources from '../resources.js';
import moment from 'moment';
import timeline from '../visualizations/timeline.js';
import summary from '../visualizations/summary.js';
import time from "../util/time.js";
import event_parsing from "../util/event_parsing.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/refresh'

let $QueryView  = Resources.$QueryView;
let $CreateView  = Resources.$CreateView;
let $Info  = Resources.$Info;

var daylength = 86400000;

export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().format("YYYY-MM-DD"),

      // Query variables
      duration: "",
      eventcount: 0,
      errormsg: "",
    }
  },

  watch: {
    '$route': function(to, from) {
      console.log("Route changed")
      this.query();
    },

    'errormsg': function(to, from){
      console.log(to);
    }
  },

  computed: {
    readableDuration: function() {
      return time.seconds_to_duration(this.duration);
    },
    host: function() {
      return this.$route.params.host;
    },
    date: function() {
      return this.$route.params.date || new Date().toISOString();
    },
    datestart: function() {
      // Returns a
      console.log(this.date);
      let datestart = moment(this.date).startOf('day').format();
      console.log(datestart);
      return datestart;
    },
    dateShort: function() {
      return moment(this.date).format("YYYY-MM-DD");
    }

  },

  mounted: function() {
    // Create summary
    var summary_elem = document.getElementById("appsummary-container")
    summary.create(summary_elem);

    // Create timeline
    var timeline_elem = document.getElementById("apptimeline-container")
    timeline.create(timeline_elem);

    $Info.get().then(
      (response) => {
        this.query();
      },
      (response) => {
        this.errormsg = "Request error "+response.status+" at get info. Server offline?";
      }
    );
  },

  methods: {
    previousDay: function() {
        return moment(this.datestart).subtract(1, 'days').format("YYYY-MM-DD");
    },
    nextDay: function() {
        return moment(this.datestart).add(1, 'days').format("YYYY-MM-DD");
    },

    query: function(){
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      if (PRODUCTION){
        var window_bucket_name = "aw-watcher-window_" + this.host;
        var afk_bucket_name = "aw-watcher-afk_" + this.host;
      } else {
        console.log("Using testing buckets");
        var window_bucket_name = "aw-watcher-window-testing_" + this.host;
        var afk_bucket_name = "aw-watcher-afk-testing_" + this.host;
      }

      var summary_view_name = "windowactivity_summary@" + this.host;
      var query = this.windowSummaryQuery(window_bucket_name, afk_bucket_name);
      $CreateView.save({viewname: summary_view_name}, {'query': query}).then(
        (response) => { // Success
          if (response.status > 304){
            this.errormsg = "Request error "+response.status+" at create view";
          }
          else {
            var data = response.json();
            this.queryView(summary_view_name);
          }
        },
        (response) => { // Error
          this.errormsg = "Request error "+response.status+" at create view";
        }
      );

      var timeline_view_name = "windowactivity_timeline@"+this.host;
      var query = this.windowTimelineQuery(window_bucket_name, afk_bucket_name);
      $CreateView.save({viewname: timeline_view_name}, {'query': query}).then(
        (response) => { // Success
          if (response.status > 304){
            this.errormsg = "Request error "+response.status+" at create view";
          }
          else {
            var data = response.json();
            this.queryView(timeline_view_name);
          }
        },
        (response) => { // Error
          this.errormsg = "Request error "+response.status+" at create view";
        }
      );
    },

    queryView: function(viewname){
      var timeline_elem = document.getElementById("apptimeline-container")
      timeline.set_status(timeline_elem, "Loading...");

      var appsummary_elem = document.getElementById("appsummary-container")
      summary.set_status(appsummary_elem, "Loading...");

      let today = moment(this.datestart);
      $QueryView.get({"viewname": viewname,
                      "limit": -1,
                      "start": today.format(),
                      "end": today.add(1, 'days').format()})
        .then(
        (response) => {
          if (response.status > 304){
            this.errormsg = "Server error "+response.status+" at view query";
          }
          else {
            console.log(viewname)
            var data = response.json();
            var chunks = data["chunks"];
            var eventlist = data["eventlist"];
            this.duration = data["duration"];
            this.eventcount = data["eventcount"]+this.eventcount;
            if (chunks != undefined){
              var appsummary = event_parsing.parse_chunks_to_apps(chunks);
              var el = document.getElementById("appsummary-container")
              summary.update(el, appsummary);
            }
            if (eventlist != undefined){
              var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
              var el = document.getElementById("apptimeline-container")
              timeline.update(el, apptimeline, this.duration);
            }
          }
        },
        (response) => {
          this.errormsg = "Request error "+response.status+" at view query";
        });
    },


    windowTimelineQuery: function(windowbucket, afkbucket){
      return {
        'chunk': false,
        'cache': false,
        'transforms':
        [{
          'bucket': windowbucket,
          'filters':
          [{
            'name': 'timeperiod_intersect',
            'transforms':
            [{
              'bucket': afkbucket,
              'filters':
              [{
                'name': 'include_keyvals',
                'key': 'status',
                'vals': ['not-afk'],
              }]
            }]
          }]
        }]
      };
    },


    windowSummaryQuery: function(windowbucket, afkbucket){
      return {
        'chunk': 'app',
        'cache': true,
        'transforms':
        [{
          'bucket': windowbucket,
          'filters':
          [{
            'name': 'timeperiod_intersect',
            'transforms':
            [{
              'bucket': afkbucket,
              'filters':
              [{
                'name': 'include_keyvals',
                'key': 'status',
                'vals': ['not-afk'],
              }]
            }]
          }]
        }]
      };
    },
  },
}
</script>
