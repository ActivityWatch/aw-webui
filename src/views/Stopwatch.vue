<template lang="pug">
div
  h2 Stopwatch
  p
    | Using bucket: {{bucket_id}}

  b-alert(show)
    | This is an early experiment, an important missing feature is the ability to set start/end times manually.

  b-input-group(size="lg")
    b-input(v-model="label" placeholder="What are you working on?")
    b-input-group-append
      b-button(@click="startTimer(label)", variant="success")
        icon(name="play")
        | Start

  hr

  div.row
    div.col-md-6
      h3 Running
      div(v-if="runningTimers.length > 0")
        div(v-for="e in runningTimers")
          stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now", @delete="deleteTimer(e)")
          hr(style="margin: 0")
      div(v-else)
        span(style="color: #555") No stopwatch running

    div.col-md-6
      h3 Stopped
      div(v-for="e in stoppedTimers")
        stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now", @delete="deleteTimer(e)", @new="startTimer(e.data.label)")
        hr(style="margin: 0")
</template>

<style scoped lang="scss">
.btn {
  margin-right: 0.5em;

  .fa-icon {
    margin-left: 0;
    margin-right: 0.5em;
  }
}
</style>

<script>
import _ from 'lodash';
import moment from 'moment';

import StopwatchEntry from '../components/StopwatchEntry.vue';
import 'vue-awesome/icons/play';
import 'vue-awesome/icons/trash';

export default {
  name: "Stopwatch",
  components: {
    "stopwatch-entry": StopwatchEntry
  },
  mounted: function() {
    // TODO: List all possible timer buckets
    //this.getBuckets();

    // Create default timer bucket
    this.$aw.ensureBucket(this.bucket_id, "general.stopwatch", "unknown");

    // TODO: Get all timer events
    this.getEvents()

    setInterval(() => this.now = moment(), 1000);
  },
  data: () => {
    return {
      bucket_id: "aw-stopwatch",
      events: [],
      label: "",
      now: moment(),
    }
  },
  computed: {
    runningTimers() {
      return _.filter(this.events, (e) => (e.data.running))
    },
    stoppedTimers() {
      return _.filter(this.events, (e) => (!e.data.running))
    }
  },
  methods: {
    startTimer: async function(label) {
      this.events.unshift(await this.$aw.heartbeat(this.bucket_id, 0, {
        timestamp: new Date(),
        data: {
          running: true,
          label: label
        }
      }))
    },

    deleteTimer: async function(event) {
      this.events = _.filter(this.events, (e) => e.id != event.id);
    },

    getEvents: async function() {
      this.events = await this.$aw.getEvents(this.bucket_id, {limit: 100});
    }
  }
}
</script>
