<template lang="pug">
svg
</template>

<style scoped lang="scss">
svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script lang="ts">
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

import timeline_simple from './timeline-simple';

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
    // The events may already have loaded before this (async) component
    // mounted, in which case the watcher won't fire for them.
    if (this.events) {
      timeline_simple.update(this.$el, this.events, this.event_type);
    }
  },
};
</script>
