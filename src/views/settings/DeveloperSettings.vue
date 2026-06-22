<template lang="pug">
div
  b-alert(show variant="warning") #[b {{ $t('settings.developer.note') }}] {{ $t('settings.developer.noteBody') }}

  b-form-group(:label="$t('settings.developer.forceDevmode')" label-cols-md=3 :description="$t('settings.developer.forceDevmodeHelp')")
    div
      b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

  b-form-group(:label="$t('settings.developer.showYearly')" label-cols-md=3 :description="$t('settings.developer.showYearlyHelp')")
    div
      b-form-checkbox.float-right.ml-2(v-model="showYearly" switch)

  b-form-group(:label="$t('settings.developer.multidevice')" label-cols-md=3 :description="$t('settings.developer.multideviceHelp')")
    div
      b-form-checkbox.float-right.ml-2(v-model="useMultidevice" switch)

  b-form-group(:label="$t('settings.developer.requestTimeout')" label-cols-md=3 :description="$t('settings.developer.requestTimeoutHelp')")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  div
    | {{ $t('settings.developer.commitHash') }} {{ COMMIT_HASH }}
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
