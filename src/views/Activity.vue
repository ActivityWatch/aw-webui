<template lang="pug">
div
  h2 Window Activity for {{ dateShort }}

  p Host: {{ host }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  b-button-group
    b-button(:to="'/activity/' + host + '/' + previousDay()", variant="outline-dark")
      icon(name="arrow-left")
      |  Previous day
    b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today", variant="outline-dark")
      |  Next day
      icon(name="arrow-right")
  b-button(v-on:click="refresh()", style="margin-left: 1rem;", variant="outline-dark")
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
      aw-summary(:fields="top_applications", :namefunc="top_applications_namefunc", :colorfunc="top_applications_colorfunc")
      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowApps += 5; queryApps()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-6
      h5 Top Window Titles
      aw-summary(:fields="top_window_titles", :namefunc="top_window_titles_namefunc", :colorfunc="top_window_titles_colorfunc")
      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowTitles += 5; queryWindowTitles()")
        icon(name="angle-double-down")
        | Show more

  hr

  h4 Timeline

  label.custom-control.custom-checkbox
    input.custom-control-input(type="checkbox", v-model="timelineShowAFK")
    span.custom-control-indicator
    span.custom-control-description
      | Show AFK time

  div#apptimeline-container

  hr

  h4 Clock

  b-alert(variant="warning" show)
    | #[b Note:] This is an early version. It has known issues that will be resolved in a future update.
    | See #[a(href="https://github.com/ActivityWatch/aw-webui/issues/36") issue #36] for details.

  aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

  hr

  h4 Top Browser Domains

  b-alert(variant="warning" show)
    | #[b Note:] This is an early version. It is missing basic functionality such as not working on all platforms and browsers. See #[a(href="https://github.com/ActivityWatch/activitywatch/issues/99") issue #99] for details.

  b-input-group(size="sm")
    b-input-group-addon
      | Browser bucket:
    b-input-group-button
      b-dropdown(:text="browserBucketId || 'Select browser watcher bucket'", size="sm", variant="outline-secondary")
        b-dropdown-item(v-if="browserBuckets.length <= 0", name="b", disabled)
          | No browser buckets available
          br
          small Make sure you have an browser extension installed
        b-dropdown-item-button(v-for="browserBucket in browserBuckets", :key="browserBucket", v-on:click="browserBucketId = browserBucket")
          | {{ browserBucket }}

  div(v-show="browserBucketId")
    br
    aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

    b-button(size="sm", variant="outline-secondary", v-on:click="numberOfBrowserDomains += 5; queryBrowserDomains()")
      icon(name="angle-double-down")
      | Show more

  br

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
import moment from 'moment';
import timeline from '../visualizations/timeline.js';
import summary from '../visualizations/summary.js';
import time from "../util/time.js";
import event_parsing from "../util/event_parsing.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/refresh'

import query from '../queries.js';

import Summary from '../visualizations/Summary.vue';
import Sunburst from '../visualizations/Sunburst.vue';

import Resources from '../resources.js';
let $Query  = Resources.$Query;
let $Info  = Resources.$Info;
let $Bucket = Resources.$Bucket;
let $Event  = Resources.$Event;

var daylength = 86400000;

export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),

      filterAFK: true,
      timelineShowAFK: true,

      // Query variables
      duration: "",
      errormsg: "",
      numberOfWindowApps: 5,
      numberOfWindowTitles: 5,
      numberOfBrowserDomains: 5,

      browserBuckets: [],
      browserBucketId: "",

      top_applications: [],
      top_applications_namefunc: null,
      top_applications_colorfunc: null,

      top_window_titles: [],
      top_window_titles_namefunc: null,
      top_window_titles_colorfunc: null,

      top_web_domains: {},
      top_web_domains_namefunc: null,
      top_web_domains_colorfunc: null,
    }
  },

  components: {
    "aw-sunburst": Sunburst,
    "aw-summary": Summary,
  },

  watch: {
    '$route': function(to, from) {
      console.log("Route changed");
      this.refresh();
    },
    'filterAFK': function(to, from) {
      this.refresh();
    },
    'timelineShowAFK': function(to, from) {
      this.refresh();
    },
    'filterAFK': function(to, from) {
      this.refresh();
    },
    'timelineShowAFK': function(to, from) {
      this.refresh();
    },
    'browserBucketId': function(to, from) {
      this.queryBrowserDomains();
    },
  },

  computed: {
    readableDuration: function() { return time.seconds_to_duration(this.duration) },
    host: function() { return this.$route.params.host },
    date: function() { return this.$route.params.date || moment().startOf('day').format() },
    dateStart: function() { return this.date },
    dateEnd: function() { return moment(this.date).add(1, 'days').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host },
  },

  mounted: function() {
    timeline.create(document.getElementById("apptimeline-container"));

    this.getBrowserBucket();

    this.refresh();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },

    refresh: function() {
      this.queryAll();
      this.duration = "";
      this.numberOfWindowApps = 5;
      this.numberOfWindowTitles = 5;
    },

    errorHandler: function(response) {
      console.error(response);
      this.errormsg = "Request error " + response.status + ". See F12 console for more info.";
    },

    queryAll: function() {
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryApps();
      this.queryWindowTitles();
      this.queryBrowserDomains();
      this.queryTimeline();
    },

    getBrowserBucket: function() {
      $Bucket.get().then((response) => {
        let buckets = response.json();
        for (var bucket in buckets){
          if (buckets[bucket]["type"] === "web.tab.current"){
            this.browserBuckets.push(bucket);
          }
        }
        if (this.browserBuckets.length > 0){
          this.browserBucketId = this.browserBuckets[0]
        }
      });
    },

    queryTimeline: function() {
      var timeline_elem = document.getElementById("apptimeline-container")
      timeline.set_status(timeline_elem, "Loading...");
      var q = query.windowTimelineQuery(this.windowBucketId, this.afkBucketId);
      $Query.save({"name": "window_timeline@"+this.host, "start": this.dateStart, "end": this.dateEnd, "cache": 0}, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var eventlist = response.json();
            var apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
            var total_duration = this.totalDuration(eventlist);
            this.duration = total_duration;
            timeline.update(timeline_elem, apptimeline, total_duration, this.timelineShowAFK);
          }
        }, this.errorHandler);
    },

    queryWindowTitles: function() {
      var q = query.titleSummaryQuery(this.windowBucketId, this.afkBucketId, this.numberOfWindowTitles);
      $Query.save({"name": "title_summary@"+this.host, "start": this.dateStart, "end": this.dateEnd, "cache": 1}, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.top_window_titles_namefunc = (e) => e.data.title;
            this.top_window_titles_colorfunc = (e) => e.data.app;
            this.top_window_titles = response.json();
          }
        }, this.errorHandler
      );
    },

    totalDuration: function(eventlist){
        var duration = 0;
        for (var i in eventlist){
            duration += eventlist[i].duration;
        }
        return duration;
    },

    queryApps: function(){
      var q = query.appSummaryQuery(this.windowBucketId, this.afkBucketId, this.numberOfWindowApps);
      $Query.save({"name": "appsummary@"+this.host, "start": this.dateStart, "end": this.dateEnd, "cache": 1}, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.top_applications_namefunc = (e) => e.data.app;
            this.top_applications_colorfunc = (e) => e.data.app;
            this.top_applications = response.json();
          }
        }, this.errorHandler
      );
    },

    queryBrowserDomains: function(){
      if (this.browserBucketId !== ""){
        var q = query.browserSummaryQuery(this.browserBucketId, this.windowBucketId, this.afkBucketId, this.numberOfBrowserDomains);
        $Query.save({"name": "browser_summary@"+this.host, "start": this.dateStart, "end": this.dateEnd, "cache": 1}, q).then(
          (response) => { // Success
            if (response.status > 304){
              this.errorHandler(response);
            } else {
              this.top_web_domains_namefunc = (e) => e.data.domain;
              this.top_web_domains_colorfunc = (e) => e.data.domain;
              this.top_web_domains = response.json();
            }
          }, this.errorHandler
        );
      }
    },
  },
}
</script>
