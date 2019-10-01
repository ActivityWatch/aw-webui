<template lang="pug">
div
  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="e => e.data.app", :colorfunc="e => e.data.app")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", @click="top_apps_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_windowtitles", :namefunc="e => e.data.title", :colorfunc="e => e.data.app")
      b-button(size="sm", variant="outline-secondary", :disabled="top_windowtitles.length < top_windowtitles_count", @click="top_windowtitles_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Browser Domains
      div(v-if="browserBuckets")
        aw-summary(:fields="top_web_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain")
        b-button(size="sm", variant="outline-secondary", :disabled="top_web_domains.length < top_web_count" @click="top_web_count += 5; queryBrowserDomains()")
          icon(name="angle-double-down")
          | Show more
        br

    div.col-md-4
      h5 Top categories
      div(v-if="top_cats")
        aw-summary(:fields="top_cats", :namefunc="e => e.data['$category']", :colorfunc="e => e.data['$category']")
        b-button(size="sm", variant="outline-secondary", :disabled="top_cats.length < top_cats_count" @click="top_cats_count += 5; queryTopCategories()")
          icon(name="angle-double-down")
          | Show more
        br

    div.col-md-4
      h5 Category Tree
      div(v-if="top_cats")
        aw-categorytree(:events="top_cats")
</template>

<script>
import moment from 'moment';
import time from "../util/time.js";
import { loadClasses } from "../util/classes.js";
import _ from 'lodash';

import query from '../queries.js';


export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),

      filterAFK: true,

      duration: "",

      daily_activity: [],
      events_apptimeline: [],

      browserBuckets: [],
      browserBucketSelected: 'all',

      top_apps: [],
      top_apps_count: 5,

      top_windowtitles: [],
      top_windowtitles_count: 5,

      top_cats: [],
      top_cats_count: 5,

      top_web_domains: [],
      top_web_urls: [],
      top_web_count: 5,
      web_duration: 0,
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
    browserBucketSelected() {
      this.queryBrowserDomains();
    },
    browserBuckets() {
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
    date: function() {
      var dateParam = this.$route.params.date;
      var dateMoment = dateParam ? moment(dateParam) : moment().startOf('day');
      var start_of_day = localStorage.startOfDay;
      var start_of_day_hours = parseInt(start_of_day.split(":")[0]);
      var start_of_day_minutes = parseInt(start_of_day.split(":")[1]);
      return dateMoment.hour(start_of_day_hours).minute(start_of_day_minutes).format();
    },
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
    refresh: function() {
      this.duration = "";
      this.eventcount = 0;
      this.errormsg = "";

      this.queryWindows();
      this.queryBrowserDomains();
    },

    getBrowserBucket: async function() {
      let buckets = await this.$aw.getBuckets().catch(this.errorHandler);
      this.browserBuckets = _.map(_.filter(buckets, (bucket) => bucket["type"] === "web.tab.current"), (bucket) => bucket["id"]);
    },

    queryWindows: async function() {
      var periods = [this.dateStart + "/" + this.dateEnd];
      let classes = loadClasses();
      var q = query.windowQuery(this.windowBucketId, this.afkBucketId, this.top_apps_count, this.top_windowtitles_count, this.filterAFK, classes);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.top_apps = data["app_events"];
      this.top_windowtitles = data["title_events"];
      this.app_chunks = data["app_chunks"];
      this.duration = data["duration"];
      this.top_cats = data["cat_events"];
      console.log(JSON.parse(JSON.stringify(this.top_cats)));
    },

    queryBrowserDomains: async function() {
      let browserBuckets = this.browserBucketSelected == 'all' ? this.browserBuckets : [this.browserBucketSelected];
      if (browserBuckets) {
        var periods = [this.dateStart + "/" + this.dateEnd];
        var q = query.browserSummaryQuery(browserBuckets, this.windowBucketId, this.afkBucketId, this.top_web_count, this.filterAFK);
        let data = (await this.$aw.query(periods, q).catch(this.errorHandler))[0];
        this.web_duration = data["duration"];
        this.top_web_domains = data["domains"];
        this.top_web_urls = data["urls"];
        this.web_chunks = data["chunks"];
      }
    },
  },
}
</script>
