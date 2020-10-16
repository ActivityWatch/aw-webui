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
  name: 'aw-timeline',
  props: {
    chunks: { type: Object },
    show_afk: { type: Boolean },
    chunkfunc: { type: Function },
    eventfunc: { type: Function },
  },
  watch: {
    chunks: function () {
      this.update();
    },
    show_afk: function () {
      this.update();
    },
  },
  mounted: function () {
    timeline.create(this.$el);
    this.update();
  },
  methods: {
    update: function () {
      if (this.chunks === null) {
        timeline.set_status(this.$el, 'Loading...');
      } else {
        timeline.update(this.$el, this.chunks, this.show_afk, this.chunkfunc, this.eventfunc);
      }
    },
  },
};
</script>
