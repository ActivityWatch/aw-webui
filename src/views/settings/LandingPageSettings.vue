<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.landingPage.title') }}
    div
      b-select.landingpage(v-if="loaded" size="sm" :value="landingpage", @change="landingpage = $event")
        option(value="/home") {{ $t('settings.landingPage.home') }}
        option(:value="'/activity/' + hostParam(hostname) + '/view/'" v-for="hostname in hostnames") {{ $t('settings.landingPage.activity', { hostname }) }}
        option(v-if="hostnames.length > 1" value="/activity/@all/view/") {{ $t('activity.allDevices') }}
        option(value="/timeline") {{ $t('settings.landingPage.timeline') }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small.text-muted
    | {{ $t('settings.landingPage.help') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { formatHostParam } from '~/util/multidevice';

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
  methods: {
    // Same encoding as the Activity view's own links (see util/multidevice.ts)
    hostParam(hostname: string): string {
      return formatHostParam([hostname]);
    },
  },
};
</script>
