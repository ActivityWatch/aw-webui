<template lang="pug">
svg
</template>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

// TODO: Sunburst requires a hierarchical data format

import sunburst from './sunburst.js';
import coloring_types from './coloring.js';

export default {
  name: "aw-sunburst,
  props: ['event_type', 'events'],
  mounted: function() {
    sunburst.create(this.$el);
  },
  watch: {
    "events": function() {
      sunburst.update(this.$el, this.events, event_type);
    }
  }
}
</script>
