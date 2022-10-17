<template lang="pug">
div
  // TODO: Add some way to disable this notification
  b-alert.my-2(v-if="isVisible", variant="info", show)
    p.mb-0
      | #[b High uncategorized time]
      br
      | You have a total of {{ uncategorizedDuration[0] | friendlyduration }} uncategorized time,
      | that's {{ Math.round(100 * uncategorizedDuration[0] / uncategorizedDuration[1]) }}% of all time today.
      | You can address this by using the #[router-link(:to="{ path: '/settings/category-builder' }") Category Builder].
</template>

<script>
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
    isVisible() {
      return this.ratio > 0.01;
    },
  },
};
</script>
