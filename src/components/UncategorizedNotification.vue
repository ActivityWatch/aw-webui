<template lang="pug">
div
  b-alert.my-2(v-if="isVisible", variant="info", show dismissible @dismissed="onDismiss")
    p.mb-0
      b {{ $t('notifications.highUncategorizedTime') }}
      router-link.ml-1.uncategorized-hint__cog(
        :to="{ path: '/settings/general' }"
        :title="$t('notifications.adjustHintInSettings')"
        :aria-label="$t('notifications.adjustHintInSettings')"
      )
        icon(name="cog" scale="0.85")
      br
      span {{ $t('notifications.uncategorizedSummary', { duration: formattedUncategorizedDuration, percent: uncategorizedPercent, period: periodText }) }}
      span.ml-1 {{ $t('notifications.categoryBuilderHintBefore') }}
      router-link(:to="{ path: '/settings/categorization', query: { builder: 'open' } }") {{ $t('notifications.categoryBuilder') }}
      span {{ $t('notifications.categoryBuilderHintAfter') }}
</template>

<script lang="ts">
import Vue from 'vue';
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
        day: this.$t('notifications.periodToday'),
        week: this.$t('notifications.periodThisWeek'),
        month: this.$t('notifications.periodThisMonth'),
        year: this.$t('notifications.periodThisYear'),
        last7d: this.$t('notifications.periodLast7Days'),
        last30d: this.$t('notifications.periodLast30Days'),
      };
      return periodMap[this.periodLength] || this.$t('notifications.periodToday');
    },
    formattedUncategorizedDuration() {
      const friendlyDuration = Vue.filter('friendlyduration');
      return friendlyDuration(this.uncategorizedDuration[0]);
    },
    uncategorizedPercent() {
      return Math.round((100 * this.uncategorizedDuration[0]) / this.uncategorizedDuration[1]);
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
