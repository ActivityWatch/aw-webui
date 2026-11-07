<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div.mr-2
      h5.mb-0#supporter-label I already support ActivityWatch
    div
      b-form-checkbox(v-model="supporter" switch aria-labelledby="supporter-label")
  small.text-muted
    | Hides the in-app prompts asking you to support ActivityWatch (this also
    | applies to the desktop tray item). Honor system — the setting is stored in
    | your local server and nothing is checked or sent anywhere.
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'SupporterSettings',
  computed: {
    supporter: {
      get(): boolean {
        return !!useSettingsStore().supporter;
      },
      set(v: boolean) {
        useSettingsStore().update({ supporter: v });
      },
    },
  },
};
</script>
