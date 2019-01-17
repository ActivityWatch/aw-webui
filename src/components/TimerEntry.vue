<template lang="pug">
div
    div Timestamp: {{event.timestamp | friendlytime}}
    div Duration: {{event.data.state === "running" ? (now - event.timestamp) / 1000 : event.duration | friendlyduration}}
    div Label: {{event.data.label}}
    b-button(v-if="event.data.state == 'running'", @click="$emit('stop')", size="sm")
      | Stop
    b-button(@click="$emit('delete')", size="sm", variant="danger")
      | Delete
</template>

<style>
.btn {
  margin-right: 0.5em;
}
</style>

<script>
import moment from 'moment';

export default {
  name: "TimerEntry",
  props: {
    event: Object,
    now: {
      default: moment()
    }
  },
  data: () => {
    return {}
  },
}
</script>
