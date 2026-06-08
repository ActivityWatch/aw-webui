<template lang="pug">
div
  h3 Timespiral
  b-alert(show, variant="warning")
    | This is a work-in-progress experiment.

  div(v-if="!bucketId")
    p.text-muted
      | No AFK bucket found on this host. Install
      | #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") aw-watcher-afk]
      | to use the Timespiral.
  div(v-else)
    p.small.text-muted Bucket: #[code {{ bucketId }}] &middot; Events: {{ events.length }}
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

    // Show the last week by default. Previously hard-coded to 2022-08-08
    // which left most users staring at an empty chart.
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const bucket = await bucketStore.getBucketWithEvents({
      id: this.bucketId,
      start,
    });
    this.events = bucket.events;
    console.log('Retrieved events:', this.events);
    console.log('First/last event:', this.events[0], this.events[this.events.length - 1]);
  },
  methods: {
    onEventClick(event) {
      this.$store.commit('setSelectedEvent', event);
      this.$router.push({ name: 'EventView' });
    },
  },
};
</script>
