<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center
    div
      h5.mb-0 {{ $t('settings.uncategorizedHint.title') }}
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small.text-muted
    | {{ $t('settings.uncategorizedHint.help') }}

  div.mt-3(v-if="isEnabled")
    b-form-group(:label="$t('settings.uncategorizedHint.minimumTotalTime')" label-cols-md=4 label-class="small text-muted"
                 :description="$t('settings.uncategorizedHint.minimumTotalTimeHelp')")
      b-input(type="number" min="0" size="sm" v-model.number="minTotalMinutes")

    b-form-group.mb-0(:label="$t('settings.uncategorizedHint.minimumShare')" label-cols-md=4 label-class="small text-muted"
                     :description="$t('settings.uncategorizedHint.minimumShareHelp')")
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
