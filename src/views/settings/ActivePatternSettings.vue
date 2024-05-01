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
      b-form-input(size="sm" v-model="always_active_pattern_editing" :state="(enabled || null) && valid")
      small.text-right
        div(v-if="enabled && valid" style="color: #0A0") Enabled
        div(v-else-if="enabled" style="color: #A00") Invalid pattern
        div(v-else, style="color: gray") Disabled
        div(v-if="enabled && valid && broad_pattern" style="color: #A00") Pattern too broad

</template>

<script lang="ts">
import { isRegexBroad, validateRegex } from '~/util/validate';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'ActivePatternSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
      always_active_pattern_editing: '',
    };
  },
  computed: {
    enabled: function () {
      return this.always_active_pattern_editing != '';
    },
    valid: function () {
      return validateRegex(this.always_active_pattern_editing);
    },
    broad_pattern: function () {
      // Check if the pattern matches random strings that we don't expect it to
      // like the alphabet
      const pattern = this.always_active_pattern_editing;
      if (pattern == '') {
        return false;
      }
      return isRegexBroad(pattern);
    },
    always_active_pattern: {
      get() {
        return this.settingsStore.always_active_pattern;
      },
      set(value) {
        console.log('Setting always_active_pattern to ' + value);
        this.settingsStore.update({ always_active_pattern: value });
      },
    },
  },
  watch: {
    always_active_pattern_editing: function (value) {
      if (value == this.always_active_pattern) {
        return;
      }

      if (
        (value != '' && this.valid) ||
        (value == '' && this.settingsStore.always_active_pattern.length != 0)
      ) {
        this.always_active_pattern = value;
      }
    },
  },
  mounted() {
    this.always_active_pattern_editing = this.settingsStore.always_active_pattern;
  },
};
</script>
