<template lang="pug">
b-modal(v-if="event && event.id", :model-value="open", @update:model-value="onOpenChange", :title="$t('ui.eventEditor.editTitle')", centered, no-footer, :no-close-on-backdrop="busy", :no-close-on-esc="busy", :hide-header-close="busy")
  div(v-if="!editedEvent")
    | {{ $t('ui.eventEditor.loading') }}

  div(v-else)
    table(style="width: 100%")
      tr
        th {{ $t('ui.eventEditor.bucket') }}
        td {{ bucket_id }}
      tr
        th ID
        td {{ event.id }}
      tr
        th {{ $t('ui.eventEditor.start') }}
        td
          input(type="datetime-local" step="1" v-model="start" :disabled="busy")
      tr
        th {{ $t('ui.eventEditor.end') }}
        td
          input(type="datetime-local" step="1" v-model="end" :disabled="busy")
      tr
        th {{ $t('ui.eventEditor.duration') }}
        td {{ friendlyduration(editedEvent.duration) }}

    hr

    table(style="width: 100%")
      tr
        th {{ $t('ui.eventEditor.key') }}
        th {{ $t('ui.eventEditor.value') }}
      tr(v-for="(v, k) in editedEvent.data" :key="k")
        td
          b-form-input(disabled, :model-value="k", size="sm")
        td
          b-form-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", :disabled="busy", style="margin: 0.25em")
          b-form-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", :disabled="busy", size="sm")
          b-form-input(v-if="typeof event.data[k] === 'number'", v-model.number="editedEvent.data[k]", :disabled="busy", size="sm", type="number")

    hr

    b-alert(v-if="error" :model-value="true" variant="danger")
      | {{ error }}

    div.float-start
      b-button.mx-1(@click="delete_", variant="danger", :disabled="busy")
        icon.mx-1(name="trash")
        | {{ $t('common.delete') }}
    div.float-end
      b-button.mx-1(@click="close", :disabled="busy")
        icon.mx-1(name="times")
        | {{ $t('common.cancel') }}
      b-button.mx-1(@click="save", variant="primary", :disabled="busy")
        icon.mx-1(name="save")
        | {{ $t('common.save') }}
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
import _ from 'lodash';
import { friendlyduration } from '~/util/filters';

export default {
  name: 'EventEditor',
  props: {
    event: { type: Object },
    bucket_id: { type: String, required: true },
    // Whether the editor dialog is shown (v-model:open)
    open: { type: Boolean, default: false },
  },
  emits: ['save', 'delete', 'close', 'update:open'],
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
        return moment(this.editedEvent.timestamp).format('YYYY-MM-DDTHH:mm:ss');
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
        return end.format('YYYY-MM-DDTHH:mm:ss');
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
    friendlyduration,
    async save() {
      if (!this.editedEvent) return;
      // Capture before any async suspension: another selection can change
      // this.editedEvent or this.bucket_id while replaceEvent is in-flight.
      const savedEvent = _.cloneDeep(this.editedEvent);
      const bucketId = this.bucket_id;
      await this.runMutation('save', savedEvent, bucketId, () =>
        this.$aw.replaceEvent(bucketId, savedEvent)
      );
    },
    async delete_() {
      const event = this.event;
      const bucketId = this.bucket_id;
      await this.runMutation('delete', event, bucketId, () =>
        this.$aw.deleteEvent(bucketId, event.id)
      );
    },
    // Runs one mutation against the server. Parents are told it succeeded only
    // once the request actually has, so a failure leaves the editor open with
    // the user's input intact and retryable.
    //
    // The modal is hidden before the success event is emitted: a parent
    // reacting to it may destroy this component (it is usually rendered behind
    // a v-if on the event being edited), and the ref would be gone by then.
    async runMutation(name, payload, bucketId, request) {
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
      if (this.event && this.event.id === editingId) {
        this.hideModal();
        this.$emit(name, payload);
      }
      // The server did change, so this is reported even after the editor moved
      // on. It carries the bucket, for parents that patch their view in place.
      this.$emit(name === 'save' ? 'saved' : 'deleted', payload, bucketId);
    },
    requestErrorMessage(e, name) {
      const response = e && e.response;
      const serverMessage = response && response.data && response.data.message;
      const verb = name === 'delete' ? 'delete' : 'save';
      return serverMessage || (e && e.message) || `Failed to ${verb} event.`;
    },
    // The parent owns the open state (v-model:open).
    hideModal() {
      this.$emit('update:open', false);
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
    onOpenChange(isOpen: boolean) {
      if (isOpen) this.$emit('update:open', true);
      else this.close();
    },
  },
};
</script>
