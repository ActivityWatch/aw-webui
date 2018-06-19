<template lang="pug">
div#apptimeline-container
</template>

<style scoped lang="scss">
svg {
    border: 1px solid #999;
    border-radius: 0.5em;
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline.js
//       Code should generally go in the framework-independent file.

import timeline from './timeline.js';

export default {
  name: "aw-timeline",
  props: ['chunks', 'total_duration', 'show_afk'],
  mounted: function() {
    console.log("Mounting aw-timeline");
    var timeline_elem = document.getElementById("apptimeline-container");
    timeline.create(timeline_elem);
  },
  methods: {
    get_timeline_elem: function() {
      return document.getElementById("apptimeline-container");
    }
  },
  watch: {
    "chunks": function() {
      if(this.chunks.length == 0) {
        timeline.set_status(this.get_timeline_elem(), 'Loading...')
      } else {
        timeline.update(this.get_timeline_elem(), this.chunks, this.total_duration, this.show_afk);
      }
    },
    "show_afk": function() {
      var timeline_elem = document.getElementById("apptimeline-container");
      timeline.update(this.get_timeline_elem(), this.chunks, this.total_duration, this.show_afk);
    }
  }
}
</script>
