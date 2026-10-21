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
// NOTE: This is just a Vue.js component wrapper for periodusage.ts
//       Code should generally go in the framework-independent file.

import periodusage from './periodusage';
import { hasFetchedHistory } from '~/stores/activity';

export default {
  name: 'aw-periodusage',
  props: {
    periodusage_arr: {
      type: Array,
      default: () => [],
    },
  },
  watch: {
    periodusage_arr: function () {
      periodusage.update(this.$el, this.periodusage_arr, this.onPeriodClicked, this.chartLabels());
    },
  },
  mounted: function () {
    periodusage.create(this.$el);
    // The data may already have loaded before this (async) component mounted,
    // in which case the watcher won't fire for it. Placeholders for periods
    // that are still being fetched don't count: they'd draw as no activity.
    if (this.periodusage_arr && hasFetchedHistory(this.periodusage_arr)) {
      periodusage.update(this.$el, this.periodusage_arr, this.onPeriodClicked, this.chartLabels());
    } else {
      periodusage.update(this.$el, this.periodusage_arr, this.onPeriodClicked, this.chartLabels());
    }
  },
  methods: {
    chartLabels() {
      return { noData: this.$t('visualizations.noData'), today: this.$t('common.today') };
    },
    onPeriodClicked: function (period) {
      this.$emit('update', period);
    },
  },
};
</script>
