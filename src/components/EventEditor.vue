<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", title="Edit event", centered, hide-footer)
  div(v-if="!editedEvent")
    | Loading event...

  div(v-else)
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
      tr(v-for="(v, k) in editedEvent.data" :key="k")
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
// This EventEditor can be used to edit events in a specific bucket.
//
// It is used in:
//  - Stopwatch
//  - Bucket viewer
//  - Timeline (on event-click)
//  - Search (soon)

import moment from 'moment';

import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/trash';

export default {
  name: 'EventEditor',
  props: {
    event: { type: Object },
    bucket_id: { type: String, required: true },
  },
  data() {
    return {
      editedEvent: null,
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
  watch: {
    async event() {
      await this.getEvent();
    },
  },
  mounted: async function () {
    await this.getEvent();
  },
  methods: {
    async save() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was replaced?
      this.$emit('save', this.editedEvent);
      await this.$aw.replaceEvent(this.bucket_id, this.editedEvent);
    },
    async delete_() {
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was deleted?
      this.$emit('delete', this.event);
      await this.$aw.deleteEvent(this.bucket_id, this.event.id);
    },
    async getEvent() {
      if (this.bucket_id && this.event && this.event.id) {
        this.editedEvent = await this.$aw.getEvent(this.bucket_id, this.event.id);
      } else {
        this.editedEvent = null;
      }
    },
    close() {
      this.$refs.eventEditModal.hide();
      this.$emit('close', this.event);
    },
  },
};
</script>
