<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", title="Edit event", centered, hide-footer, :no-close-on-backdrop="busy", :no-close-on-esc="busy", :hide-header-close="busy")
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
          b-input(v-if="typeof event.data[k] === 'number'", v-model.number="editedEvent.data[k]", size="sm", type="number")

    hr

    b-alert(v-if="error" show variant="danger")
      | {{ error }}

    div.float-left
      b-button.mx-1(@click="delete_", variant="danger", :disabled="busy")
        icon.mx-1(name="trash")
        | Delete
    div.float-right
      b-button.mx-1(@click="close", :disabled="busy")
        icon.mx-1(name="times")
        | Cancel
      b-button.mx-1(@click="save", variant="primary", :disabled="busy")
        icon.mx-1(name="save")
        | Save
</template>

<style lang="scss"></style>

<script lang="ts">
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
      // Name of the mutation in flight ('save' / 'delete'), else null.
      pending: null,
      error: '',
    };
  },
  computed: {
    busy() {
      return this.pending !== null;
    },
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
      this.error = '';
      await this.getEvent();
    },
  },
  mounted: async function () {
    await this.getEvent();
  },
  methods: {
    async save() {
      if (!this.editedEvent) return;
      await this.runMutation('save', this.editedEvent, () =>
        this.$aw.replaceEvent(this.bucket_id, this.editedEvent)
      );
    },
    async delete_() {
      await this.runMutation('delete', this.event, () =>
        this.$aw.deleteEvent(this.bucket_id, this.event.id)
      );
    },
    // Runs one mutation against the server. Parents are told it succeeded only
    // once the request actually has, so a failure leaves the editor open with
    // the user's input intact and retryable.
    //
    // The modal is hidden before the success event is emitted: a parent
    // reacting to it may destroy this component (it is usually rendered behind
    // a v-if on the event being edited), and the ref would be gone by then.
    async runMutation(name, payload, request) {
      if (this.pending) return;
      const editingId = this.event && this.event.id;
      this.pending = name;
      this.error = '';
      try {
        await request();
      } catch (e) {
        console.error(e);
        this.error = this.requestErrorMessage(e, name);
        return;
      } finally {
        this.pending = null;
      }

      // The editor may have been pointed at a different event while the
      // request was in flight; a late response must not act on the new one.
      if (!this.event || this.event.id !== editingId) return;

      this.hideModal();
      this.$emit(name, payload);
    },
    requestErrorMessage(e, name) {
      const response = e && e.response;
      const serverMessage = response && response.data && response.data.message;
      const verb = name === 'delete' ? 'delete' : 'save';
      return serverMessage || (e && e.message) || `Failed to ${verb} event.`;
    },
    // Hiding is best-effort: the modal may already be gone if a parent
    // re-rendered or destroyed this component.
    hideModal() {
      const modal = this.$refs.eventEditModal;
      if (modal) modal.hide();
    },
    async getEvent() {
      if (this.bucket_id && this.event && this.event.id) {
        this.editedEvent = await this.$aw.getEvent(this.bucket_id, this.event.id);
      } else {
        this.editedEvent = null;
      }
    },
    close() {
      if (this.pending) return;
      this.hideModal();
      this.$emit('close', this.event);
    },
  },
};
</script>
