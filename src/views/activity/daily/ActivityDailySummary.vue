<template lang="pug">
div
  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps.slice(0, top_apps_count)", :namefunc="e => e.data.app", :colorfunc="e => e.data.app")
      b-button(size="sm", variant="outline-secondary", :disabled="top_apps.length < top_apps_count", @click="top_apps_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_titles.slice(0, top_titles_count)", :namefunc="e => e.data.title", :colorfunc="e => e.data.app")
      b-button(size="sm", variant="outline-secondary", :disabled="top_titles.length < top_titles_count", @click="top_windowtitles_count += 5; queryWindows()")
        icon(name="angle-double-down")
        | Show more

    div.col-md-4
      h5 Top Browser Domains
      div(v-if="browserBuckets")
        aw-summary(:fields="top_domains.slice(0, top_web_count)", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain")
        b-button(size="sm", variant="outline-secondary", :disabled="top_domains.length < top_web_count" @click="top_web_count += 5; queryBrowserDomains()")
          icon(name="angle-double-down")
          | Show more
        br

    div.col-md-4
      h5 Top categories
      div(v-if="top_categories")
        aw-summary(:fields="top_categories", :namefunc="e => e.data['$category']", :colorfunc="e => e.data['$category']")
        b-button(size="sm", variant="outline-secondary", :disabled="top_categories.length < top_cats_count" @click="top_cats_count += 5; queryTopCategories()")
          icon(name="angle-double-down")
          | Show more
        br

    div.col-md-4
      h5 Category Tree
      div(v-if="top_categories")
        aw-categorytree(:events="top_categories")
</template>

<script>
import { get_day_period } from "~/util/time.js";
import { loadClassesForQuery } from "~/util/classes";
import _ from 'lodash';

import query from '~/queries.js';


export default {
  name: "Activity",
  props: ['date', 'host'],
  data: () => {
    return {
      filterAFK: true,

      daily_activity: [],
      events_apptimeline: [],

      browserBuckets: [],
      browserBucketSelected: 'all',

      top_apps_count: 5,
      top_titles_count: 5,
      top_cats_count: 5,
      top_web_count: 5,
    };
  },
  watch: {
    $route: function() {
      this.refresh();
    },
    filterAFK() {
      this.refresh();
    },
    browserBucketSelected() {
      this.refresh();
    },
    date() {
      this.refresh();
    }
  },

  computed: {
    top_apps: function() { return this.$store.state.activity_daily.top_apps },
    top_titles: function() { return this.$store.state.activity_daily.top_titles },
    top_categories: function() { return this.$store.state.activity_daily.top_categories },
    top_domains: function() { return this.$store.state.activity_daily.top_domains },
    query_options: function() {
      const browserBuckets = this.browserBucketSelected == 'all' ? this.browserBuckets : [this.browserBucketSelected];
      console.log(browserBuckets);
      return { aw_client: this.$aw, date: this.date, host: this.host, filterAFK: this.filterAFK, browserBuckets: browserBuckets };
    },
  },

  mounted: async function() {
    await this.refresh();
  },

  methods: {
    refresh: async function() {
      await this.getBrowserBuckets();
      await this.$store.dispatch('activity_daily/query_window', this.query_options);
      await this.$store.dispatch("activity_daily/query_browser", this.query_options);
    },

    getBrowserBuckets: async function() {
      let buckets = await this.$aw.getBuckets();
      this.browserBuckets = _.map(_.filter(buckets, (bucket) => bucket["type"] === "web.tab.current"), (bucket) => bucket["id"]);
    },
  },
}
</script>
