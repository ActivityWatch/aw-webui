<template lang="pug">
div
  h4.mb-3 Developer settings
  b-alert(show) #[b Note:] These settings are meant for developers who (hopefully) know what they are doing, and as such, may break things unexpectedly.

  b-form-group(label="Force devmode" label-cols-md=3 description="Devmode enables some features that are still work-in-progress.")
    div
      b-form-checkbox.float-right.ml-2(v-model="devmode" switch)

  b-form-group(label="Show yearly time range" label-cols-md=3 description="Querying an entire year is a very heavy operation, and is likely to lead to timeouts. However, the query might be fast enough if you're running aw-server-rust.")
    div
      b-form-checkbox.float-right.ml-2(v-model="showYearly" switch)

  b-form-group(label="Use multidevice query" label-cols-md=3 description="Multidevice query is where events are collected from several hosts in the Activity view. It is an early experiment, that currently does not support browser buckets (or the audible-as-active feature).")
    div
      b-form-checkbox.float-right.ml-2(v-model="useMultidevice" switch)

  b-form-group(label="Request timeout" label-cols-md=3 description="The maximum amount of time a server request can take before timing out. Setting this to a high value can be useful for large queries. Note that you need to reload the web UI for it to apply.")
    div
      b-input.float-right.ml-2(v-model="requestTimeout" type="number")

  div
    | Web UI commit hash: {{ COMMIT_HASH }}
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
