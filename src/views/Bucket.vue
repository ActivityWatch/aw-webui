<template lang="jade">
div
  h3 Events

  div.pagination-header
    | Showing {{ events.length }} out of ? events

  div.well.well-sm(style="margin-bottom: 0;")
    b-button(v-on:click="expandList")
      span(v-if="expandList")
        | Expand list
      span(v-else)
        | Condense list

  div.scrollbar-flipped
    ul.event-list(v-bind:class="{ 'expand': isListExpanded }")
      li(v-for="event in events")
        div
          span.event
            span.field(v-bind:title="event.timestamp")
              span.glyphicon.glyphicon-time
              | {{ event.timestamp | friendlytime }}
            span.field
              span.glyphicon.glyphicon-hourglass
              | {{ event.duration | friendlyduration }}
            span(v-for="(val, key) in event.data").field
              span.glyphicon.glyphicon-tags
              // TODO: Add some kind of highlighting to key
              | {{ key }}: {{ val }}

</template>

<style scoped lang="scss">

$border-color: #ddd;

.event-list {
  list-style-type: none;
  padding: 0;
  border: 1px solid $border-color;
  border-radius: 3px;
  height: 300px;
  overflow-y: auto;
  white-space: nowrap;

  li {
    border: 0 solid $border-color;
    border-width: 0 0 1px 0;
    border-radius: 4px;
    padding: 2px;

    &:last-child {
      border-width: 0;
    }
  }

  &.expand {
    height: 100%;
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

/* Flips the outer element once, then all direct children once,
   leaving the scrollbar in the first flipped yet the content correct */
.scrollbar-flipped, .scrollbar-flipped > * {
  transform: rotateX(180deg);
  -ms-transform: rotateX(180deg); /* IE 9 */
  -webkit-transform: rotateX(180deg); /* Safari and Chrome */
}
</style>

<script>
import Resources from '../resources.js';

let $Bucket = Resources.$Bucket;
let $Event = Resources.$Event;

export default {
  name: "Bucket",
  data: () => {
    return {
      id: String,
      bucket: Object,
      events: [],
      isListExpanded: false,
    }
  },
  methods: {
    getBucketInfo: function(bucket_id) {
      $Bucket.get({"id": bucket_id}).then((response) => {
        this.bucket = response.json();
      });
    },

    getEvents: function(bucket_id) {
      $Event.get({"id": bucket_id}).then((response) => {
        this.events = response.json();
      });
    },

    expandList: function() {
      this.isListExpanded = !this.isListExpanded;
      console.log("List should be expanding: ", this.isListExpanded);
    }
  },
  mounted: function() {
    this.id = this.$route.params.id;
    this.getBucketInfo(this.id);
    this.getEvents(this.id);
  },
}
</script>
