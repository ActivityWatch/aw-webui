<template lang="pug">
div
  b-alert(show variant="warning")
    b {{ $t('common.note') }}
    |
    | {{ $t('settings.developerNote') }}

  b-form-group(:label="$t('settings.developerForceDevmode')" label-cols-md=3 :description="$t('settings.developerForceDevmodeDescription')")
    div
      b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

  b-form-group(:label="$t('settings.developerShowYearly')" label-cols-md=3 :description="$t('settings.developerShowYearlyDescription')")
    div
      b-form-checkbox.float-right.ml-2(v-model="showYearly" switch)

  b-form-group(:label="$t('settings.developerUseMultidevice')" label-cols-md=3 :description="$t('settings.developerUseMultideviceDescription')")
    div
      b-form-checkbox.float-right.ml-2(v-model="useMultidevice" switch)

  b-form-group(:label="$t('settings.developerRequestTimeout')" label-cols-md=3 :description="$t('settings.developerRequestTimeoutDescription')")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  div
    | {{ $t('settings.developerWebUiCommitHash') }} {{ COMMIT_HASH }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  data() {
    return {
      showSettings: false,
    };
  },
  computed: {
    devmode: {
      get() {
        return useSettingsStore().devmode;
      },
      set(devmode) {
        useSettingsStore().update({ devmode });
      },
    },
    showYearly: {
      get() {
        return useSettingsStore().showYearly;
      },
      set(showYearly) {
        useSettingsStore().update({ showYearly });
      },
    },
    useMultidevice: {
      get() {
        return useSettingsStore().useMultidevice;
      },
      set(useMultidevice) {
        useSettingsStore().update({ useMultidevice });
      },
    },
    requestTimeout: {
      get() {
        return useSettingsStore().requestTimeout;
      },
      set(requestTimeout) {
        useSettingsStore().update({ requestTimeout });
      },
    },
  },
};
</script>
