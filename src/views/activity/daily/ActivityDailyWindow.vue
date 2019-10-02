<template lang="pug">
div
  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  aw-timeline-inspect(:chunks="app_chunks", :show_afk='timelineShowAFK', :chunkfunc='app_chunkfunc', :eventfunc='app_eventfunc')

  hr

  aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

</template>

<script>
import {get_day_period} from "~/util/time.js";
import {loadClasses} from "~/util/classes";

import query from '~/queries.js';


export default {
  name: "Activity",
  props: ['date', 'host'],
  data: () => {
    return {
      timelineShowAFK: true,

      app_chunks: [],
      app_chunkfunc: (e) => e.data.app,
      app_eventfunc: (e) => e.data.title,
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
  },

  computed: {
    windowBucketId: function() { return "aw-watcher-window_" + this.host },
    afkBucketId:    function() { return "aw-watcher-afk_"    + this.host },
  },

  mounted: function() {
    this.refresh();
  },

  methods: {
    refresh: function() {
      this.queryAll();
    },

    queryAll: function() {
      this.queryWindows();
    },

    // TODO: Move to vuex store
    queryWindows: async function() {
      var periods = [get_day_period(this.date)];
      let classes = loadClasses();
      var q = query.windowQuery(this.windowBucketId, this.afkBucketId, 0, 0, this.filterAFK, classes);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.app_chunks = data["app_chunks"];
    },
  },
}
</script>
