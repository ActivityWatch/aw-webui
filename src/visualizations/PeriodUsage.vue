<template lang="pug">
svg
</template>

<style scoped lang="scss">
@import '../style/globals';

svg {
  width: 100%;
  height: 40pt;
  border: 1px solid $lightBorderColor;
  border-radius: 0.5em;
}
</style>

<script lang="ts">
// NOTE: This is just a Vue.js component wrapper for periodusage.js
//       Code should generally go in the framework-independent file.

import periodusage from './periodusage';
import { getLocale } from '~/i18n';

export default {
  name: 'aw-periodusage',
  props: {
    periodusage_arr: {
      type: Array,
    },
  },
  computed: {
    currentLocale() {
      return getLocale();
    },
  },
  watch: {
    periodusage_arr: function () {
      this.update();
    },
    currentLocale: function () {
      this.update();
    },
  },
  mounted: function () {
    periodusage.create(this.$el);
    periodusage.set_status(this.$el, this.$t('visualizationStatus.loading'));
  },
  methods: {
    update: function () {
      if (this.periodusage_arr) {
        periodusage.update(this.$el, this.periodusage_arr, this.onPeriodClicked);
      } else {
        periodusage.set_status(this.$el, this.$t('visualizationStatus.loading'));
      }
    },
    onPeriodClicked: function (period) {
      this.$emit('update', period);
    },
  },
};
</script>
