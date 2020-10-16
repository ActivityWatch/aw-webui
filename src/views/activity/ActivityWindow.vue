<template lang="pug">
div.mt-3
  div.row.mb-6
    div.col-md-6
      h5 Top Applications
      aw-summary(:fields="top_apps", :namefunc="e => e.data.app", :colorfunc="e => e.data.app", with_limit)
    div.col-md-6
      h5 Top Window Titles
      aw-summary(:fields="top_titles", :namefunc="e => e.data.title", :colorfunc="e => e.data.app", with_limit)

  div(v-if="periodLength == 'day'")
    aw-sunburst-clock(:date="date", :afkBucketId="bucket_id_afk", :windowBucketId="bucket_id_window")
  div(v-else)
    | Nothing to show here for the current period length: {{ periodLength }}
</template>

<script>
import { get_today } from '~/util/time';

export default {
  name: 'Activity',
  props: {
    date: {
      type: String,
      default: get_today(),
    },
    periodLength: {
      type: String,
      default: 'day',
    },
    host: String,
  },
  data: () => {
    return {
      timelineShowAFK: true,
    };
  },
  computed: {
    top_apps: function () {
      return this.$store.state.activity.window.top_apps;
    },
    top_titles: function () {
      return this.$store.state.activity.window.top_titles;
    },
    bucket_id_window: function () {
      return this.$store.state.activity.buckets.window[0];
    },
    bucket_id_afk: function () {
      return this.$store.state.activity.buckets.afk[0];
    },
  },
};
</script>
