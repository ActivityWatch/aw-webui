<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.theme') }}
    div
      b-select.landingpage(v-if="_loaded" size="sm" :value="theme", @change="theme = $event")
        option(value="auto") {{ $t('settings.themeAuto') }}
        option(value="light") {{ $t('settings.themeLight') }}
        option(value="dark") {{ $t('settings.themeDark') }}
      span(v-else)
        .aw-loading {{ $t('loading') }}
  small {{ $t('settings.themeDesc') }}

  hr

  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.language') }}
    div
      b-select.landingpage(size="sm" :value="$i18n.locale", @change="changeLanguage($event)")
        option(value="en") {{ $t('settings.english') }}
        option(value="zh") {{ $t('settings.chinese') }}
  small {{ $t('settings.languageDesc') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { detectPreferredTheme } from '~/util/theme';

export default {
  name: 'Theme',
  methods: {
    changeLanguage(locale) {
      this.$i18n.locale = locale;
      localStorage.setItem('locale', locale);
      const settingsStore = useSettingsStore();
      settingsStore.update({ locale });
    },
  },
  computed: {
    ...mapState(useSettingsStore, ['_loaded']),
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
