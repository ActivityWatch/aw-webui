<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settingsSections.landingPage') }}
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/home") {{ $t('settings.landingPageHome') }}
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") {{ $t('settings.landingPageActivity', { hostname }) }}
        option(value="/timeline") {{ $t('settings.landingPageTimeline') }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small.text-muted
    | {{ $t('settings.landingPageDescription') }}
</template>

<script lang="ts">
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
