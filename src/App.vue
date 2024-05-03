<template lang="pug">
div#wrapper(v-if="loaded")
  aw-header

  div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
    div.aw-container.my-sm-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  aw-footer
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useServerStore } from '~/stores/server';
// if vite is used, you can import css file as module
//import darkCssUrl from '../static/dark.css?url';
//import darkCssContent from '../static/dark.css?inline';

export default {
  data: function () {
    return {
      activityViews: [],
      isNewReleaseCheckEnabled: !process.env.VUE_APP_ON_ANDROID,
      loaded: false,
    };
  },

  computed: {
    fullContainer() {
      return this.$route.meta.fullContainer;
    },
  },

  async beforeCreate() {
    // Get Theme From LocalStorage
    const settingsStore = useSettingsStore();
    await settingsStore.ensureLoaded();
    const theme = settingsStore.theme;
    // Check Application Mode (Light | Dark)
    if (theme !== null && theme === 'dark') {
      const method: 'link' | 'style' = 'link';

      if (method === 'link') {
        // Method 1: Create <link> Element
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = '/dark.css'; // darkCssUrl
        themeLink.rel = 'stylesheet';
        // Append Dark Theme Element If Selected Mode Is Dark
        theme === 'dark' ? document.querySelector('head').appendChild(themeLink) : '';
      } else {
        // Not supported for Webpack due to not supporting ?inline import in a cross-compatible way (afaik)
        // Method 2: Create <style> Element
        //const style = document.createElement('style');
        //style.innerHTML = darkCssContent;
        //theme === 'dark' ? document.querySelector('head').appendChild(style) : '';
      }
    }
    this.loaded = true;
  },

  mounted: async function () {
    const serverStore = useServerStore();
    await serverStore.getInfo();
  },
};
</script>
