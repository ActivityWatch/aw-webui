<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div
      h5.mb-0 Uncategorized-time hint
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small.text-muted
    | Shows a banner on the Activity view when too much of your tracked
    | time falls into the Uncategorized bucket — handy for noticing when
    | you need to refine your categorization rules.

  div.mt-3(v-if="isEnabled")
    b-form-group(label="Minimum total tracked time" label-cols-md=4 label-class="small text-muted"
                 description="The hint stays hidden when total tracked time in the period is below this many minutes.")
      b-input(type="number" min="0" size="sm" v-model.number="minTotalMinutes")

    b-form-group.mb-0(label="Minimum uncategorized share" label-cols-md=4 label-class="small text-muted"
                     description="The hint appears once the uncategorized fraction crosses this percentage.")
      b-input-group(size="sm" append="%")
        b-input(type="number" min="0" max="100" v-model.number="minRatioPct")
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'UncategorizedHintSettings',
  computed: {
    config(): { isEnabled: boolean; minTotalSeconds: number; minRatio: number } {
      return useSettingsStore().uncategorizedNotificationData;
    },
    isEnabled: {
      get(): boolean {
        return !!this.config?.isEnabled;
      },
      set(v: boolean) {
        this.update({ isEnabled: v });
      },
    },
    minTotalMinutes: {
      get(): number {
        return Math.round((this.config?.minTotalSeconds ?? 3600) / 60);
      },
      set(v: number) {
        const minutes = Number.isFinite(v) ? Math.max(0, v) : 0;
        this.update({ minTotalSeconds: minutes * 60 });
      },
    },
    minRatioPct: {
      get(): number {
        return Math.round((this.config?.minRatio ?? 0.3) * 100);
      },
      set(v: number) {
        const pct = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
        this.update({ minRatio: pct / 100 });
      },
    },
  },
  methods: {
    update(patch: Record<string, unknown>) {
      const settingsStore = useSettingsStore();
      settingsStore.update({
        uncategorizedNotificationData: { ...this.config, ...patch },
      });
    },
  },
};
</script>
