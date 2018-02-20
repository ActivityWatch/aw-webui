<template lang="pug">
div.aw-summary-container
</template>

<style scoped lang="scss">
svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for summary.js
//       Code should generally go in the framework-independent file.

import summary from './summary.js';

export default {
  name: 'AwSummary',
  props: {
    fields: {type: Array, required: true},
    namefunc: {type: Function, required: true},
    colorfunc: {type: Function, required: true},
  },

  watch: {
    fields: function() {
      summary.updateSummedEvents(
        this.$el,
        this.fields,
        this.namefunc,
        this.colorfunc,
      );
    },
  },

  mounted: function() {
    console.log('Mounting aw-summary');
    summary.create(this.$el);
    summary.set_status(this.$el, 'Loading...');
  },
};
</script>
