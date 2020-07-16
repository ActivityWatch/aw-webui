<template lang="pug">
div
  div.aw-summary-container
  b-button.mt-1(v-if="fields && fields.length > 0 && with_limit && fields.length > limit_", size="sm", variant="outline-secondary", @click="limit_ += 5")
    icon(name="angle-double-down")
    | Show more
</template>

<style scoped lang="scss">
.aw-summary-container > svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for summary.js
//       Code should generally go in the framework-independent file.

import summary from './summary.js';
import 'vue-awesome/icons/angle-double-down';

export default {
  name: 'aw-summary',
  props: {
    fields: Array,
    namefunc: Function,
    hoverfunc: {
      type: Function,
      default: null, // If not set we will default to namefunc
    },
    colorfunc: Function,
    limit: {
      type: Number,
      default: 5,
    },
    with_limit: {
      type: Boolean,
      default: false,
    },
  },
  data: function () {
    return { limit_: this.limit };
  },
  watch: {
    fields: function () {
      this.update();
    },
    limit_: function () {
      this.update();
    },
  },
  mounted: function () {
    const el = this.$el.children[0];
    summary.create(el);
    this.update();
  },
  methods: {
    update: function () {
      const el = this.$el.children[0];
      if (this.fields !== null) {
        summary.updateSummedEvents(
          el,
          this.fields.slice(0, this.limit_),
          this.namefunc,
          this.hoverfunc,
          this.colorfunc
        );
      } else {
        summary.set_status(el, 'Loading...');
      }
    },
  },
};
</script>
