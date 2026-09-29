<template lang="pug">
div
  div.d-flex.flex-wrap.align-items-center.px-3.py-2.stopwatch-entry
    div.flex-fill.me-2
      span #[b {{event.data.label || 'No label'}}]
      span.text-muted &nbsp;|&nbsp;
      span(v-if="event.data.running")
        | Running for #[span(:title="event.timestamp") {{ friendlyduration(event.data.running ? (now - event.timestamp) / 1000 : event.duration) }}]
        | &nbsp;(Started {{ shorttime(event.timestamp) }})
      span(v-else)
        | Started #[span(:title="event.timestamp") {{ friendlytime(event.timestamp) }}]
        | &nbsp;({{ friendlyduration(event.data.running ? (now - event.timestamp) / 1000 : event.duration) }})
    div.stopwatch-entry__actions
      b-button.mx-1(v-if="event.data.running", @click="stop", variant="outline-primary", size="sm")
        icon.ms-0.me-1(name="stop")
        | Stop
      b-button.mx-1(v-if="!event.data.running", @click="$emit('new')", variant="outline-primary", size="sm")
        icon.ms-0.me-1(name="play")
        | Start new
      b-button.mx-1(@click="editorOpen = true", variant="outline-dark", size="sm")
        icon.ms-0.me-1(name="edit")
        | Edit
  event-editor(v-model:open="editorOpen", :event="event", :bucket_id="bucket_id", @save="save", @delete="delete_")
</template>

<style scoped lang="scss">
.stopwatch-entry {
  border-bottom: 1px solid #eee;
}

.stopwatch-entry:hover {
  background-color: #f8f9fa;
}

.stopwatch-entry__actions {
  display: flex;
  flex-wrap: nowrap;
}
</style>

<script lang="ts">
import moment from 'moment';

import EventEditor from './EventEditor.vue';

export default {
  name: 'StopwatchEntry',
  components: {
    'event-editor': EventEditor,
  },
  props: {
    event: Object,
    bucket_id: String,
    now: {
      type: moment,
      default: moment(),
    },
  },
  data() {
    return {
      editorOpen: false,
    };
  },
  methods: {
    stop: async function () {
      const new_event = JSON.parse(JSON.stringify(this.event));
      new_event.data.running = false;
      new_event.duration = moment().diff(moment(new_event.timestamp)) / 1000;
      await this.$aw.replaceEvent(this.bucket_id, new_event);
      this.$emit('update', new_event);
    },
    save: async function (new_event) {
      this.$emit('update', new_event);
    },
    delete_: async function (new_event) {
      this.$emit('delete', new_event);
    },
  },
};
</script>
