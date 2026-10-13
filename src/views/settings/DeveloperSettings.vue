<template lang="pug">
div
  b-alert(show variant="warning") #[b Note:] These settings are meant for developers who (hopefully) know what they are doing, and as such, may break things unexpectedly.

  div.d-flex.justify-content-between.align-items-center
    div
      h5.mb-0 Force devmode
    div
      b-form-checkbox(v-model="devmode" switch)
  small.text-muted
    | Devmode enables some features that are still work-in-progress.

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Request timeout
    div
      b-input(v-model="requestTimeout" type="number" size="sm")
  small.text-muted
    | The maximum amount of time a server request can take before timing out. Setting this to a high value can be useful for large queries. Note that you need to reload the web UI for it to apply.

  div.mt-3.d-flex.justify-content-between.align-items-center
    div.mr-2
      h5.mb-0 Hide unsupported visualizations
    div
      b-form-checkbox(v-model="hideUnsupportedVisualizations" switch)
  small.text-muted
    | Hide visualizations that lack required data instead of showing a warning. Disabled by default.

  div.mt-3
    | Web UI commit hash: {{ COMMIT_HASH }}
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
