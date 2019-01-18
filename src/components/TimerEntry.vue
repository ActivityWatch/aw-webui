<template lang="pug">
div
  div.row.p-3#root
    div.flex-fill
      div #[b {{event.data.label || 'No label'}}]
      div
        | Started #[span(:title="event.timestamp") {{event.timestamp | friendlytime}}] ({{event.data.running ? (now - event.timestamp) / 1000 : event.duration | friendlyduration}})
    div
      b-button.mx-1(v-if="event.data.running", @click="stop", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="stop")
        | Stop
      b-button.mx-1(v-if="!event.data.running", @click="resume", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="play")
        | Resume
      b-button.mx-1(v-b-modal="'edit-modal-' + event.id", variant="outline-dark", size="sm")
        icon.ml-0.mr-1(name="edit")
        | Edit
      b-button.mx-1(@click="delete_", variant="outline-danger", size="sm")
        icon.mx-0(name="trash")
        //| Delete
  b-modal(:id="'edit-modal-' + event.id", ref="editEventRef", title="Edit event", centered, hide-footer)
    event-editor(:event="event", :bucket_id="bucket_id", @save="$refs.editEventRef.hide()", @cancel="$refs.editEventRef.hide()")
</template>

<style scoped lang="scss">
#root:hover {
  background-color: #EEE;
}
</style>

<script>
import moment from 'moment';
import 'vue-awesome/icons/edit';
import 'vue-awesome/icons/stop';
import 'vue-awesome/icons/play';
import 'vue-awesome/icons/trash';

import EventEditor from './EventEditor.vue';

export default {
  name: "TimerEntry",
  components: {
    "event-editor": EventEditor,
  },
  props: {
    event: Object,
    bucket_id: String,
    now: {
      default: moment()
    }
  },
  methods: {
    stop: async function() {
      this.event.data.running = false;
      this.event.duration = (moment() - moment(this.event.timestamp)) / 1000;
      await this.$aw.replaceEvent(this.bucket_id, this.event);
    },

    resume: async function() {
      this.event.data.running = true;
      await this.$aw.replaceEvent(this.bucket_id, this.event);
    },

    delete_: async function() {
      await this.$aw.deleteEvent(this.bucket_id, this.event.id);
      this.$emit('delete');
    },
  }
}
</script>
