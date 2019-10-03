<template lang="pug">
div
  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  aw-timeline-inspect(:chunks="app_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.app', :eventfunc='e => e.data.title')

  hr

  aw-sunburst(:date="date", :afkBucketId="bucket_id_afk", :windowBucketId="bucket_id_window")
</template>

<script>
import {get_day_period} from "~/util/time.js";

import query from '~/queries.js';


export default {
  name: "Activity",
  props: ['date', 'host'],
  data: () => {
    return {
      timelineShowAFK: true,
    }
  },
  watch: {
    '$route': function() {
      this.refresh();
    },
  },

  computed: {
    app_chunks: function() { return this.$store.state.activity_daily.app_chunks },
    bucket_id_window: function() { return 'aw-watcher-window_' + this.host; },
    bucket_id_afk: function() { return 'aw-watcher-afk_' + this.host; },
  },

  mounted: async function() {
    await this.refresh();
  },

  methods: {
    refresh: async function() {
      await this.$store.dispatch("activity_daily/ensure_loaded", { aw_client: this.$aw, date: this.date, host: this.host });
    },
  },
}
</script>
