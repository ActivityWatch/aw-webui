<template lang="pug">
div
  div(v-if="periodLength == 'day'")
    // This is commented out because it requires a special query return which can become huge for periodLength's that are not day.
    // It's not very useful anymore anyway since we have the timeline now.
    //div
      b-form-checkbox(v-model="timelineShowAFK")
        | Show AFK time
      aw-timeline-inspect(:chunks="app_chunks", :show_afk='timelineShowAFK', :chunkfunc='e => e.data.app', :eventfunc='e => e.data.title')
      hr
    aw-sunburst-clock(:date="date", :afkBucketId="bucket_id_afk", :windowBucketId="bucket_id_window")

  div(v-else)
    | Nothing to show here for the current period length: {{ periodLength }}
</template>

<script>
export default {
  name: "Activity",
  props: {
    date: String,
    periodLength: String,
    host: String
  },
  data: () => {
    return {
      timelineShowAFK: true,
    }
  },
  computed: {
    app_chunks: function() { return this.$store.state.activity_daily.app_chunks },
    bucket_id_window: function() { return 'aw-watcher-window_' + this.host; },
    bucket_id_afk: function() { return 'aw-watcher-afk_' + this.host; },
  },
}
</script>
