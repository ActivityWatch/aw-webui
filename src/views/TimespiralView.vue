<template lang="pug">
div
  h3 {{ $t('timespiral.title') }}
  b-alert(show, variant="warning")
    | {{ $t('timespiral.wip') }}

  div(v-if="!bucketId")
    p.text-muted
      | {{ $t('timespiral.noAfkBucket') }}
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-afk]
      | {{ $t('timespiral.noAfkBucketSuffix') }}
  div(v-else)
    p.small.text-muted {{ $t('timespiral.bucketLabel') }} #[code {{ bucketId }}] &middot; {{ $t('timespiral.eventsLabel') }} {{ events.length }}
    Timespiral(:events="events")
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import Timespiral from '~/visualizations/Timespiral.vue';

export default {
  name: 'TimespiralView',
  components: {
    Timespiral,
  },
  data() {
    return {
      events: [],
      bucketId: '',
    };
  },
  async mounted() {
    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
    const buckets = bucketStore.bucketsAFK(bucketStore.hosts[0]);
    if (buckets.length == 0) {
      console.warn("Couldn't find suitable bucket");
      return;
    }
    this.bucketId = buckets[0];

    const start = new Date();
    start.setDate(start.getDate() - 7);
    const bucket = await bucketStore.getBucketWithEvents({
      id: this.bucketId,
      start,
    });
    this.events = bucket.events;
  },
  methods: {
    onEventClick(event) {
      this.$store.commit('setSelectedEvent', event);
      this.$router.push({ name: 'EventView' });
    },
  },
};
</script>
