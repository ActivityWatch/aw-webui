<template lang="pug">
div
  h2 Window Activity for {{ dateShort }}

  p Host: {{ host }}

  b-alert(variant="danger" :show="errormsg.length > 0")
    | {{ errormsg }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="'/activity/' + host + '/' + previousDay()", variant="outline-dark")
          icon(name="arrow-left")
          |  Previous day
        b-button(:to="'/activity/' + host + '/' + nextDay()", :disabled="nextDay() > today", variant="outline-dark")
          |  Next day
          icon(name="arrow-right")
    div.p-1
      input.form-control(id="date" type="date" :value="dateShort" :max="today" v-on:change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(v-on:click="refresh()", variant="outline-dark")
          icon(name="sync")
          |  Refresh

  aw-periodusage(:periodusage_arr="daily_activity", :host="host")


  hr

  div.row
    div.col-md-6
      h5 Summary
      | Total active time: {{ readableDuration }}
    div.col-md-6
      b Options
      div
        b-form-checkbox(v-model="filterAFK")
          | Filter away AFK time

  hr

  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")
      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowApps += 5; queryApps()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_windowtitles", :namefunc="top_windowtitles_namefunc", :colorfunc="top_windowtitles_colorfunc")
      b-button(size="sm", variant="outline-secondary", v-on:click="numberOfWindowTitles += 5; queryWindowTitles()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Browser Domains
      //b-alert(variant="warning" show)
      //  | #[b Note:] This is an early version. It is missing basic functionality such as not working on all platforms and browsers. See #[a(href="https://github.com/ActivityWatch/activitywatch/issues/99") issue #99] for details.

      div(v-show="browserBucketId")
        aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

        b-button(size="sm", variant="outline-secondary", v-on:click="numberOfBrowserDomains += 5; queryBrowserDomains()")
          icon(name="angle-double-down")
          | Show more
        br
        br

      b-input-group(size="sm")
        b-input-group-prepend
          span.input-group-text
            | Bucket
        b-dropdown(:text="browserBucketId || 'Select browser watcher bucket'", size="sm", variant="outline-secondary")
          b-dropdown-header
            | Browser bucket to use
          b-dropdown-item(v-if="browserBuckets.length <= 0", name="b", disabled)
            | No browser buckets available
            br
            small Make sure you have an browser extension installed
          b-dropdown-item-button(v-for="browserBucket in browserBuckets", :key="browserBucket", v-on:click="browserBucketId = browserBucket")
            | {{ browserBucket }}

  hr

  h4 Timeline

  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  aw-timeline(:events="events_apptimeline", :total_duration='duration', :show_afk='timelineShowAFK')

  hr

  h4 Clock

  //b-alert(variant="warning" show)
  //  | #[b Note:] This is an early version. It has known issues that will be resolved in a future update.
  //  | See #[a(href="https://github.com/ActivityWatch/aw-webui/issues/36") issue #36] for details.

  aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

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
import 'vue-awesome/icons/sync'

import query from '../queries.js';

import Summary from '../visualizations/Summary.vue';
import Sunburst from '../visualizations/Sunburst.vue';
import PeriodUsage from '../visualizations/PeriodUsage.vue';
import Timeline from '../visualizations/TimelineInspect.vue';

import awclient from '../awclient.js';


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
      numberOfBrowserDomains: 4,

      browserBuckets: [],
      browserBucketId: "",

      top_apps: [],
      top_apps_namefunc: (e) => e.data.app,
      top_apps_colorfunc: (e) => e.data.app,

      top_windowtitles: [],
      top_windowtitles_namefunc: (e) => e.data.title,
      top_windowtitles_colorfunc: (e) => e.data.app,

      top_web_domains: [],
      top_web_domains_namefunc: (e) => e.data.domain,
      top_web_domains_colorfunc: (e) => e.data.domain,

      daily_activity: [],
      events_apptimeline: [],
    }
  },

  components: {
    "aw-sunburst": Sunburst,
    "aw-summary": Summary,
    "aw-periodusage": PeriodUsage,
    "aw-timeline": Timeline,
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
    this.getBrowserBucket();

    this.refresh();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/'+this.host+'/'+date); },

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
      this.queryDailyActivity();
      this.queryTimeline();
    },

    getBrowserBucket: function() {
      awclient.getBuckets().then((response) => {
        let buckets = response.data;
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
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.windowTimelineQuery(this.windowBucketId, this.afkBucketId, this.filterAFK);
      awclient.query(periods, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            var eventlist = response.data[0];
            this.events_apptimeline = event_parsing.parse_eventlist_by_apps(eventlist);
            this.duration = this.totalDuration(eventlist);
          }
        }, this.errorHandler);
    },

    queryWindowTitles: function() {
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.titleSummaryQuery(this.windowBucketId, this.afkBucketId, this.numberOfWindowTitles, this.filterAFK);
      awclient.query(periods, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.top_windowtitles = response.data[0];
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
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.appSummaryQuery(this.windowBucketId, this.afkBucketId, this.numberOfWindowApps, this.filterAFK);
      awclient.query(periods, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.top_apps = response.data[0];
          }
        }, this.errorHandler
      );
    },

    queryBrowserDomains: function(){
      if (this.browserBucketId !== ""){
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.browserSummaryQuery(this.browserBucketId, this.windowBucketId, this.afkBucketId, this.numberOfBrowserDomains, this.filterAFK);
        awclient.query(periods, q).then(
          (response) => { // Success
            if (response.status > 304){
              this.errorHandler(response);
            } else {
              this.top_web_domains = response.data[0];
            }
          }, this.errorHandler
        );
      }
    },

    queryDailyActivity: function(){
      var timeperiods = [];
      for (var i=-15; i<=15; i++) {
        var startdate = moment(this.date).add(i, 'days').format();
        var enddate = moment(this.date).add(i+1, 'days').format();
        var period = startdate+'/'+enddate;
        timeperiods.push(period);
      }
      var q = query.dailyActivityQuery(this.afkBucketId);
      awclient.query(timeperiods, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            this.daily_activity = response.data;
          }
        }, this.errorHandler
      );
    },
  },
}
</script>
