<template lang="pug">
div#wrapper
  aw-header

  div(:class="{'container': !fullContainer, 'container-fluid': fullContainer}").px-0.px-md-2
    div.aw-container.my-3.p-3
      error-boundary
        user-satisfaction-poll
        new-release-notification(v-if="isNewReleaseCheckEnabled")
        router-view

  aw-footer
</template>

<script>
import { useSettingsStore } from '~/stores/settings';
import { useServerStore } from '~/stores/server';

export default {
  data: function () {
    return {
      activityViews: [],
      isNewReleaseCheckEnabled: !process.env.VUE_APP_ON_ANDROID,
    };
  },

  computed: {
    fullContainer() {
      return this.$route.meta.fullContainer;
    },
  },

  beforeCreate() {
    // Get Theme From LocalStorage
    const theme = localStorage.getItem('theme');
    // Check Application Mode (Light | Dark)
    if (theme !== null && theme === 'dark') {
      // Create Dark Theme Element
      const themeLink = document.createElement('link');
      themeLink.href = '/static/dark.css';
      themeLink.rel = 'stylesheet';
      // Append Dark Theme Element If Selected Mode Is Dark
      theme === 'dark' ? document.querySelector('head').appendChild(themeLink) : '';
    }
  },

  mounted: async function () {
    // Load settings
    // TODO: Move fetch of server-side settings to after getInfo

    const settingsStore = useSettingsStore();
    await settingsStore.ensureLoaded();

    const serverStore = useServerStore();
    await serverStore.getInfo();
  },
};
</script>
