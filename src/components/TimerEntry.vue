<template lang="pug">
div.d-flex#root
  div.flex-fill
    div #[b {{event.data.label || 'No label'}}]
    div Started {{event.timestamp | friendlytime}} ({{event.data.running ? (now - event.timestamp) / 1000 : event.duration | friendlyduration}})
  div
    b-button(v-if="event.data.running", @click="$emit('stop')", size="sm")
      icon(name="stop")
      | Stop
    b-button(@click="$emit('delete')", size="sm", variant="danger")
      icon(name="trash")
      | Delete
</template>

<style scoped lang="scss">
#root {
  padding: 0.5em;
}

#root:hover {
  background-color: #EEE;
}

.btn {
  margin-left: 0.5em;

  .fa-icon {
    margin-left: 0;
    margin-right: 0.5em;
  }
}
</style>

<script>
import moment from 'moment';
import 'vue-awesome/icons/stop';
import 'vue-awesome/icons/trash';

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
