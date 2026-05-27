<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 {{ $t('settings.newRelease') }}
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small
    | {{ $t('settings.newReleaseDesc') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  computed: {
    isEnabled: {
      get() {
        const settingsStore = useSettingsStore();
        return settingsStore.newReleaseCheckData.isEnabled;
      },
      set(value) {
        const settingsStore = useSettingsStore();
        const data = settingsStore.newReleaseCheckData;
        settingsStore.update({
          newReleaseCheckData: { ...data, isEnabled: value },
        });
      },
    },
  },
};
</script>
