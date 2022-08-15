<template lang="pug">
div
  h1 Timespiral
  b-alert(show, variant="info")
    | This is a work-in-progress experiment.
  div Bucket: {{ bucketId }}
  div Events: {{ events.length }}
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

    const bucket = await bucketStore.getBucketWithEvents({
      id: this.bucketId,
      start: new Date('2022-08-08'),
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
