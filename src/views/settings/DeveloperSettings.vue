<template lang="pug">
div
  h4.mb-3 {{ $t('settings.developer') }}
  b-alert(show) #[b {{ $t('settings.developerNote') }}]

  b-form-group(:label="$t('settings.forceDevmode')" label-cols-md=3 :description="$t('settings.forceDevmodeDesc')")
    div
      b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

  b-form-group(:label="$t('settings.showYearly')" label-cols-md=3 :description="$t('settings.showYearlyDesc')")
    div
      b-form-checkbox.float-right.ml-2(v-model="showYearly" switch)

  b-form-group(:label="$t('settings.useMultidevice')" label-cols-md=3 :description="$t('settings.useMultideviceDesc')")
    div
      b-form-checkbox.float-right.ml-2(v-model="useMultidevice" switch)

  b-form-group(:label="$t('settings.requestTimeout')" label-cols-md=3 :description="$t('settings.requestTimeoutDesc')")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  div
    | {{ $t('settings.commitHash', { hash: COMMIT_HASH }) }}
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
