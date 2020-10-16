<template lang="pug">
div
  h3 Developer zone
  | Just some tools to aid in development and debugging.

  div
    b-btn(@click="query_window_timing()") Run window query
    b-btn(@click="query_browser_timing()") Run browser query
</template>

<script>
import moment from 'moment';

console.log(moment);

export default {
  name: 'aw-dev',

  data: function () {
    return {
      queryOptions: {
        aw_client: this.$aw,
        date: moment().format('YYYY-MM-DD'),
        host: 'erb-laptop2-arch',
        filterAFK: true,
        browserBuckets: ['aw-watcher-web-firefox-imported-2019-10-03T1'],
      },
    };
  },
  mounted() {
    console.log(this.$store);
  },
  methods: {
    query_window_timing: async function () {
      await this.$store.dispatch('activity/query_window', this.queryOptions);
    },
    query_browser_timing: async function () {
      await this.$store.dispatch('activity/query_browser', this.queryOptions);
    },
  },
};
</script>
