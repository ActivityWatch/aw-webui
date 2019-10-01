<template lang="pug">
div
  b-form-checkbox(v-model="timelineShowAFK")
    | Show AFK time

  aw-timeline-inspect(:chunks="app_chunks", :total_duration='duration', :show_afk='timelineShowAFK', :chunkfunc='app_chunkfunc', :eventfunc='app_eventfunc')

  hr

  aw-sunburst(:date="date", :afkBucketId="afkBucketId", :windowBucketId="windowBucketId")

</template>

<script>
import moment from 'moment';
import time from "../util/time.js";
import {loadClasses} from "../util/classes.js";

import query from '../queries.js';


export default {
  name: "Activity",
  data: () => {
    return {
      today: moment().startOf('day').format("YYYY-MM-DD"),
      timelineShowAFK: true,

      // Query variables
      duration: "",
      errormsg: "",

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
    host: function() { return this.$route.params.host },
    // TODO: Move somewhere else (reduce code duplication)
    date: function() { return time.get_day_start_with_offset(this.$route.params.date) },
    dateStart: function() { return this.date },
    dateEnd: function() { return moment(this.date).add(1, 'days').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
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

    errorHandler: function(error) {
      this.errormsg = "" + error + ". See dev console (F12) and/or server logs for more info.";
      throw error;
    },

    queryAll: function() {
      this.queryWindows();
    },

    // TODO: Move to vuex store
    queryWindows: async function() {
      var periods = [this.dateStart + "/" + this.dateEnd];
      let classes = loadClasses();
      var q = query.windowQuery(this.windowBucketId, this.afkBucketId, 0, 0, this.filterAFK, classes);
      let data = await this.$aw.query(periods, q).catch(this.errorHandler);
      data = data[0];
      this.app_chunks = data["app_chunks"];
    },
  },
}
</script>
