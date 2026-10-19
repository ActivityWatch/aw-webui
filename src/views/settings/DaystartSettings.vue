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
      b-form-select(:text="startOfWeekLabel" size="sm" v-model="startOfWeek" variant="outline-dark" :options="weekOptions")
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
    weekOptions() {
      return [
        { value: 'Saturday', text: this.$t('settings.daystart.saturday') },
        { value: 'Sunday', text: this.$t('settings.daystart.sunday') },
        { value: 'Monday', text: this.$t('settings.daystart.monday') },
      ];
    },
    startOfWeekLabel() {
      const option = this.weekOptions.find(item => item.value === this.startOfWeek);
      return option?.text || this.startOfWeek;
    },
  },
};
</script>
