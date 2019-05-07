<template lang="pug">
div
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
  props: ['chunks', 'total_duration', 'show_afk', 'chunkfunc', 'eventfunc'],
  mounted: function() {
    timeline.create(this.$el);
  },
  watch: {
    "chunks": function() {
      if(this.chunks.length == 0) {
        timeline.set_status(this.$el, 'Loading...')
      } else {
        timeline.update(this.$el, this.chunks, this.total_duration, this.show_afk, this.chunkfunc, this.eventfunc);
      }
    },
    "show_afk": function() {
      timeline.update(this.$el, this.chunks, this.total_duration, this.show_afk, this.chunkfunc, this.eventfunc);
    }
  }
}
</script>
