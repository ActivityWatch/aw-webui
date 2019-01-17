<template lang="pug">
div
  h2 Timer

  testComponent

  p
    | Using bucket: {{bucket_id}}

  input(v-model="label")
  button(@click="startTimer()")
    | Start timer

  h3 Running timers
  div
    ul
      li(v-for="e in runningTimers")
        timer-entry(:event="e", :now="now", @stop="stopTimer(e)", @delete="deleteTimer(e)")
        //div Timestamp: {{e.timestamp | friendlytime}}
        //div Duration: {{(now - e.timestamp) / 1000 | friendlyduration}}
        //div Label: {{e.data.label}}
        //b-button(v-if="e.data.state == 'running'", @click="stopTimer(e)", size="sm")
        //  | Stop
        //b-button(@click="deleteTimer(e)", size="sm", variant="danger")
        //  | Delete


  h3 Stopped timers
  div
    ul
      li(v-for="e in stoppedTimers")
        timer-entry(:event="e", :now="now", @stop="stopTimer(e)", @delete="deleteTimer(e)")
        //div Timestamp: {{e.timestamp | friendlytime}}
        //div Duration: {{e.duration | friendlyduration}}
        //div Label: {{e.data.label}}
        //b-button(@click="deleteTimer(e)", size="sm", variant="danger")
        //  | Delete

</template>

<style scoped lang="scss">
.btn {
  margin-right: 0.5em;
}
</style>

<script>
import Vue from 'vue';
import 'vue-awesome/icons/trash';
import _ from 'lodash';
import moment from 'moment';

import TimerEntry from '../components/TimerEntry.vue';

let testComponent = Vue.component("testComponent", {
  name: "testComponent",
  template: `
    <div> Test</div>
  `
})

export default {
  name: "Timer",
  components: {
    "testComponent": testComponent,
    "timer-entry": TimerEntry
  },
  mounted: function() {
    // TODO: List all possible timer buckets
    //this.getBuckets();

    // TODO: Create timer bucket
    this.$aw.createBucket(this.bucket_id, "timer", "unknown").catch(console.log);

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
      return _.filter(this.events, (e) => (e.data.state === "running"))
    },
    stoppedTimers() {
      return _.filter(this.events, (e) => (e.data.state === "stopped"))
    }
  },
  methods: {
    startTimer: async function() {
      this.events.unshift(await this.$aw.heartbeat(this.bucket_id, 0, {timestamp: new Date(), data: {state: "running", label: this.label}}))
    },

    stopTimer: async function(event) {
      event.data.state = "stopped";
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
