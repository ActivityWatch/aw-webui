<template lang="pug">
div
  h2 Activity for {{ dateShort }}

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

  br

  ul.nav.nav-tabs
    li.nav-item
      a.nav-link(v-on:click="view = 'summary'" v-bind:class="{ active: view=='summary'}")
        | Summary
    li.nav-item
      a.nav-link(v-on:click="view = 'window'" v-bind:class="{ active: view=='window'}")
        | Window
    li.nav-item
      a.nav-link(v-on:click="view = 'browser'" v-bind:class="{ active: view=='browser'}")
        | Browser
    li.nav-item
      a.nav-link(v-on:click="view = 'editor'" v-bind:class="{ active: view=='editor'}")
        | Editor
  br

  div.row(v-show="view == 'summary'")
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", v-on:click="top_apps_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_windowtitles", :namefunc="top_windowtitles_namefunc", :colorfunc="top_windowtitles_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_windowtitles.length < top_windowtitles_count", v-on:click="top_windowtitles_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Browser Domains

      div(v-if="browserBucketId")
        aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

        b-button(size="sm", variant="outline-secondary", :disabled="top_web_domains.length < top_web_domains_count" v-on:click="top_web_domains_count += 5; queryBrowserDomains()")
          icon(name="angle-double-down")
          | Show more
        br
        br

  div(v-show="view == 'window'")

    b-form-checkbox(v-model="timelineShowAFK")
      | Show AFK time

    aw-timeline(:events="events_apptimeline", :total_duration='duration', :show_afk='timelineShowAFK')

    hr

    aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

  div(v-show="view == 'browser'")
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
    br

    div.row
      div.col-md-6
        h5 Top Browser Domains

        div(v-if="browserBucketId")
          aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

      div.col-md-6
        h5 Top Browser URLs

        div(v-if="browserBucketId")
          aw-summary(:fields="top_web_urls", :namefunc="top_web_urls_namefunc", :colorfunc="top_web_urls_colorfunc")

    b-button(size="sm", variant="outline-secondary", :disabled="top_web_urls.length < top_web_count && top_web_domains.length < top_web_count" v-on:click="top_web_count += 5; queryBrowserDomains()")
      icon(name="angle-double-down")
      | Show more


  div(v-show="view == 'editor'")

    b-input-group(size="sm")
      b-input-group-prepend
        span.input-group-text
          | Bucket
      b-dropdown(:text="editorBucketId || 'Select editor watcher bucket'", size="sm", variant="outline-secondary")
        b-dropdown-header
          | Editor bucket to use
        b-dropdown-item(v-if="editorBuckets.length <= 0", name="b", disabled)
          | No editor buckets available
          br
          small Make sure you have an editor watcher installed to use this feature
        b-dropdown-item-button(v-for="editorBucket in editorBuckets", :key="editorBucket", v-on:click="editorBucketId = editorBucket")
          | {{ editorBucket }}

    div(v-if="editorBucketId")
      div.row(style="padding-top: 0.5em;")
        div.col-md-4
          h5 Top file activity
          aw-summary(:fields="top_editor_files", :namefunc="top_editor_files_namefunc", :colorfunc="top_editor_files_colorfunc")

        div.col-md-4
          h5 Top language activity
          aw-summary(:fields="top_editor_languages", :namefunc="top_editor_languages_namefunc", :colorfunc="top_editor_languages_colorfunc")

        div.col-md-4
          h5 Top project activity
          aw-summary(:fields="top_editor_projects", :namefunc="top_editor_projects_namefunc", :colorfunc="top_editor_projects_colorfunc")

      b-button(size="sm", variant="outline-secondary", v-on:click="top_editor_count += 5; queryEditorActivity()")
        icon(name="angle-double-down")
        | Show more

</template>

<style lang="scss">

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

      view: "summary",

      // Query variables
      duration: "",
      errormsg: "",

      daily_activity: [],
      events_apptimeline: [],

      browserBuckets: [],
      browserBucketId: "",

      editorBuckets: [],
      editorBucketId: "",

      top_apps: [],
      top_apps_count: 5,
      top_apps_namefunc: (e) => e.data.app,
      top_apps_colorfunc: (e) => e.data.app,

      top_windowtitles: [],
      top_windowtitles_count: 5,
      top_windowtitles_namefunc: (e) => e.data.title,
      top_windowtitles_colorfunc: (e) => e.data.app,

      top_web_count: 5,

      top_web_domains: [],
      top_web_domains_namefunc: (e) => e.data.domain,
      top_web_domains_colorfunc: (e) => e.data.domain,

      top_web_urls: [],
      top_web_urls_namefunc: (e) => e.data.url,
      top_web_urls_colorfunc: (e) => e.data.domain,

      top_editor_count: 5,

      top_editor_files: [],
      top_editor_files_namefunc: (e) => {
        let f = e.data.file || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_files_colorfunc: (e) => e.data.language,

      top_editor_languages: [],
      top_editor_languages_namefunc: (e) => e.data.language,
      top_editor_languages_colorfunc: (e) => e.data.language,

      top_editor_projects: [],
      top_editor_projects_namefunc: (e) => {
        let f = e.data.project || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_projects_colorfunc: (e) => e.data.project,
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
    'editorBucketId': function(to, from) {
      this.queryEditorActivity();
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
    this.getEditorBucket();

    this.refresh();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/'+this.host+'/'+date); },

    refresh: function() {
      this.queryAll();
      this.duration = "";
    },

    errorHandler: function(response) {
      console.error(response);
      this.errormsg = "Request error " + response.status + ". See F12 console for more info.";
    },

    queryAll: function() {
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryWindows();
      this.queryBrowserDomains();
      this.queryEditorActivity();
      this.queryDailyActivity();
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

    getEditorBucket: function() {
      awclient.getBuckets().then((response) => {
        let buckets = response.data;
        for (var bucket in buckets){
          if (buckets[bucket]["type"] === "app.editor.activity"){
            this.editorBuckets.push(bucket);
          }
        }
        if (this.editorBuckets.length > 0){
          this.editorBucketId = this.editorBuckets[0]
        }
      });
    },

    totalDuration: function(eventlist){
        var duration = 0;
        for (var i in eventlist){
            duration += eventlist[i].duration;
        }
        return duration;
    },

    queryWindows: function(){
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.windowQuery(this.windowBucketId, this.afkBucketId, this.top_apps_count, this.top_windowtitles_count, this.filterAFK);
      awclient.query(periods, q).then(
        (response) => { // Success
          if (response.status > 304){
            this.errorHandler(response);
          } else {
            let events = response.data[0][0];
            let not_afk_events = response.data[0][1];
            this.top_apps = response.data[0][2];
            this.top_windowtitles = response.data[0][3];

            this.events_apptimeline = event_parsing.parse_eventlist_by_apps(events);
            this.duration = this.totalDuration(not_afk_events);
          }
        }, this.errorHandler
      );
    },

    queryBrowserDomains: function(){
      if (this.browserBucketId !== ""){
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.browserSummaryQuery(this.browserBucketId, this.windowBucketId, this.afkBucketId, this.top_web_count, this.filterAFK);
        awclient.query(periods, q).then(
          (response) => { // Success
            if (response.status > 304){
              this.errorHandler(response);
            } else {
              this.top_web_domains = response.data[0]["domains"];
              this.top_web_urls = response.data[0]["urls"];
            }
          }, this.errorHandler
        );
      }
    },

    queryEditorActivity: function(){
      if (this.editorBucketId !== ""){
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.editorActivityQuery(this.editorBucketId, this.top_editor_count);
        awclient.query(periods, q).then(
          (response) => { // Success
            if (response.status > 304){
              this.errorHandler(response);
            } else {
              let data = response.data[0];
              this.top_editor_files = data["files"];
              this.top_editor_languages = data["languages"];
              this.top_editor_projects = data["projects"];
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
        timeperiods.push(startdate + '/' + enddate);
      }
      awclient.query(timeperiods, query.dailyActivityQuery(this.afkBucketId)).then(
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
