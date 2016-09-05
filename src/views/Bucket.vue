<template lang="jade">
h2 Bucket: {{ $route.params.id }}

hr

div
  h3 Info
  | ID: {{ bucket.id }}
  br
  | Hostname: {{ bucket.hostname }}
  br
  | Client: {{ bucket.client }}
  br
  | Created: {{ bucket.created }}
  br
  | Event type: {{ bucket.type }}

div#timeline

div
  h3 Events

  div.pagination-header
    | Showing {{ events.length }}/{{ events.length }} events

  div.well.well-sm(style="margin-bottom: 0;")
    button.btn.btn-default.btn-sm(v-on:click="expandList")
      span(v-if="expandList")
        | Expand list
      span(v-else)
        | Condense list

  div.scrollbar-flipped
    ul.event-list(v-bind:class="{ 'expand': isListExpanded }")
      li(v-for="event in events | orderBy 'timestamp' -1")
        span.event
          span.field(v-for="timestamp in event.timestamp", title="{{ timestamp }}")
            span.glyphicon.glyphicon-time
            | {{ timestamp | friendlytime }}
          span.field(v-for="label in event.label" track-by="$index")
            span.glyphicon.glyphicon-tags
            | {{ label }}
          span.field(v-for="duration in event.duration")
            span.glyphicon.glyphicon-hourglass
            | {{ duration.value | friendlyduration }}
          span.field(v-for="count in event.count")
            span.glyphicon.glyphicon-option-horizontal
            | {{ count }}

</template>

<style lang="scss">

$border-color: #ddd;

#timeline {
  height: 500px;
  overflow-y: scroll;
}


.event-list {
  list-style-type: none;
  padding: 0;
  border: 1px solid $border-color;
  border-radius: 3px;
  height: 300px;
  overflow-y: auto;

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

// TIMELINE TESTING START

import renderTimeline from '../visualizations/timeline.js';

// TIMELINE TESTING END

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
        this.$set("bucket", response.json())
      });
    },

    getEvents: function(bucket_id) {
      $Event.get({"id": bucket_id}).then((response) => {
        this.$set("events", response.json())
      });
    },

    updateTimeline: function(e) {
      console.log("Updating timeline");
      renderTimeline(e, this.events);
    },

    expandList: function() {
      this.isListExpanded = !this.isListExpanded;
      console.log("List should be expanding: ", this.isListExpanded);
    }
  },
  ready: function() {
    this.id = this.$route.params.id;
    this.getBucketInfo(this.id);
    this.getEvents(this.id);
  },
  watch: {
    "events": function(events) {
      renderTimeline(document.getElementById("timeline"), this.events);
    }
  }
}
</script>
