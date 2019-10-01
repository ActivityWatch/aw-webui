<template lang="pug">
div
  div.row
    aw-summary.col-md-6(:fields="top_apps", :namefunc="top_apps_namefunc", :colorfunc="top_apps_colorfunc")

    aw-summary.col-md-6(:fields="top_windowtitles", :namefunc="top_windowtitles_namefunc", :colorfunc="top_windowtitles_colorfunc")
</template>

<script>
import query from '../queries.js';

export default {
  name: "SummaryView",

  props: [ "period" ],

  data: () => {
    return {
      limit: 10,
      top_apps: [],
      top_apps_namefunc: (e) => e.data.app,
      top_apps_colorfunc: (e) => e.data.app,
      top_windowtitles: [],
      top_windowtitles_namefunc: (e) => e.data.title,
      top_windowtitles_colorfunc: (e) => e.data.app,
    }
  },

  computed: {
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host },
  },

  watch: {
    'period': async function() {
      await this.query();
    },
  },

  async mounted() {
    await this.query();
  },

  methods: {
    query: async function() {
      var periods = [this.period];
      var q = query.summaryQuery(this.windowBucketId, this.afkBucketId, this.limit);
      let data = await this.$aw.query(periods, q);
      console.log(data);
      data = data[0];
      console.log(data);
      this.top_apps = data["app_events"];
      this.top_windowtitles = data["title_events"];
    },
  }
}
</script>
