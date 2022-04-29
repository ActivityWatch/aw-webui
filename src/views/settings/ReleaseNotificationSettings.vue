<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 New release notification
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small
    | We will send you a notification if there is a new release available for download, this check will happen at most once per day.
</template>

<script>
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
