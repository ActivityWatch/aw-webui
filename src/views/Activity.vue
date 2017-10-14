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


  div.row
    div.col-md-6
      h5 Summary
      | Total active time: {{ readableDuration }}
    div.col-md-6
      b Options
      div
        label.custom-control.custom-checkbox
          input.custom-control-input(type="checkbox", v-model="filterAFK")
          span.custom-control-indicator
          span.custom-control-description
            | Filter away AFK time

  hr

  div.row
    div.col-md-6
      h5 Top Applications

      div#appsummary-container

      b-button(size="sm" v-on:click="numberOfAppTitles += 5; queryWindowApps()")
        | Show more

    div.col-md-6
      h5 Top Window Titles

      div#windowtitles-container

      b-button(size="sm" v-on:click="numberOfWindowTitles += 5; queryWindowTitles()")
        | Show more

  hr

  h4 Timeline

  label.custom-control.custom-checkbox
    input.custom-control-input(type="checkbox", v-model="timelineShowAFK")
    span.custom-control-indicator
    span.custom-control-description
      | Show AFK time

  div#apptimeline-container

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

let $Query  = Resources.$Query;
let $Info  = Resources.$Info;
let $Event  = Resources.$Event;

var daylength = 86400000;

export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().format("YYYY-MM-DD"),

      filterAFK: true,
      timelineShowAFK: true,

      // Query variables
      duration: "",
      errormsg: "",
      numberOfWindowApps: 5,
      numberOfWindowTitles: 5,
    }
  },

  watch: {
    '$route': function(to, from) {
      console.log("Route changed")
      this.reset();
    },
    'filterAFK': function(to, from) {
      this.reset();
    },
    'timelineShowAFK': function(to, from) {
      this.reset();
    }
  },

  computed: {
    readableDuration: function() { return time.seconds_to_duration(this.duration) },
    host: function() { return this.$route.params.host },
    date: function() { return this.$route.params.date || moment().format() },
    dateStart: function() { return moment(this.date).startOf('day').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host }
  },

  mounted: function() {
    summary.create(document.getElementById("appsummary-container"));
    summary.create(document.getElementById("windowtitles-container"));
    timeline.create(document.getElementById("apptimeline-container"));

    this.query();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },

    reset: function(){
      this.duration = "";
      this.numberOfWindowApps = 5;
      this.numberOfWindowTitles = 5;
      this.query();
    },

    errorHandler: function(response) {
      console.error(response);
      this.errormsg = "Request error " + response.status + ". See F12 console for more info.";
    },

    query: function(){
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryApps();
      this.queryWindowTitles();
      this.queryTimeline();
      this.queryTotalTime();
    },

    queryTimeline: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart).add(1, 'days').format();

      var timeline_elem = document.getElementById("apptimeline-container")
      timeline.set_status(timeline_elem, "Loading...");
      var query = this.windowTimelineQuery(this.windowBucketId, this.afkBucketId, this.host, starttime, endtime);
      $Query.save({}, query).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var eventlist = response.json();
            var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
            timeline.update(timeline_elem, apptimeline, this.duration, this.timelineShowAFK);
          }
        }, this.errorHandler);
    },

    queryWindowTitles: function() {
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart).add(1, 'days').format();

      var container = document.getElementById("windowtitles-container")
      summary.set_status(container, "Loading...");
      var query = this.titleSummaryQuery(this.windowBucketId, this.afkBucketId, this.host, starttime, endtime, this.numberOfWindowTitles);
      $Query.save({}, query).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var summedEvents = response.json();
            summary.updateSummedEvents(container, summedEvents, (e) => e.data.title, (e) => e.data.app);
          }
        }, this.errorHandler
      );
    },

    queryApps: function(){
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart).add(1, 'days').format();

      var container = document.getElementById("appsummary-container")
      summary.set_status(container, "Loading...");
      var query = this.appSummaryQuery(this.windowBucketId, this.afkBucketId, this.host, starttime, endtime, this.numberOfWindowApps);
      $Query.save({}, query).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var summedEvents = response.json();
            summary.updateSummedEvents(container, summedEvents, (e) => e.data.app, (e) => e.data.app);
          }
        }, this.errorHandler
      );
    },

    queryTotalTime: function(){
      let starttime = moment(this.dateStart).format();
      let endtime = moment(this.dateStart).add(1, 'days').format();

      var query = this.totalTimeQuery(this.afkBucketId, this.host, starttime, endtime);
      $Query.save({}, query).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var events = response.json();

            this.duration = events[0].duration;
          }
        }, this.errorHandler
      );
    },

    windowTimelineQuery: function(windowbucket, afkbucket, host, starttime, endtime){
      return 'NAME="window_timeline@'+host+'" \n\
STARTTIME="'+starttime+'" \n\
ENDTIME="'+endtime+'" \n\
not_afk=query_bucket("'+afkbucket+'") \n\
events=query_bucket("'+windowbucket+'") \n\
not_afk=filter_keyval(not_afk, "status", "not-afk", FALSE) \n\
events=filter_period_intersect(events, not_afk) \n\
events=sort_by_duration(events) \n\
RETURN=events';
    },

    appSummaryQuery: function(windowbucket, afkbucket, host, starttime, endtime, count){
      return 'NAME="app_summary@'+host+'" \n\
STARTTIME="'+starttime+'" \n\
ENDTIME="'+endtime+'" \n\
not_afk=query_bucket("'+afkbucket+'") \n\
events=query_bucket("'+windowbucket+'") \n\
not_afk=filter_keyval(not_afk, "status", "not-afk", FALSE) \n\
events=filter_period_intersect(events, not_afk) \n\
events=merge_events_by_keys(events, "app") \n\
events=sort_by_duration(events) \n\
events=limit_events(events, '+count+') \n\
RETURN=events';
    },

    titleSummaryQuery: function(windowbucket, afkbucket, host, starttime, endtime, count){
      return 'NAME="title_summary@'+host+'" \n\
STARTTIME="'+starttime+'" \n\
ENDTIME="'+endtime+'" \n\
not_afk=query_bucket("'+afkbucket+'") \n\
events=query_bucket("'+windowbucket+'") \n\
not_afk=filter_keyval(not_afk, "status", "not-afk", FALSE) \n\
events=filter_period_intersect(events, not_afk) \n\
events=merge_events_by_keys(events, "app", "title") \n\
events=sort_by_duration(events) \n\
events=limit_events(events, '+count+') \n\
RETURN=events';
    },

    totalTimeQuery: function(afkbucket, host, starttime, endtime){
      return 'NAME="time_summary@'+host+'" \n\
STARTTIME="'+starttime+'" \n\
ENDTIME="'+endtime+'" \n\
events=query_bucket("'+afkbucket+'") \n\
events=filter_keyval(events, "status", "not-afk", FALSE) \n\
events=merge_events_by_keys(events, "status") \n\
RETURN=events';
    },
  },
}
</script>
