<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Start of day
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="startOfDay = $event")
  small
    | The time at which days "start", since humans don't always go to bed before midnight.
    | Set to 04:00 by default.

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Start of week
    div
      b-form-select(:text="startOfWeek", size="sm" v-model="startOfWeek" variant="outline-dark" :options="['Sunday', 'Monday']")
  small
    | The weekday which starts a new week.
</template>
<script>
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'DaystartSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    startOfDay: {
      get: function () {
        return this.settingsStore.startOfDay;
      },
      set: function (value) {
        console.log('Set start of day to ' + value);
        this.settingsStore.update({ startOfDay: value });
      },
    },
    startOfWeek: {
      get: function () {
        return this.settingsStore.startOfWeek;
      },
      set: function (value) {
        console.log('Set start of week to ' + value);
        this.settingsStore.update({ startOfWeek: value });
      },
    },
  },
};
</script>
