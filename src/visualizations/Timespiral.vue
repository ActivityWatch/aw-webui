<template lang="pug">
svg
</template>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

//import timeline_simple from './timeline-simple.js';
import coloring_types from './coloring.js';

export default {
  name: "aw-timespiral,
  props: ['type', 'event_type', 'events'],
  mounted: function() {
    if(self.type !== undefined) {
      console.log("Unknown timeline type");
    }
  },
  watch: {
    "events": function() {
      // timeline.update(this.$el, this.events, event_type);
    }
  }
}
</script>
