<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.daystart.startOfDay') }}
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="startOfDay = $event")
  small.text-muted
    | {{ $t('settings.daystart.startOfDayHelp') }}

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.daystart.startOfWeek') }}
    div
      b-form-select(:text="startOfWeek", size="sm" v-model="startOfWeek" variant="outline-dark" :options="weekdayOptions")
  small.text-muted
    | {{ $t('settings.daystart.startOfWeekHelp') }}
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
    weekdayOptions() {
      return [
        { value: 'Saturday', text: this.$t('settings.daystart.saturday') },
        { value: 'Sunday', text: this.$t('settings.daystart.sunday') },
        { value: 'Monday', text: this.$t('settings.daystart.monday') },
      ];
    },
    startOfDay: {
      get: function () {
        return this.settingsStore.startOfDay;
      },
      set: function (value) {
        this.settingsStore.update({ startOfDay: value });
      },
    },
    startOfWeek: {
      get: function () {
        return this.settingsStore.startOfWeek;
      },
      set: function (value) {
        this.settingsStore.update({ startOfWeek: value });
      },
    },
  },
};
</script>
