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
      aw-summary(:fields="top_categories", :namefunc="e => e.data['$category'].join(' > ')", :colorfunc="e => e.data['$category'].join(' > ')", with_limit)

    div.col-md-4
      h5 Category Tree
      div(v-if="top_categories")
        aw-categorytree(:events="top_categories")

    div.col-md-4
      h5 Category Sunburst
      div(v-if="top_categories")
        aw-sunburst-categories(:data="top_categories_hierarchy", style="height: 20em")

  aw-devonly(v-if="periodLength === 'day'" reason="Not ready for production, still experimenting")
    div.row.mb-4
      div.col-md-12
        aw-timeline-barchart(:height="100", :datasets="datasets")

</template>

<script>
import _ from 'lodash';
import moment from 'moment';

import { build_category_hierarchy } from "~/util/classes";

function pick_subname_as_name(c) {
  c.name = c.subname;
  c.children = c.children.map(pick_subname_as_name);
  return c;
}

// TODO: Move somewhere else, possibly turn into a serverside transform
function split_by_hour_into_data(events) {
  if(events === undefined || events === null || events.length == 0)
    return [];
  const d = moment(events[0].timestamp).startOf('day');
  return _.range(0, 24).map(h => {
    let duration = 0;
    const d_start = d.clone().hour(h);
    const d_end = d.clone().hour(h + 1);
    // This can be made faster by not checking every event per hour, but since number of events is small anyway this and this is a lot shorter and easier to read it doesn't really matter.
    events.map(e => {
      const e_start = moment(e.timestamp);
      const e_end = e_start.clone().add(e.duration, 'seconds');
      if(e_start.isBetween(d_start, d_end) || e_end.isBetween(d_start, d_end) || d_start.isBetween(e_start, e_end)) {
        if(d_start < e_start && e_end < d_end) {
          // If entire event is contained within the hour
          duration += e.duration;
        } else if(d_start < e_start) {
          // If start of event is within the hour, but not the end
          duration += (d_end - e_start) / 1000;
        } else if(e_end < d_end) {
          // If end of event is within the hour, but not the start
          duration += (e_end - d_start) / 1000;
        } else {
          // Happens if event covers entire hour and more
          duration += 3600;
        }
      }
    });
    return duration / 60 / 60;
  });
}

export default {
  name: "Activity",
  props: {
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  computed: {
    top_apps: function() { return this.$store.state.activity_daily.top_apps },
    top_titles: function() { return this.$store.state.activity_daily.top_titles },
    top_categories: function() { return this.$store.state.activity_daily.top_categories },
    top_domains: function() { return this.$store.state.activity_daily.top_domains },
    //top_urls: function() { return this.$store.state.activity_daily.top_urls },
    browser_buckets: function() { return this.$store.state.activity_daily.browser_buckets },
    top_categories_hierarchy: function() {
      if(this.top_categories) {
        const categories = this.top_categories.map(c => { return { name: c.data.$category, size: c.duration }; });

        return {
          name: "All",
          children: build_category_hierarchy(categories).map(c => pick_subname_as_name(c))
        };
      } else {
        return null;
      }
    },
    datasets: function() {
      const data = split_by_hour_into_data(this.$store.state.activity_daily.active_events);
      return [{
        label: 'Total time',
        backgroundColor: '#6699ff',
        data,
      }];
    },
  },
}
</script>
