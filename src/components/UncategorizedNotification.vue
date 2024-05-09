<template lang="pug">
div
  // TODO: Add some way to disable this notification, probably by making the ratio threshold configurable
  b-alert.my-2(v-if="isVisible", variant="info", show)
    p.mb-0
      | #[b High uncategorized time]
      br
      | You have a total of {{ uncategorizedDuration[0] | friendlyduration }} uncategorized time,
      | that's {{ Math.round(100 * uncategorizedDuration[0] / uncategorizedDuration[1]) }}% of all time today.
      | You can address this by using the #[router-link(:to="{ path: '/settings/category-builder' }") Category Builder].
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useActivityStore } from '~/stores/activity';

export default {
  name: 'aw-uncategorized-notification',
  computed: {
    ...mapState(useActivityStore, ['uncategorizedDuration']),
    ratio() {
      console.log(this.uncategorizedDuration);
      return this.uncategorizedDuration
        ? this.uncategorizedDuration[0] / this.uncategorizedDuration[1]
        : 0;
    },
    total() {
      return this.uncategorizedDuration ? this.uncategorizedDuration[1] : 0;
    },
    isVisible() {
      // TODO: make configurable?
      // if total duration is less than 1 hour, don't show it
      const overTotal = this.total > 60 * 60;
      // if ratio is > 0.3, show it
      const overRatio = this.ratio > 0.3;
      // if there's a category filter (url has category query param), don't show it
      const hasCategoryFilter = this.$route.query.category;
      return overTotal && overRatio && !hasCategoryFilter;
    },
  },
};
</script>
