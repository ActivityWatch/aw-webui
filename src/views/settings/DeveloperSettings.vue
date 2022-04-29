<template lang="pug">
div
  h4.mb-3 Developer settings
    span.mx-2
    span(v-if="!showSettings")
      b-btn(@click="showSettings = true;" size="sm" variant="outline-dark")
        | Show
    span(v-else)
      b-btn(@click="showSettings = false;" size="sm" variant="outline-dark")
        | Hide
  div(v-if="showSettings")
    p These settings are meant for developers who (hopefully) know what they are doing.

    b-form-group(label="Force devmode" label-cols-md=3 description="Devmode enables some features that are still work-in-progress.")
      div
        b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

    b-form-group(label="Show yearly time range" label-cols-md=3 description="Querying an entire year is a very heavy operation, and is likely to lead to timeouts. However, the query might be fast enough if you're running aw-server-rust.")
      div
        b-form-checkbox.float-right.ml-2(v-model="showYearly" switch)
</template>

<script>
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
  },
};
</script>
