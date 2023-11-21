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

  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Font
    div
      b-select.landingpage(v-if="_loaded" size="sm" v-model="headerFont" class="form-control form-control-sm" @change="onHeaderFontChange")
        option(value="Varela Round") Varela Round 
        option(value="sans-serif") Sans Serif
        option(value="custom") Custom Font Name
      span(v-else)
        .aw-loading Loading...

  div(v-if="headerFont === 'custom'")
    input(type="text" v-model="customHeaderFontName" class="form-control form-control-sm" placeholder="Enter font name")
  small
    | Change the header font, ie titles and buttons

  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Font
    div

      b-select.landingpage(v-if="_loaded" size="sm" v-model="selectedFont" class="form-control form-control-sm" @change="onFontChange")
        option(value="sans-serif") Sans Serif
        option(value="Varela Round") Varela Round 
        option(value="custom") Custom Font Name
      span(v-else)
        .aw-loading Loading...
  div(v-if="selectedFont === 'custom'")
    input(type="text" v-model="customFontName" class="form-control form-control-sm" placeholder="Enter font name")
  small
    | Change the default font, ie default text

</template>
  
<script>
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'Theme',

  data() {
    return {
      selectedFont: 'Arial', // default font
      customFontName: '', // User enters this
      headerFont: 'Arial', // default font for headers
      customHeaderFontName: '', // User enters this for header font
    };
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

        // Apply newly set theme
        this.applyTheme(value);
      },
    },
  },
  watch: {
    customFontName(newFontName) {
      if (this.selectedFont === 'custom') {
        this.applyFont(newFontName);
      }
    },
    customHeaderFontName(newFontName) {
      if (this.headerFont === 'custom') {
        this.applyHeaderFont(newFontName);
      }
    },


  },

  methods: {
    onFontChange() {
      console.log('Font changed to:', this.selectedFont);
      if (this.selectedFont === 'custom') {
        this.loadCustomFont();
      } else {
        // Standard font selection
        this.applyFont(this.selectedFont);
      }
    },
    onHeaderFontChange() {
      if (this.headerFont === 'custom') {
        this.applyHeaderFont(this.customHeaderFontName);
      } else {
        this.applyHeaderFont(this.headerFont);
      }
    },

    applyFont(fontName) {
      document.documentElement.style.setProperty('--app-font', fontName);
      document.documentElement.style.setProperty('--canvas-font', fontName);
    },
    applyHeaderFont(fontName) {
      document.documentElement.style.setProperty('--header-font', fontName);
    },

    loadCustomFont() {
      const linkId = 'custom-font-style';
      let fontLink = document.getElementById(linkId);

      if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = linkId;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }

      document.body.style.fontFamily = this.customFontName;
    },
    applyTheme(theme) {
      // Create Dark Theme Element
      const themeLink = document.createElement('link');
      themeLink.href = '/static/dark.css';
      themeLink.rel = 'stylesheet';

      // Append Dark Theme Element If Selected Mode Is Dark
      if (theme === 'dark') {
        document.querySelector('head').appendChild(themeLink);
      } else {
        const existingLink = document.querySelector('link[href="/static/dark.css"]');
        if (existingLink) {
          existingLink.remove();
        }
      }
    },
  }
};
</script>
  