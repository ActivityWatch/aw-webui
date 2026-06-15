<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center
    div
      h5.mb-0 {{ $t('settings.releaseNotification.title') }}
    div
      b-form-checkbox(v-model="isEnabled", switch)
  small.text-muted
    | {{ $t('settings.releaseNotification.help') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'ReleaseNotificationSettings',
  computed: {
    isEnabled: {
      get: function () {
        return useSettingsStore().newReleaseCheckData.isEnabled;
      },
      set: function (value) {
        useSettingsStore().update({
          newReleaseCheckData: {
            ...useSettingsStore().newReleaseCheckData,
            isEnabled: value,
          },
        });
      },
    },
  },
};
</script>
