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
      td
        small Created:
      td
        small {{ bucket.created }}
    tr
      td
        small Eventcount:
      td
        small {{ eventcount }}

  hr

  b-alert(variant="warning" show)
    | This timeline is a work in progress. It only shows the last 100 events. Hover to get details.

  aw-timeline(:event_type="bucket.type", :events="events")

  GCTimeline(:buckets="[{name: bucket.id, events: events}]")

  hr

  aw-eventlist(:events="events")

</template>

<style scoped lang="scss">

</style>

<script>
import awclient from '../awclient.js';

import Timeline from '../visualizations/TimelineSimple.vue';
import GCTimeline from '../visualizations/GCTimeline.vue';
import EventList from '../visualizations/EventList.vue';

export default {
  name: "Bucket",
  components: {
    "aw-timeline": Timeline,
    "aw-eventlist": EventList,
    "GCTimeline": GCTimeline,
  },
  data: () => {
    return {
      id: String,
      bucket: Object,
      events: [],
      eventcount: "?",
    }
  },
  methods: {
    getBucketInfo: async function(bucket_id) {
      this.bucket = await awclient.getBucketInfo(bucket_id);
    },

    getEvents: async function(bucket_id) {
      this.events = await awclient.getEvents(bucket_id);
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
