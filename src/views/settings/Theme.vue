<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Theme
    div
      b-select.landingpage(v-if="_loaded" size="sm" :value="theme", @change="theme = $event")
        option(value="light") Light
        option(value="dark") Dark
      span(v-else)
        .aw-loading Loading...
  small
    | Change color theme of the application (you need to change categories colors manually to be suitable with dark mode).
</template>

<script>
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'Theme',
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

        // Apply newly set theme
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = '/static/dark.css';
        themeLink.rel = 'stylesheet';
        // Append Dark Theme Element If Selected Mode Is Dark
        value === 'dark'
          ? document.querySelector('head').appendChild(themeLink)
          : document.querySelector('link[href="/static/dark.css"]').remove();
      },
    },
  },
};
</script>
