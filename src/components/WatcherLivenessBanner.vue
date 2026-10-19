<template lang="pug">
div
  b-alert.my-2(
    v-for="stale in staleWatchers"
    :key="stale.type"
    variant="warning"
    show
    dismissible
    @dismissed="dismiss(stale.type)"
  )
    | #[b Watcher stopped:]
    |  {{ stale.name }} last reported {{ stale.minutesAgo }} minute{{ stale.minutesAgo === 1 ? '' : 's' }} ago.
    |  Check the tray icon or
    |  #[a(href="https://docs.activitywatch.net/en/latest/troubleshooting.html" target="_blank" rel="noopener") restart the watcher].
</template>

<script lang="ts">
import Vue from 'vue';
import { mapStores } from 'pinia';
import { useBucketsStore } from '~/stores/buckets';

// Minutes after which a bucket is considered stale
const STALE_THRESHOLD_MINUTES = 5;

interface StaleWatcher {
  type: string;
  name: string;
  minutesAgo: number;
}

export default Vue.extend({
  name: 'aw-watcher-liveness-banner',
  props: {
    host: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      dismissed: [] as string[],
      now: Date.now(),
      refreshTimer: null as ReturnType<typeof setInterval> | null,
      refreshing: false,
      metadataFresh: false,
    };
  },
  computed: {
    ...mapStores(useBucketsStore),
    staleWatchers(): StaleWatcher[] {
      if (!this.metadataFresh) return [];
      const now = new Date(this.now);
      const staleMs = STALE_THRESHOLD_MINUTES * 60 * 1000;

      const pairs = [
        {
          type: 'window',
          name: 'aw-watcher-window',
          ids: this.bucketsStore.bucketsWindow(this.host),
        },
        { type: 'afk', name: 'aw-watcher-afk', ids: this.bucketsStore.bucketsAFK(this.host) },
      ];

      // Only show banner when at least one core bucket on this host is current.
      // This avoids false positives on idle machines that haven't had activity today.
      const allCoreIds = [...pairs[0].ids, ...pairs[1].ids];
      if (allCoreIds.length === 0) return [];

      const hasCurrentBucket = allCoreIds.some(id => {
        const bucket = this.bucketsStore.getBucket(id);
        if (!bucket?.last_updated) return false;
        const age = now.getTime() - new Date(bucket.last_updated).getTime();
        return age < staleMs;
      });

      if (!hasCurrentBucket) return [];

      const result: StaleWatcher[] = [];
      for (const pair of pairs) {
        if (this.dismissed.includes(`${this.host}:${pair.type}`)) continue;
        if (pair.ids.length === 0) continue;

        const mostRecentMs = Math.max(
          ...pair.ids.map(id => {
            const bucket = this.bucketsStore.getBucket(id);
            if (!bucket?.last_updated) return 0;
            return new Date(bucket.last_updated).getTime();
          })
        );

        if (mostRecentMs === 0) continue;

        const ageMs = now.getTime() - mostRecentMs;
        if (ageMs >= staleMs) {
          result.push({
            type: pair.type,
            name: pair.name,
            minutesAgo: Math.round(ageMs / 60000),
          });
        }
      }

      return result;
    },
  },
  watch: {
    // Activity.vue reuses this component across host changes (the template has
    // no :key), so `now`/`metadataFresh` would otherwise still reflect the
    // previous host. Reset and re-fetch before judging the new host's buckets.
    host() {
      this.metadataFresh = false;
      void this.refreshMetadata();
    },
  },
  mounted() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('aw-watcher-dismissals') || '[]');
      if (Array.isArray(saved)) this.dismissed = saved.filter(key => typeof key === 'string');
    } catch {
      // Storage may be unavailable; in-memory dismissal still works.
    }
    void this.refreshMetadata();
    this.refreshTimer = setInterval(() => void this.refreshMetadata(), 60000);
  },
  beforeDestroy() {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
  },
  methods: {
    async refreshMetadata() {
      if (this.refreshing) return;
      this.refreshing = true;
      try {
        await this.bucketsStore.loadBuckets();
        this.now = Date.now();
        this.metadataFresh = true;
      } catch {
        // A disconnected server is not evidence that one watcher stopped.
        this.metadataFresh = false;
      } finally {
        this.refreshing = false;
      }
    },
    dismiss(type: string) {
      this.dismissed.push(`${this.host}:${type}`);
      try {
        sessionStorage.setItem('aw-watcher-dismissals', JSON.stringify(this.dismissed));
      } catch {
        // Keep the in-memory dismissal when storage is unavailable.
      }
    },
  },
});
</script>
