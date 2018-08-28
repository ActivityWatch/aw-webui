<template lang="pug">
div
  h2 Activity for {{ dateShort }}

  p
    | Host: {{ host }}
    br
    | Active time: {{ readableDuration }}

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
      input.form-control(id="date" type="date" :value="dateShort" :max="today" @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh()", variant="outline-dark")
          icon(name="sync")
          |  Refresh

  aw-periodusage(:periodusage_arr="daily_activity", :host="host")

  ul.nav.nav-tabs
    li.nav-item.aw-nav-item
      a.nav-link.aw-nav-link(@click="view = 'summary'" :class="{ active: view=='summary' }")
        h5 Summary
    li.nav-item.aw-nav-item
      a.nav-link.aw-nav-link(@click="view = 'window'" :class="{ active: view=='window' }")
        h5 Window
    li.nav-item.aw-nav-item
      a.nav-link.aw-nav-link(@click="view = 'browser'" :class="{ active: view=='browser' }")
        h5.active-h5 Browser
    li.nav-item.aw-nav-item
      a.nav-link.aw-nav-link(@click="view = 'editor'" :class="{ active: view=='editor' }")
        h5 Editor
  br

  div.row(v-show="view == 'summary'")
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", @click="top_apps_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_windowtitles", :namefunc="top_windowtitles_namefunc", :colorfunc="top_windowtitles_colorfunc")
      b-button(size="sm", variant="outline-secondary", :disabled="top_windowtitles.length < top_windowtitles_count", @click="top_windowtitles_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Browser Domains

      div(v-if="browserBucketId")
        aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")
        b-button(size="sm", variant="outline-secondary", :disabled="top_web_domains.length < top_web_count" @click="top_web_count += 5; queryBrowserDomains()")
          icon(name="angle-double-down")
          | Show more
        br

  div(v-show="view == 'window'")

    b-form-checkbox(v-model="timelineShowAFK")
      | Show AFK time

    aw-timeline-inspect(:chunks="app_chunks", :total_duration='duration', :show_afk='timelineShowAFK', :chunkfunc='app_chunkfunc', :eventfunc='app_eventfunc')

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
        b-dropdown-item-button(v-for="browserBucket in browserBuckets", :key="browserBucket", @click="browserBucketId = browserBucket")
          | {{ browserBucket }}
    br

    h6 Active browser time: {{ readableWebDuration }}

    div.row
      div.col-md-6
        h5 Top Browser Domains

        div(v-if="browserBucketId")
          aw-summary(:fields="top_web_domains", :namefunc="top_web_domains_namefunc", :colorfunc="top_web_domains_colorfunc")

      div.col-md-6
        h5 Top Browser URLs

        div(v-if="browserBucketId")
          aw-summary(:fields="top_web_urls", :namefunc="top_web_urls_namefunc", :colorfunc="top_web_urls_colorfunc")

    b-button(size="sm", variant="outline-secondary", :disabled="top_web_urls.length < top_web_count && top_web_domains.length < top_web_count" @click="top_web_count += 5; queryBrowserDomains()")
      icon(name="angle-double-down")
      | Show more

    hr

    b-form-checkbox(v-model="timelineShowAFK")
      | Show AFK time

    br

    aw-timeline-inspect(:chunks="web_chunks", :total_duration='duration', :show_afk='timelineShowAFK', :chunkfunc='web_chunkfunc', :eventfunc='web_eventfunc')

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
        b-dropdown-item-button(v-for="editorBucket in editorBuckets", :key="editorBucket", @click="editorBucketId = editorBucket")
          | {{ editorBucket }}

    br

    h6 Active editor time: {{ readableEditorDuration }}

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

      b-button(size="sm", variant="outline-secondary", @click="top_editor_count += 5; queryEditorActivity()")
        icon(name="angle-double-down")
        | Show more


  hr

  div.row
    div.col-md-6
      b Options
      div
        b-form-checkbox(v-model="filterAFK")
          | Filter away AFK time


</template>

<style lang="scss">

.aw-nav-link {
  background-color: #eee;
  border: 2px solid #eee !important;
  border-bottom: none !important;
  margin-left: 0.1em;
  margin-right: 0.1em;
  border-top-left-radius: 0.5rem !important;
  border-top-right-radius: 0.5rem !important;
}

.aw-nav-link:hover {
  background-color: #fff;
}

.aw-nav-item:hover {
  background-color: #fff !important;
}

</style>

<script>
import moment from 'moment';
import time from "../util/time.js";

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/angle-double-down'
import 'vue-awesome/icons/sync'

import query from '../queries.js';


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

      app_chunks: [],
      app_chunkfunc: (e) => e.data.app,
      app_eventfunc: (e) => e.data.title,

      top_web_count: 5,
      web_duration: 0,

      web_chunks: [],
      web_chunkfunc: (e) => e.data.domain,
      web_eventfunc: (e) => e.data.url,

      top_web_domains: [],
      top_web_domains_namefunc: (e) => e.data.domain,
      top_web_domains_colorfunc: (e) => e.data.domain,

      top_web_urls: [],
      top_web_urls_namefunc: (e) => e.data.url,
      top_web_urls_colorfunc: (e) => e.data.domain,

      editor_duration: 0,
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
  watch: {
    '$route': function() {
      console.log("Route changed");
      this.refresh();
    },
    filterAFK() {
      this.refresh();
    },
    browserBucketId() {
      this.queryBrowserDomains();
    },
    editorBucketId() {
      this.queryEditorActivity();
    },
  },

  computed: {
    readableDuration: function() { return time.seconds_to_duration(this.duration) },
    readableWebDuration: function() { return time.seconds_to_duration(this.web_duration) },
    readableEditorDuration: function() { return time.seconds_to_duration(this.editor_duration) },
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
    this.testError();
  },

  methods: {
    previousDay: function() { return moment(this.dateStart).subtract(1, 'days').format("YYYY-MM-DD") },
    nextDay: function() { return moment(this.dateStart).add(1, 'days').format("YYYY-MM-DD") },
    setDate: function(date) { this.$router.push('/activity/'+this.host+'/'+date); },

    refresh: function() {
      this.queryAll();
      this.duration = "";
    },

    errorHandler: function(error) {
      this.errormsg = "" + error + ". See dev console (F12) and/or server logs for more info.";
      throw error;
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

    getBrowserBucket: async function() {
      let buckets = await this.$aw.getBuckets().catch(this.errorHandler);
      for (var bucket in buckets){
        if (buckets[bucket]["type"] === "web.tab.current"){
          this.browserBuckets.push(bucket);
        }
      }
      if (this.browserBuckets.length > 0){
        this.browserBucketId = this.browserBuckets[0]
      }
    },

    getEditorBucket: async function() {
      let buckets = await this.$aw.getBuckets().catch(this.errorHandler);
      for (var bucket in buckets){
        if (buckets[bucket]["type"] === "app.editor.activity"){
          this.editorBuckets.push(bucket);
        }
      }
      if (this.editorBuckets.length > 0){
        this.editorBucketId = this.editorBuckets[0]
      }
    },

    queryWindows: async function() {
      var periods = [this.dateStart + "/" + this.dateEnd];
      var q = query.windowQuery(this.windowBucketId, this.afkBucketId, this.top_apps_count, this.top_windowtitles_count, this.filterAFK);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.top_apps = data["app_events"];
      this.top_windowtitles = data["title_events"];
      this.app_chunks = data["app_chunks"];
      this.duration = data["duration"];
    },

    queryBrowserDomains: async function() {
      if (this.browserBucketId !== "") {
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.browserSummaryQuery(this.browserBucketId, this.windowBucketId, this.afkBucketId, this.top_web_count, this.filterAFK);
        let data = (await this.$aw.query(periods, q).catch(this.errorHandler))[0];
        this.web_duration = data["duration"];
        this.top_web_domains = data["domains"];
        this.top_web_urls = data["urls"];
        this.web_chunks = data["chunks"];
      }
    },

    queryEditorActivity: async function() {
      if (this.editorBucketId !== ""){
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.editorActivityQuery(this.editorBucketId, this.top_editor_count);
        let data = (await this.$aw.query(periods, q).catch(this.errorHandler))[0];
        this.editor_duration = data["duration"];
        this.top_editor_files = data["files"];
        this.top_editor_languages = data["languages"];
        this.top_editor_projects = data["projects"];
      }
    },

    queryDailyActivity: async function() {
      var timeperiods = [];
      for (var i=-15; i<=15; i++) {
        var startdate = moment(this.date).add(i, 'days').format();
        var enddate = moment(this.date).add(i+1, 'days').format();
        timeperiods.push(startdate + '/' + enddate);
      }
      this.daily_activity = await this.$aw.query(timeperiods, query.dailyActivityQuery(this.afkBucketId)).catch(this.errorHandler);
    },

    testError() {
      //throw 'error: some message';
    }
  },
}
</script>
