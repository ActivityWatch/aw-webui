<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.theme.title') }}
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
    | {{ $t('settings.theme.help') }}
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
        { value: 'auto', label: this.$t('settings.theme.auto'), icon: 'desktop' },
        { value: 'light', label: this.$t('settings.theme.light'), icon: 'sun' },
        { value: 'dark', label: this.$t('settings.theme.dark'), icon: 'moon' },
      ];
    },
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
