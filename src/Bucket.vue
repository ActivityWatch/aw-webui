<template lang="jade">
h2 Bucket: {{ $route.params.id }}

div
  h3 Info
  | ID: {{ bucket.id }}
  br
  | Hostname: {{ bucket.hostname }}
  br
  | Client: {{ bucket.client }}

div
  h3 Events

  div.pagination-header
    | Showing {{ events.length }}/{{ events.length }} events

  ul.event-list
    li(v-for="event in events")
      span.event
        span.field(v-for="timestamp in event.timestamp")
          span.glyphicon.glyphicon-time
          {{ timestamp }}
        span.field(v-for="label in event.label")
          span.glyphicon.glyphicon-tags
          {{ label }}

</template>

<style lang="scss">

$border-color: #ddd;

.event-list {
  list-style-type: none;
  padding: 0;
  border: 1px solid $border-color;
  border-radius: 3px;

  li {
    border: 0 solid $border-color;
    border-width: 0 0 1px 0;
    border-radius: 4px;
    padding: 2px;

    &:last-child {
      border-width: 0;
    }
  }
}

.event {
  display: inline-block;
  padding: 6px;
  clear: both;
}

.pagination-header {
  font-size: 12pt;
  color: #666;
  margin-bottom: 10px;
}

.field {
  margin: 0 5px 0 0;
  font-size: 11pt;
  padding: 3px 5px 3px 5px;
  background-color: #ddd;
  border: 1px solid #ccc;
  border-radius: 2px;

  .glyphicon {
    font-size: 10pt;
    margin-right: 5px;
  }

  &:last-child {
    margin-right: 0;
  }
}
</style>

<script>
import Resources from './resources.js';

let $Bucket = Resources.$Bucket;
let $Event = Resources.$Event;

export default {
  name: "Bucket",
  data: () => {
    return {
      id: String,
      bucket: Object,
      events: []
    }
  },
  methods: {
    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": bucket_id}).then((response) => {
        console.log(response.json());
        this.$set("bucket", response.json())
      });
    },

    getEvents: function(bucket_id) {
      $Event.get({"id": bucket_id}).then((response) => {
        console.log(response.json());
        this.$set("events", response.json())
      });
    }
  },
  ready: function() {
    console.log(this.$route.params);
    this.id = this.$route.params.id;
    this.getBucketInfo(this.id);
    this.getEvents(this.id);
  }
}
</script>
