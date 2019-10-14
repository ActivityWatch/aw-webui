<template lang="pug">
div
  div.row
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="e => e.data.app", :colorfunc="e => e.data.app", with_limit)

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_titles", :namefunc="e => e.data.title", :colorfunc="e => e.data.app", with_limit)

    div.col-md-4
      h5 Top Browser Domains
      div(v-if="browser_buckets")
        aw-summary(:fields="top_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain", with_limit)

  div.row
    hr

  div.row
    div.col-md-4
      h5 Top categories
      div(v-if="top_categories")
        aw-summary(:fields="top_categories", :namefunc="e => e.data['$category'].join(' -> ')", :colorfunc="e => e.data['$category'].join(' -> ')", with_limit)

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
  computed: {
    top_apps: function() { return this.$store.state.activity_daily.top_apps },
    top_titles: function() { return this.$store.state.activity_daily.top_titles },
    top_categories: function() { return this.$store.state.activity_daily.top_categories },
    top_domains: function() { return this.$store.state.activity_daily.top_domains },
    //top_urls: function() { return this.$store.state.activity_daily.top_urls },
    browser_buckets: function() { return this.$store.state.activity_daily.browser_buckets },
  },
}
</script>
