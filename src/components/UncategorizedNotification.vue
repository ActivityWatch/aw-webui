<template lang="pug">
div
  b-alert.my-2(v-if="isVisible", variant="info", show dismissible @dismissed="onDismiss")
    p.mb-0
      | #[b {{ $t('uncategorized.title') }}]
      router-link.ml-1.uncategorized-hint__cog(
        :to="{ path: '/settings/general' }"
        :title="$t('uncategorized.settingsCogTitle')"
        :aria-label="$t('uncategorized.settingsCogTitle')"
      )
        icon(name="cog" scale="0.85")
      br
      | {{ uncategorizedBody }}
      | {{ $t('uncategorized.hint') }}
      | #[router-link(:to="{ path: '/settings/categorization', query: { builder: 'open' } }") {{ $t('uncategorized.categoryBuilder') }}].
</template>

<script lang="ts">
import 'vue-awesome/icons/cog';
import { mapState } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { useSettingsStore } from '~/stores/settings';
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
      const cfg = this.uncategorizedNotificationData || {};
      if (cfg.isEnabled === false) return false;
      const minTotalSeconds =
        typeof cfg.minTotalSeconds === 'number' ? cfg.minTotalSeconds : 60 * 60;
      const minRatio = typeof cfg.minRatio === 'number' ? cfg.minRatio : 0.3;
      const overTotal = this.total > minTotalSeconds;
      const overRatio = this.ratio > minRatio;
      const hasCategoryFilter = this.$route.query.category;
      return overTotal && overRatio && !hasCategoryFilter;
    },
  },
  methods: {
    onDismiss() {
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
