<template lang="pug">
svg
</template>

<style scoped lang="scss">
svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

// TODO: Integrate timeline-browser (old timeline)

import timeline_simple from './timeline-simple.js';

export default {
  name: 'AwTimeline',
  props: {
    type: {type: String, required: true},
    event_type: {type: String, required: true},
    events: {type: Array, required: true},
  },

  watch: {
    events: function() {
      timeline_simple.update(this.$el, this.events, this.event_type);
    },
  },

  mounted: function() {
    if (this.type == 'simple') {
      timeline_simple.create(this.$el);
    } else {
      console.error('Unknown type');
    }
  },
};
</script>
