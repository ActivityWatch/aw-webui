<template lang="pug">

div
  h3 {{ bucket.id }}
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

  vis-timeline(:buckets="buckets", showRowLabels='false')

  aw-eventlist(:events="events")

</template>

<style scoped lang="scss">

</style>

<script>
import moment from 'moment'

export default {
  name: "Bucket",
  data: () => {
    return {
      id: String,
      bucket: Object,
      events: [],
      eventcount: "?",
      daterange: [moment().subtract(1, "hour"), moment()],
    }
  },
  computed: {
    buckets() {
      const bucket = this.bucket;
      bucket.events = this.events;
      return [bucket];
    }
  },
  watch: {
    daterange: function() {
      this.getEvents(this.id);
    }
  },
  mounted: function() {
    this.id = this.$route.params.id;
    this.getBucketInfo(this.id);
    this.getEvents(this.id);
    this.getEventCount(this.id);
  },
  methods: {
    getBucketInfo: async function(bucket_id) {
      this.bucket = await this.$aw.getBucketInfo(bucket_id);
    },

    getEvents: async function(bucket_id) {
      console.log(this.daterange);
      this.events = await this.$aw.getEvents(bucket_id, {
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
        limit: -1
      });
    },

    getEventCount: async function(bucket_id) {
      this.eventcount = (await this.$aw.countEvents(bucket_id)).data;
    },
  },
}
</script>
