<template lang="pug">
div
  b-alert.my-2(v-if="isVisible", variant="info", show dismissible @dismissed="onDismiss")
    p.mb-0
      | #[b High uncategorized time]
      router-link.ml-1.uncategorized-hint__cog(
        :to="{ path: '/settings/general' }"
        title="Hide or adjust this hint in Settings"
        aria-label="Hide or adjust this hint in Settings"
      )
        icon(name="cog" scale="0.85")
      br
      | You have a total of {{ uncategorizedDuration[0] | friendlyduration }} uncategorized time,
      | that's {{ Math.round(100 * uncategorizedDuration[0] / uncategorizedDuration[1]) }}% of all time {{ periodText }}.
      | You can address this by using the #[router-link(:to="{ path: '/settings/categorization', query: { builder: 'open' } }") Category Builder].
</template>

<script lang="ts">
import 'vue-awesome/icons/cog';
import { mapState } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { useSettingsStore } from '~/stores/settings';

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
    ...mapState(useSettingsStore, ['uncategorizedNotificationData']),
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
        day: 'today',
        week: 'this week',
        month: 'this month',
        year: 'this year',
        last7d: 'the last 7 days',
        last30d: 'the last 30 days',
      };
      return periodMap[this.periodLength] || 'today';
    },
    isVisible() {
      const cfg = this.uncategorizedNotificationData || {};
      if (cfg.isEnabled === false) return false;
      const minTotalSeconds =
        typeof cfg.minTotalSeconds === 'number' ? cfg.minTotalSeconds : 60 * 60;
      const minRatio = typeof cfg.minRatio === 'number' ? cfg.minRatio : 0.3;
      const overTotal = this.total > minTotalSeconds;
      const overRatio = this.ratio > minRatio;
      // if there's a category filter (url has category query param), don't show it
      const hasCategoryFilter = this.$route.query.category;
      return overTotal && overRatio && !hasCategoryFilter;
    },
  },
  methods: {
    onDismiss() {
      // Dismiss persists by disabling the hint outright; user can
      // re-enable from Settings → General.
      const settingsStore = useSettingsStore();
      settingsStore.update({
        uncategorizedNotificationData: {
          ...this.uncategorizedNotificationData,
          isEnabled: false,
        },
      });
    },
  },
};
</script>

<style scoped>
.uncategorized-hint__cog {
  color: inherit;
  opacity: 0.45;
}
.uncategorized-hint__cog:hover,
.uncategorized-hint__cog:focus {
  opacity: 0.85;
}
</style>
