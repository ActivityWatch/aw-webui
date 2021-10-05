<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Theme
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="theme", @change="set($event)")
        option(value="light") Light
        option(value="dark") Dark
      span(v-else)
        | Loading...
  small
    | Change color theme of the application (you need to change categories colors manually to be suitable with dark mode).
</template>
<script>
export default {
  name: 'Theme',
  data: () => {
    return {
      theme: localStorage.theme || 'light',
      loaded: false,
    };
  },
  async mounted() {
    this.theme = localStorage.theme || 'light';
    this.loaded = true;
  },
  methods: {
    set: function (theme) {
      localStorage.theme = theme;
      console.log('Set theme to ' + theme);
      // Create Dark Theme Element
      const themeLink = document.createElement('link');
      themeLink.href = '/static/dark.css';
      themeLink.rel = 'stylesheet';
      // Append Dark Theme Element If Selected Mode Is Dark
      theme === 'dark'
        ? document.querySelector('head').appendChild(themeLink)
        : document.querySelector('link[href="/static/dark.css"]').remove();
    },
  },
};
</script>
