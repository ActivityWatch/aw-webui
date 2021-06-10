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

<script>
// NOTE: This is just a Vue.js component wrapper for periodusage.js
//       Code should generally go in the framework-independent file.

import periodusage from './periodusage.js';

export default {
  name: 'aw-periodusage',
  props: {
    periodusage_arr: {
      type: Array,
    },
  },
  watch: {
    periodusage_arr: function () {
      periodusage.update(this.$el, this.periodusage_arr, this.onPeriodClicked);
    },
  },
  mounted: function () {
    periodusage.create(this.$el);
    periodusage.set_status(this.$el, 'Loading...');
  },
  methods: {
    onPeriodClicked: function (period) {
      this.$emit('update', period);
    },
  },
};
</script>
