<template lang="pug">
div
  div.aw-summary-container
  // Use visibility to make sure elements don't skip when data finishes loading
  div(:style='{"visibility": visible_more ? "visible" : "hidden"}')
    b-button.mt-1.mr-2(v-if="fields && (limit_ < fields.length)", size="sm", variant="outline-secondary", @click="limit_ += 5")
      icon(name="angle-double-down")
      | Show more
    b-button.mt-1(v-if="limit_ != limit" size="sm", variant="outline-secondary", @click="limit_ = limit")
      icon(name="angle-double-up")
</template>

<style scoped lang="scss">
.aw-summary-container > svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for summary.ts
//       Code should generally go in the framework-independent file.

import summary from './summary';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

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
    linkfunc: {
      type: Function,
      default: () => null,
    },
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
  computed: {
    visible_more() {
      return this.fields && this.fields.length > 0 && this.with_limit;
    },
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
      if (this.fields) {
        summary.updateSummedEvents(
          el,
          this.fields.slice(0, this.limit_),
          this.namefunc,
          this.hoverfunc,
          this.colorfunc,
          this.linkfunc
        );
      } else {
        summary.set_status(el, 'Loading...');
      }
    },
  },
};
</script>
