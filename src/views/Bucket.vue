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
      td {{ bucket.created }}
    tr
      td Eventcount:
      td {{ eventcount }}
    tr
      td(colwidth=2)
        input-daterange(v-model="daterange")

  vis-timeline(:buckets="buckets", showRowLabels='false')

  aw-eventlist(:events="events")

</template>

<style scoped lang="scss">

</style>

<script>
import moment from 'moment'
import awclient from '../awclient.js';

export default {
  name: "Bucket",
  data: () => {
    return {
      id: String,
      bucket: Object,
      events: [],
      eventcount: "?",
      daterange: 60*15,
    }
  },
  computed: {
    buckets() {
      let bucket = this.bucket;
      bucket.events = this.events;
      return [bucket];
    }
  },
  watch: {
    daterange: function() {
      this.getEvents(this.id);
    }
  },
  methods: {
    getBucketInfo: async function(bucket_id) {
      this.bucket = await awclient.getBucketInfo(bucket_id);
    },

    getEvents: async function(bucket_id) {
      const now = moment();
      console.log(this.daterange * 10);
      this.events = await awclient.getEvents(bucket_id, {
        start: moment(now).subtract(this.daterange, "seconds").format(),
        end: now.format(),
        limit: -1
      });
    },

    getEventCount: async function(bucket_id) {
      this.eventcount = (await awclient.countEvents(bucket_id)).data;
    },
  },
  mounted: function() {
    this.id = this.$route.params.id;
    this.getBucketInfo(this.id);
    this.getEvents(this.id);
    this.getEventCount(this.id);
  },
}
</script>
