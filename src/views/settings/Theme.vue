<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.theme.title') }}
    div
      b-select.landingpage(v-if="_loaded" size="sm" :value="theme", @change="theme = $event")
        option(value="auto") {{ $t('settings.theme.auto') }}
        option(value="light") {{ $t('settings.theme.light') }}
        option(value="dark") {{ $t('settings.theme.dark') }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small
    | {{ $t('settings.theme.help') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { detectPreferredTheme } from '~/util/theme';

export default {
  name: 'Theme',
  computed: {
    ...mapState(useSettingsStore, ['_loaded']),
    theme: {
      get() {
        return useSettingsStore().theme;
      },
      set(value) {
        const settingsStore = useSettingsStore();
        settingsStore.update({ theme: value });

        const detectedTheme = value === 'auto' ? detectPreferredTheme() : value;

        const themeLink = document.createElement('link');
        themeLink.href = '/dark.css';
        themeLink.rel = 'stylesheet';

        document.querySelector(`link[href="${new URL(themeLink.href).pathname}"]`)?.remove();

        if (detectedTheme === 'dark') {
          document.querySelector('head').appendChild(themeLink);
        }
      },
    },
  },
};
</script>
