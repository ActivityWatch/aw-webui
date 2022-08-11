<template lang="pug">
div
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
    };
  },
  async mounted() {
    const bucketStore = useBucketsStore();
    const bucket = await bucketStore.getBucketWithEvents({
      id: 'aw-watcher-afk_erb-laptop2-arch',
      start: '1900-1-1',
      end: '2100-1-1',
      limit: 1000,
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
