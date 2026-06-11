<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settingsSections.theme') }}
    div
      b-button-group(v-if="_loaded" size="sm")
        b-button(
          v-for="opt in themeOptions"
          :key="opt.value"
          :pressed="theme === opt.value"
          @click="theme = opt.value"
          variant="outline-dark"
        )
          icon.mr-1(:name="opt.icon")
          | {{ opt.label }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small.text-muted
    | {{ $t('settings.themeDescription') }}
</template>

<script lang="ts">
import 'vue-awesome/icons/desktop';
import 'vue-awesome/icons/sun';
import 'vue-awesome/icons/moon';
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { detectPreferredTheme } from '~/util/theme';

export default {
  name: 'Theme',
  computed: {
    ...mapState(useSettingsStore, ['_loaded']),
    themeOptions() {
      return [
        { value: 'auto', label: this.$t('settings.themeSystem'), icon: 'desktop' },
        { value: 'light', label: this.$t('settings.themeLight'), icon: 'sun' },
        { value: 'dark', label: this.$t('settings.themeDark'), icon: 'moon' },
      ];
    },
    theme: {
      get() {
        const settingsStore = useSettingsStore();
        return settingsStore.theme;
      },
      set(value) {
        console.log('Set theme to ' + value);
        const settingsStore = useSettingsStore();
        settingsStore.update({
          theme: value,
        });

        // Determine the actual theme to apply
        const detectedTheme = value === 'auto' ? detectPreferredTheme() : value;

        // Apply newly set theme
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = '/dark.css';
        themeLink.rel = 'stylesheet';

        // Remove existing theme link if present
        document.querySelector(`link[href="${new URL(themeLink.href).pathname}"]`)?.remove();

        // Append Dark Theme Element if dark theme should be applied
        if (detectedTheme === 'dark') {
          document.querySelector('head').appendChild(themeLink);
        }
      },
    },
  },
};
</script>
