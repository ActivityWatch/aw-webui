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

  aw-timeline(type="simple" :event_type="bucket.type", :events="events")

  hr

  aw-eventlist(:events="events")

</template>

<style scoped lang="scss">

</style>

<script>
import awclient from '../awclient.js';

import Timeline from '../visualizations/Timeline.vue';
import EventList from '../visualizations/EventList.vue';

export default {
  name: "Bucket",
  components: {
    "aw-timeline": Timeline,
    "aw-eventlist": EventList,
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
    getBucketInfo: function(bucket_id) {
      awclient.getBucketInfo(bucket_id).then((response) => {
        this.bucket = response.data;
      });
    },

    getEvents: function(bucket_id) {
      awclient.getEvents(bucket_id).then((response) => {
        this.events = response.data;
      });
    },

    getEventCount: function(bucket_id) {
      awclient.getEventCount(bucket_id).then((response) => {
        this.eventcount = response.data;
      });
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
