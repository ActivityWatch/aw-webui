<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 Never Treat as Afk Filter
    div
      b-form-input(size="sm" v-model="NeverAfkFilterSettings")

  small
    | Apps or Titles passing this Regex filter will never be counted as afk.
</template>

<script>
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'NeverAfkFilterSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    NeverAfkFilterSettings: {
      get() {
        return this.settingsStore.ActivityData.always_active_pattern;
      },
      set(value) {
        console.log('Setting NeverAfkFilterSetting to ' + value);
        this.settingsStore.update({ ActivityData: { always_active_pattern: value } });
      },
    },
  },
};
</script>
