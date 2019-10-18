<template lang="pug">
div
  div.row.mb-4
    div.col-md-4
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="e => e.data.app", :colorfunc="e => e.data.app", with_limit)

    div.col-md-4
      h5 Top Window Titles
      aw-summary(:fields="top_titles", :namefunc="e => e.data.title", :colorfunc="e => e.data.app", with_limit)

    div.col-md-4
      h5 Top Browser Domains
      aw-summary(:fields="top_domains", :namefunc="e => e.data.$domain", :colorfunc="e => e.data.$domain", with_limit)

  div.row.mb-4
    div.col-md-4
      h5 Top categories
      div(v-if="top_categories")
        aw-summary(:fields="top_categories", :namefunc="e => e.data['$category'].join(' -> ')", :colorfunc="e => e.data['$category'].join(' -> ')", with_limit)

    div.col-md-4
      h5 Category Tree
      div(v-if="top_categories")
        aw-categorytree(:events="top_categories")

  div.row.mb-4
    div.col-md-6
      h5 Category Sunburst
      div(v-if="top_categories")
        aw-sunburst-categories(:data="top_categories_hierarchy", style="height: 30em")

</template>

<script>
import { get_day_period } from "~/util/time.js";
import { loadClassesForQuery, build_category_hierarchy } from "~/util/classes";
import _ from 'lodash';

import query from '~/queries.js';

function pick_subname_as_name(c) {
  c.name = c.subname;
  c.children = c.children.map(pick_subname_as_name);
  return c;
}

export default {
  name: "Activity",
  computed: {
    top_apps: function() { return this.$store.state.activity_daily.top_apps },
    top_titles: function() { return this.$store.state.activity_daily.top_titles },
    top_categories: function() { return this.$store.state.activity_daily.top_categories },
    top_domains: function() { return this.$store.state.activity_daily.top_domains },
    //top_urls: function() { return this.$store.state.activity_daily.top_urls },
    browser_buckets: function() { return this.$store.state.activity_daily.browser_buckets },
    top_categories_hierarchy: function() {
      if(this.top_categories) {
        console.log(this.top_categories);
        let categories = this.top_categories.map(c => { return { name: c.data.$category, size: c.duration }; });
        console.log(categories);

        return {
          name: "All",
          children: build_category_hierarchy(categories).map(c => pick_subname_as_name(c))};
      } else {
        return null;
      }
    },
  },
}
</script>
