<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 {{ $t('settings.activePattern.title') }}

      small.text-muted
        | {{ $t('settings.activePattern.help1') }}
        |
        | {{ $t('settings.activePattern.help2') }}
        |
        span.text-nowrap
          | {{ $t('settings.activePattern.example') }}&nbsp;
          code(style="background-color: rgba(200, 200, 200, 0.3); padding: 2px 4px; border-radius: 2px;")
            | Zoom Meeting|Google Meet|Microsoft Teams
    div
      b-form-input(size="sm" v-model="always_active_pattern_editing" :state="(enabled || null) && valid")
      small.text-right
        div.text-success(v-if="enabled && valid") {{ $t('common.enabled') }}
        div.text-danger(v-else-if="enabled") {{ $t('settings.activePattern.invalid') }}
        div.text-muted(v-else) {{ $t('common.disabled') }}
        div.text-danger(v-if="enabled && valid && broad_pattern") {{ $t('settings.activePattern.tooBroad') }}

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
