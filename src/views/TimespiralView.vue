<template lang="pug">
div
  div.d-flex.align-items-center.flex-wrap.mb-2
    h3.mb-0.mr-3 {{ $t('timespiral.title') }}
    b-form-select(
      v-if="hosts.length > 1"
      size="sm"
      :value="host"
      :options="hosts"
      :aria-label="$t('timespiral.device')"
      style="width: auto"
      @change="onHostChange"
    )

  div(v-if="!loaded")
  b-alert(v-else-if="!host" show variant="info")
    | {{ $t('timespiral.noData') }}
    | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-window]
  Timespiral(v-else :host="host")
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import Timespiral from '~/visualizations/Timespiral.vue';

export default {
  name: 'TimespiralView',
  components: {
    Timespiral,
  },
  data() {
    return { loaded: false };
  },
  computed: {
    hosts(): string[] {
      // Devices with window or app (Android/ScreenTime) data, which is what gets drawn.
      const buckets = useBucketsStore();
      return buckets.knownHosts.filter(
        (h: string) => buckets.bucketsWindow(h).length > 0 || buckets.bucketsAndroid(h).length > 0
      );
    },
    host(): string | undefined {
      const routeHost = this.$route.params.host;
      return routeHost && this.hosts.includes(routeHost) ? routeHost : this.hosts[0];
    },
  },
  async mounted() {
    await useBucketsStore().ensureLoaded();
    await useCategoryStore().load();
    this.loaded = true;
  },
  methods: {
    onHostChange(host: string) {
      this.$router.replace(`/timespiral/${host}`);
    },
  },
};
</script>
