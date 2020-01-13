<template lang="pug">

div
  h3 {{ id }}
  table
    tr
      td Type:
      td {{ bucket.type }}
    tr
      td Client:
      td {{ bucket.client }}
    tr
      td Hostname:
      td {{ bucket.hostname }}
    tr
      td Created:
      td {{ bucket.created | iso8601 }}
    tr
      td Eventcount:
      td {{ eventcount }}

  input-timeinterval(v-model="daterange")

  vis-timeline(:buckets="[bucket_with_events]", showRowLabels='false')

  aw-eventlist(:bucket_id=id, :events="bucket_with_events.events")
</template>

<script>
import moment from 'moment'

export default {
  name: "Bucket",
  props: {
    id: String,
  },
  data: () => {
    return {
      bucket_with_events: { events: [] },
      eventcount: "?",
      daterange: [moment().subtract(1, "hour"), moment()],
    }
  },
  computed: {
    bucket() {
      return this.$store.getters['buckets/getBucket'](this.id) || {};
    },
  },
  watch: {
    daterange: function() {
      this.getEvents(this.id);
    }
  },
  mounted: async function() {
    await this.$store.dispatch('buckets/ensureBuckets');
    await this.getEvents(this.id);
    await this.getEventCount(this.id);
  },
  methods: {
    getEvents: async function(bucket_id) {
      this.bucket_with_events = await this.$store.dispatch('buckets/getBucketWithEvents', {
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
    },
    getEventCount: async function(bucket_id) {
      this.eventcount = (await this.$aw.countEvents(bucket_id)).data;
    },
  },
}
</script>
