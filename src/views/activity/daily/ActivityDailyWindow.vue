<template lang="pug">
div
  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  aw-timeline-inspect(:chunks="app_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.app', :eventfunc='e => e.data.title')

  hr

  aw-sunburst-clock(:date="date", :afkBucketId="bucket_id_afk", :windowBucketId="bucket_id_window")
</template>

<script>
import {get_day_period} from "~/util/time.js";
import query from '~/queries.js';

export default {
  name: "Activity",
  props: ['date', 'host'],
  data: () => {
    return {
      // FIXME: Broken when true
      timelineShowAFK: false,
    }
  },
  computed: {
    app_chunks: function() { return this.$store.state.activity_daily.app_chunks },
    bucket_id_window: function() { return 'aw-watcher-window_' + this.host; },
    bucket_id_afk: function() { return 'aw-watcher-afk_' + this.host; },
  },
}
</script>
