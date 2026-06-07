<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.landingPage.title') }}
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/home") {{ $t('settings.landingPage.home') }}
        option(:value="'/activity/' + hostname + '/view/'" v-for="hostname in hostnames") {{ $t('settings.landingPage.activity', { hostname }) }}
        option(value="/timeline") {{ $t('settings.landingPage.timeline') }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small
    | {{ $t('settings.landingPage.help') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'LandingPageSettings',
  data: () => ({
    bucketsStore: useBucketsStore(),
    loaded: false,
  }),
  computed: {
    landingpage: {
      get: function () {
        return useSettingsStore().landingpage || '/home';
      },
      set: function (val) {
        useSettingsStore().update({ landingpage: val });
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
