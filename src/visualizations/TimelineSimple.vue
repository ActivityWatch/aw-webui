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

import timeline_simple from './timeline-simple.js';

export default {
  name: 'aw-timeline',
  props: {
    type: String,
    event_type: String,
    events: Array,
  },
  watch: {
    events: function () {
      timeline_simple.update(this.$el, this.events, this.event_type);
    },
  },
  mounted: function () {
    timeline_simple.create(this.$el);
  },
};
</script>
