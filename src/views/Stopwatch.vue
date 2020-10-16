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
    div.col-md-12
      div(v-if="runningTimers.length > 0")
        h3 Running
        div(v-for="e in runningTimers")
          stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
            @delete="removeTimer", @update="updateTimer")
          hr(style="margin: 0")
      div(v-else)
        span(style="color: #555") No stopwatch running
        hr

      div(v-if="stoppedTimers.length > 0")
        h3.mt-4.mb-4 History
        div(v-for="k in Object.keys(timersByDate).sort().reverse()")
          h5.mt-2.mb-1 {{ k }}
          div(v-for="e in timersByDate[k]")
            stopwatch-entry(:event="e", :bucket_id="bucket_id", :now="now",
              @delete="removeTimer", @update="updateTimer", @new="startTimer(e.data.label)")
            hr(style="margin: 0")
      div(v-else)
        span(style="color: #555") No history to show
        hr
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
  name: 'Stopwatch',
  components: {
    'stopwatch-entry': StopwatchEntry,
  },
  data: () => {
    return {
      bucket_id: 'aw-stopwatch',
      events: [],
      label: '',
      now: moment(),
    };
  },
  computed: {
    runningTimers() {
      return _.filter(this.events, e => e.data.running);
    },
    stoppedTimers() {
      return _.filter(this.events, e => !e.data.running);
    },
    timersByDate() {
      return _.groupBy(this.stoppedTimers, e => moment(e.timestamp).format('YYYY-MM-DD'));
    },
  },
  mounted: function () {
    // TODO: List all possible timer buckets
    //this.getBuckets();

    // Create default timer bucket
    this.$aw.ensureBucket(this.bucket_id, 'general.stopwatch', 'unknown');

    // TODO: Get all timer events
    this.getEvents();

    setInterval(() => (this.now = moment()), 1000);
  },
  methods: {
    startTimer: async function (label) {
      const event = await this.$aw.insertEvent(this.bucket_id, {
        timestamp: new Date(),
        data: {
          running: true,
          label: label,
        },
      });
      this.events.unshift(event);
    },

    updateTimer: async function (new_event) {
      const i = this.events.findIndex(e => e.id == new_event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue
        this.$set(this.events, i, new_event);
      } else {
        console.error(':(');
      }
    },

    removeTimer: function (event) {
      this.events = _.filter(this.events, e => e.id != event.id);
    },

    getEvents: async function () {
      this.events = await this.$aw.getEvents(this.bucket_id, { limit: 100 });
    },
  },
};
</script>
