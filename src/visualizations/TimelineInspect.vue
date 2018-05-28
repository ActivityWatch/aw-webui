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
  props: ['events', 'total_duration', 'show_afk'],
  mounted: function() {
    var timeline_elem = document.getElementById("apptimeline-container");
    timeline.create(timeline_elem);
  },
  watch: {
    "events": function() {
      var timeline_elem = document.getElementById("apptimeline-container");
      if(this.events.length == 0) {
        timeline.set_status(timeline_elem, 'Loading...')
      } else {
        timeline.update(timeline_elem, this.events, this.total_duration, this.show_afk);
      }
    }
  }
}
</script>
