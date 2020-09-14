<template lang="pug">
b-modal(:id="'edit-modal-' + event.id", ref="eventEditModal", title="Edit event", centered, hide-footer)
  table(style="width: 100%")
    tr
      th Bucket
      td {{ bucket_id }}
    tr
      th ID
      td {{ event.id }}
    tr
      th Start
      datetime(type="datetime" v-model="start")
    tr
      th End
      datetime(type="datetime" v-model="end")
    tr
      th Duration
      td {{ editedEvent.duration | friendlyduration }}

  hr

  table(style="width: 100%")
    tr
      th Key
      th Value
    tr(v-for="(v, k) in event.data")
      td
        b-input(disabled, :value="k", size="sm")
      td
        b-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", style="margin: 0.25em")
        b-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", size="sm")

  hr

  div.float-left
    b-button.mx-1(@click="delete_(); close();" variant="danger")
      icon.mx-1(name="trash")
      | Delete
  div.float-right
    b-button.mx-1(@click="close")
      icon.mx-1(name="times")
      | Cancel
    b-button.mx-1(@click="save(); close();", variant="primary")
      icon.mx-1(name="save")
      | Save
</template>

<style lang="scss"></style>

<script>
import moment from 'moment';

import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/trash';

export default {
  name: 'EventEditor',
  props: {
    event: Object,
    bucket_id: String,
  },
  data() {
    return {
      editedEvent: JSON.parse(JSON.stringify(this.event)),
    };
  },
  computed: {
    start: {
      get: function () {
        return moment(this.editedEvent.timestamp).format();
      },
      set: function (dt) {
        // Duration needs to be set first since otherwise the computed for end will use the new timestamp
        this.editedEvent.duration = moment(this.end).diff(dt, 'seconds');
        this.editedEvent.timestamp = new Date(dt);
      },
    },
    end: {
      get: function () {
        const end = moment(this.editedEvent.timestamp).add(this.editedEvent.duration, 'seconds');
        return end.format();
      },
      set: function (dt) {
        this.editedEvent.duration = moment(dt).diff(this.editedEvent.timestamp, 'seconds');
      },
    },
  },
  methods: {
    async save() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      this.$emit('save', this.editedEvent);
      await this.$aw.replaceEvent(this.bucket_id, this.editedEvent);
    },
    async delete_() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      this.$emit('delete', this.event);
      await this.$aw.deleteEvent(this.bucket_id, this.event.id);
    },
    close() {
      this.$refs.eventEditModal.hide();
      this.$emit('close', this.event);
    },
  },
};
</script>
