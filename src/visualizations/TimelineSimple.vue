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
import { getLocale } from '~/i18n';

export default {
  name: 'aw-timeline',
  props: {
    type: String,
    event_type: String,
    events: Array,
  },
  computed: {
    currentLocale() {
      return getLocale();
    },
  },
  watch: {
    events: function () {
      this.update();
    },
    currentLocale: function () {
      this.update();
    },
  },
  mounted: function () {
    timeline_simple.create(this.$el);
    this.update();
  },
  methods: {
    update: function () {
      if (this.events) {
        timeline_simple.update(this.$el, this.events, this.event_type);
      }
    },
  },
};
</script>
