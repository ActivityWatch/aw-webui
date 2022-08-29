<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Landing page
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/home") Home
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") Activity ({{hostname}})
        option(value="/timeline") Timeline
      span(v-else)
        .aw-loading Loading...
  small
    | The page to open when opening ActivityWatch, or clicking the logo in the top menu.
</template>

<script>
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'LandingPageSettings',
  data: () => {
    return {
      bucketsStore: useBucketsStore(),

      loaded: false,
    };
  },
  computed: {
    landingpage: {
      get: function () {
        const settingsStore = useSettingsStore();
        return settingsStore.landingpage || '/home';
      },
      set: function (val) {
        const settingsStore = useSettingsStore();
        settingsStore.update({ landingpage: val });
      },
    },
    hostnames() {
      return this.bucketsStore.hosts;
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.loaded = true;
  },
};
</script>
