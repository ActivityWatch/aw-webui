<template lang="pug">
div
</template>

<style scoped lang="scss">
svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script lang="ts">
// NOTE: This is just a Vue.js component wrapper for timeline.ts
//       Code should generally go in the framework-independent file.

import timeline from './timeline';
import { getLocale } from '~/i18n';

export default {
  name: 'aw-timeline',
  props: {
    chunks: { type: Object },
    show_afk: { type: Boolean },
    chunkfunc: { type: Function },
    eventfunc: { type: Function },
  },
  computed: {
    currentLocale() {
      return getLocale();
    },
  },
  watch: {
    chunks: function () {
      this.update();
    },
    show_afk: function () {
      this.update();
    },
    currentLocale: function () {
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
        timeline.set_status(this.$el, this.$t('visualizationStatus.loading'));
      } else {
        timeline.update(this.$el, this.chunks, this.show_afk, this.chunkfunc, this.eventfunc);
      }
    },
  },
};
</script>
