<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 Always count as active pattern

      small
        | Apps or titles matching this regular expression will never be counted as AFK.
        |
        | Can be used to count time as active, despite no input (like meetings, or games with controllers). An empty string disables it.
        |
        | Example expression:&nbsp;
        code(style="background-color: rgba(200, 200, 200, 0.3); padding: 2px; border-radius: 2px;")
          | Zoom Meeting|Google Meet|Microsoft Teams
    div
      b-form-input(size="sm" v-model="always_active_pattern")
      small.text-right
        div(v-if="enabled" style="color: #0A0") Enabled
        div(v-else, style="color: gray") Disabled
        div(v-if="enabled && broad_pattern" style="color: #A00") Pattern too broad

</template>

<script>
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'ActivePatternSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    enabled: function () {
      return this.settingsStore.always_active_pattern != '';
    },
    broad_pattern: function () {
      // Check if the pattern matches random strings that we don't expect it to
      // like the alphabet
      const pattern = this.settingsStore.always_active_pattern;
      if (pattern == '') {
        return false;
      }
      const re = new RegExp(pattern);
      const alphabet = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      return re.test(
        'THIS STRING SHOULD PROBABLY NOT MATCH: ' + alphabet + alphabet.toUpperCase() + numbers
      );
    },
    always_active_pattern: {
      get() {
        return this.settingsStore.always_active_pattern;
      },
      set(value) {
        if (value.trim().length != 0 || this.settingsStore.always_active_pattern.length != 0) {
          console.log('Setting always_active_pattern to ' + value);
          this.settingsStore.update({ always_active_pattern: value });
        }
      },
    },
  },
};
</script>
