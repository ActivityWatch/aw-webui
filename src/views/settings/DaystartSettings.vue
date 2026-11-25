<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.daystart.startOfDay') }}
    div
      b-input(type="time" size="sm" :key="startOfDayInputKey" :value="startOfDay" @change="startOfDay = $event" @blur="resetInvalidStartOfDay")
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

const VALID_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export default {
  name: 'DaystartSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
      // Bumped on blur to reset the input to the stored value after an invalid
      // entry. Not bumped on change: browsers emit change with '' as soon as a
      // segment is blanked mid-edit, and remounting then would drop focus.
      startOfDayInputKey: 0,
    };
  },
  computed: {
    startOfDay: {
      get: function () {
        return this.settingsStore.startOfDay;
      },
      set: function (value) {
        // Clearing the time input yields '', which would save a start of day
        // that get_hour_offset() parses as NaN ("NaN" hour labels).
        if (!VALID_TIME.test(value)) return;
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
  methods: {
    resetInvalidStartOfDay(event: FocusEvent) {
      const value = (event.target as HTMLInputElement).value;
      if (!VALID_TIME.test(value)) this.startOfDayInputKey++;
    },
  },
};
</script>
