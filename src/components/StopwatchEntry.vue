<template lang="pug">
div
  div.row.px-3.py-2#root
    div.flex-fill
      span #[b {{event.data.label || 'No label'}}]
      span(style="color: #888") &nbsp;|&nbsp;
      span(v-if="event.data.running")
        | Running for #[span(:title="event.timestamp") {{event.data.running ? (now - event.timestamp) / 1000 : event.duration | friendlyduration}}]
        | &nbsp;(Started {{ event.timestamp | shorttime }})
      span(v-else)
        | Started #[span(:title="event.timestamp") {{event.timestamp | friendlytime}}]
        | &nbsp;({{event.data.running ? (now - event.timestamp) / 1000 : event.duration | friendlyduration}})
    div
      b-button.mx-1(v-if="event.data.running", @click="stop", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="stop")
        | Stop
      b-button.mx-1(v-if="!event.data.running", @click="$emit('new')", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="play")
        | Start new
      b-button.mx-1(v-b-modal="'edit-modal-' + event.id", variant="outline-dark", size="sm")
        icon.ml-0.mr-1(name="edit")
        | Edit
  event-editor(:event="event", :bucket_id="bucket_id", @save="save", @delete="delete_")
</template>

<style scoped lang="scss">
#root:hover {
  background-color: #eee;
}
</style>

<script>
import moment from 'moment';
import 'vue-awesome/icons/edit';
import 'vue-awesome/icons/stop';
import 'vue-awesome/icons/play';

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
  methods: {
    stop: async function () {
      let new_event = JSON.parse(JSON.stringify(this.event));
      new_event.data.running = false;
      new_event.duration = (moment() - moment(new_event.timestamp)) / 1000;
      new_event = await this.$aw.replaceEvent(this.bucket_id, new_event);
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
