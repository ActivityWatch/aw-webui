<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 Never Treat as AFK Filter
    div
      b-form-input(size="sm" v-model="NeverAfkFilterSettings")

  small
    | Apps or Titles passing this regular expression filter will never be counted as AFK. Can be used to count time spent in meetings where there is little to no input, or games that use input methods not detected by the AFK watcher. Example expression, #[code(style="font-size:100%") Zoom Meeting|Google Meet] 
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
        return this.settingsStore.always_active_pattern;
      },
      set(value) {
        if (value.trim().length != 0 || this.settingsStore.always_active_pattern.length != 0) {
          console.log('Setting NeverAfkFilterSetting to ' + value);
          this.settingsStore.update({ ActivityData: { always_active_pattern: value } });
        }
      },
    },
  },
};
</script>
