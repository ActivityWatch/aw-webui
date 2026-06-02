<template lang="pug">
div
  // TODO: Add some way to disable this notification, probably by making the ratio threshold configurable
  b-alert.my-2(v-if="isVisible", variant="info", show)
    p.mb-0
      | #[b {{ $t('uncategorized.title') }}]
      br
      | {{ uncategorizedBody }}
      | {{ $t('uncategorized.hint') }}
      | #[router-link(:to="{ path: '/settings/category-builder' }") {{ $t('uncategorized.categoryBuilder') }}].
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { seconds_to_duration } from '~/util/time';

export default {
  name: 'aw-uncategorized-notification',
  props: {
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  computed: {
    ...mapState(useActivityStore, ['uncategorizedDuration']),
    ratio() {
      return this.uncategorizedDuration
        ? this.uncategorizedDuration[0] / this.uncategorizedDuration[1]
        : 0;
    },
    total() {
      return this.uncategorizedDuration ? this.uncategorizedDuration[1] : 0;
    },
    periodText() {
      const periodMap: Record<string, string> = {
        day: 'uncategorized.periodToday',
        week: 'uncategorized.periodThisWeek',
        month: 'uncategorized.periodThisMonth',
        year: 'uncategorized.periodThisYear',
        last7d: 'uncategorized.periodLast7d',
        last30d: 'uncategorized.periodLast30d',
      };
      const key = periodMap[this.periodLength] || 'uncategorized.periodToday';
      return this.$t(key);
    },
    uncategorizedBody() {
      if (!this.uncategorizedDuration) {
        return '';
      }
      const duration = seconds_to_duration(this.uncategorizedDuration[0]);
      const percent = Math.round(
        (100 * this.uncategorizedDuration[0]) / this.uncategorizedDuration[1]
      );
      return this.$t('uncategorized.body', {
        duration,
        percent,
        period: this.periodText,
      });
    },
    isVisible() {
      const overTotal = this.total > 60 * 60;
      const overRatio = this.ratio > 0.3;
      const hasCategoryFilter = this.$route.query.category;
      return overTotal && overRatio && !hasCategoryFilter;
    },
  },
};
</script>
