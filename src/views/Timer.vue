<template lang="pug">
div
  h2 Timer
  p
    | Using bucket: {{bucket_id}}

  input(v-model="label", placeholder="Label")
  b-button(@click="startTimer()", variant="success")
    icon(name="play")
    | Start

  hr

  div.row
    div.col-md-6
      h3 Running timers
      div(v-for="e in runningTimers")
        timer-entry(:event="e", :now="now", @stop="stopTimer(e)", @delete="deleteTimer(e)")
        hr(style="margin: 0")

    div.col-md-6
      h3 Stopped timers
      div(v-for="e in stoppedTimers")
        timer-entry(:event="e", :now="now", @stop="stopTimer(e)", @delete="deleteTimer(e)")
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

import TimerEntry from '../components/TimerEntry.vue';
import 'vue-awesome/icons/play';
import 'vue-awesome/icons/trash';

export default {
  name: "Timer",
  components: {
    "timer-entry": TimerEntry
  },
  mounted: function() {
    // TODO: List all possible timer buckets
    //this.getBuckets();

    // Create default timer bucket
    this.$aw.ensureBucket(this.bucket_id, "timer", "unknown");

    // TODO: Get all timer events
    this.getEvents()

    setInterval(() => this.now = moment(), 1000);
  },
  data: () => {
    return {
      bucket_id: "timer-test",
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
    startTimer: async function() {
      this.events.unshift(await this.$aw.heartbeat(this.bucket_id, 0, {
        timestamp: new Date(),
        data: {
          running: true,
          label: this.label
        }
      }))
    },

    stopTimer: async function(event) {
      event.data.running = false;
      event.duration = (moment() - moment(event.timestamp)) / 1000;
      await this.$aw.replaceEvent(this.bucket_id, event);
    },

    deleteTimer: async function(event) {
      await this.$aw.deleteEvent(this.bucket_id, event.id);
      this.events = _.filter(this.events, (e) => e.id != event.id);
    },

    getEvents: async function() {
      this.events = await this.$aw.getEvents(this.bucket_id, {limit: 100});
    }
  }
}
</script>
