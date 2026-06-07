<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 {{ $t('settings.releaseNotification.title') }}
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small
    | {{ $t('settings.releaseNotification.help') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  computed: {
    isEnabled: {
      get() {
        return useSettingsStore().newReleaseCheckData.isEnabled;
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
