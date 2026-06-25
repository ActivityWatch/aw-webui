<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settingsSections.startOfDay') }}
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="startOfDay = $event")
  small.text-muted
    | {{ $t('settings.startOfDayDescription') }}
    |
    | {{ $t('settings.startOfDayDefault') }}

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settingsSections.startOfWeek') }}
    div
      b-form-select(:text="startOfWeek", size="sm" v-model="startOfWeek" variant="outline-dark" :options="startOfWeekOptions")
  small.text-muted
    | {{ $t('settings.startOfWeekDescription') }}
</template>
<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'DaystartSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    startOfWeekOptions: function () {
      return [
        { text: this.$t('settings.weekSaturday'), value: 'Saturday' },
        { text: this.$t('settings.weekSunday'), value: 'Sunday' },
        { text: this.$t('settings.weekMonday'), value: 'Monday' },
      ];
    },
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
