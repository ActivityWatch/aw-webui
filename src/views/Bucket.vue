<template lang="pug">

div
  h3 {{ id }}
  table
    tr
      th {{ $t('type') }}
      td {{ bucket.type }}
    tr
      th {{ $t('client') }}
      td {{ bucket.client }}
    tr
      th {{ $t('hostname') }}
      td {{ bucket.hostname }}
    tr
      th {{ $t('created') }}
      td {{ bucket.created | iso8601 }}
    tr(v-if="bucket.metadata")
      th {{ $t('lastEvent') }}
      td
        | {{ bucket.metadata.start}} /
        | {{ bucket.metadata.end }}
    tr
      th {{ $t('count') }}
      td {{ eventcount }}

  input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

  vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

  aw-eventlist(:bucket_id="id", @save="updateEvent", :events="events" editable=true)
</template>

<script>
export default {
  name: 'Bucket',
  props: {
    id: String,
  },
  data: () => {
    return {
      bucket_with_events: { events: [] },
      events: [],
      eventcount: '?',
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    bucket() {
      return this.$store.getters['buckets/getBucket'](this.id) || {};
    },
  },
  watch: {
    daterange: async function () {
      await this.getEvents(this.id);
    },
  },
  mounted: async function () {
    await this.$store.dispatch('buckets/ensureBuckets');
    await this.getEventCount(this.id);
  },
  methods: {
    getEvents: async function (bucket_id) {
      this.bucket_with_events = await this.$store.dispatch('buckets/getBucketWithEvents', {
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
      this.events = this.bucket_with_events.events;
    },
    getEventCount: async function (bucket_id) {
      this.eventcount = (await this.$aw.countEvents(bucket_id)).data;
    },
    updateEvent: function (event) {
      const i = this.events.findIndex(e => e.id == event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue.
        this.$set(this.events, i, event);
      } else {
        console.error(':(');
      }
    },
  },
};
</script>
