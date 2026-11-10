<template lang="pug">
div#wrapper(v-if="loaded")
  aw-header

  div.aw-content(:class="{'container': !fullContainer, 'container-fluid': fullContainer}" :style="contentStyle").px-0.px-md-2
    div.aw-container.my-sm-3.mb-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  aw-footer
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useServerStore } from '~/stores/server';
import { DARK_THEME_HREF, detectPreferredTheme } from '~/util/theme';
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
    contentStyle() {
      const width = useSettingsStore().contentWidth;
      // A max-width plus 100% width cannot grow beyond the viewport. Keep
      // Bootstrap's route-specific breakpoints untouched in automatic mode.
      return width === 0 ? {} : { maxWidth: `${width}px`, width: '100%' };
    },
  },

  async beforeCreate() {
    // Get Theme From LocalStorage
    const settingsStore = useSettingsStore();
    await settingsStore.ensureLoaded();
    const theme = settingsStore.theme;
    const detectedTheme = theme === 'auto' ? detectPreferredTheme() : theme;

    // Apply the dark theme if detected
    if (detectedTheme === 'dark') {
      const method: 'link' | 'style' = 'link';

      if (method === 'link') {
        // Method 1: Create <link> Element
        // Create Dark Theme Element
        const themeLink = document.createElement('link');
        themeLink.href = DARK_THEME_HREF; // darkCssUrl
        themeLink.rel = 'stylesheet';
        // Append Dark Theme Element
        document.querySelector('head').appendChild(themeLink);
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

  created() {
    const root = document.documentElement;
    const previousSize = root.style.getPropertyValue('font-size');
    const previousPriority = root.style.getPropertyPriority('font-size');
    const stop = this.$watch(
      () => useSettingsStore().textSize,
      value => root.style.setProperty('font-size', `${value}%`),
      { immediate: true }
    );
    this.$once('hook:beforeDestroy', () => {
      stop();
      if (previousSize) root.style.setProperty('font-size', previousSize, previousPriority);
      else root.style.removeProperty('font-size');
    });
  },

  mounted: async function () {
    const serverStore = useServerStore();
    await serverStore.getInfo();
  },
};
</script>
