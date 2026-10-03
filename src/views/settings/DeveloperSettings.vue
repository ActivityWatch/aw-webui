<template lang="pug">
div
  b-alert(show variant="warning") #[b {{ $t('settings.developer.note') }}] {{ $t('settings.developer.noteBody') }}

  b-form-group(:label="$t('settings.developer.forceDevmode')" label-cols-md=3 :description="$t('settings.developer.forceDevmodeHelp')")
    div
      b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

  b-form-group(:label="$t('settings.developer.requestTimeout')" label-cols-md=3 :description="$t('settings.developer.requestTimeoutHelp')")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  b-form-group(:label="$t('settings.developer.hideUnsupported')" label-cols-md=3 :description="$t('settings.developer.hideUnsupportedHelp')")
    div
      b-form-checkbox.float-right.ml-2(v-model="hideUnsupportedVisualizations" switch)

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
    requestTimeout: {
      get() {
        return useSettingsStore().requestTimeout;
      },
      set(requestTimeout) {
        useSettingsStore().update({ requestTimeout });
      },
    },
    hideUnsupportedVisualizations: {
      get() {
        return useSettingsStore().hideUnsupportedVisualizations;
      },
      set(hideUnsupportedVisualizations) {
        useSettingsStore().update({ hideUnsupportedVisualizations });
      },
    },
  },
};
</script>
