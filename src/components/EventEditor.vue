<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", :title="$t('ui.eventEditor.editTitle')", centered, hide-footer, :no-close-on-backdrop="busy", :no-close-on-esc="busy", :hide-header-close="busy")
  b-alert(v-if="error" show variant="danger")
    | {{ error }}
    b-button.ml-2(v-if="!draftReady", @click="getEvent", :disabled="busy", size="sm")
      | {{ $t('activity.refresh') }}

  div(v-if="!draftReady && !error")
    | {{ $t('ui.eventEditor.loading') }}

  div(v-if="draftReady")
    table(style="width: 100%")
      tr
        th {{ $t('ui.eventEditor.bucket') }}
        td {{ bucket_id }}
      tr
        th ID
        td {{ event.id }}
      tr
        th {{ $t('ui.eventEditor.start') }}
        datetime(type="datetime" v-model="start" :disabled="busy")
      tr
        th {{ $t('ui.eventEditor.end') }}
        datetime(type="datetime" v-model="end" :disabled="busy")
      tr
        th {{ $t('ui.eventEditor.duration') }}
        td {{ editedEvent.duration | friendlyduration }}

    hr

    table(style="width: 100%")
      tr
        th {{ $t('ui.eventEditor.key') }}
        th {{ $t('ui.eventEditor.value') }}
      tr(v-for="(v, k) in editedEvent.data" :key="k")
        td
          b-input(disabled, :value="k", size="sm")
        td
          b-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", :disabled="busy", style="margin: 0.25em")
          b-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", :disabled="busy", size="sm")
          b-input(v-if="typeof event.data[k] === 'number'", v-model.number="editedEvent.data[k]", :disabled="busy", size="sm", type="number")

    hr


    div.float-left
      b-button.mx-1(@click="delete_", variant="danger", :disabled="busy")
        icon.mx-1(name="trash")
        | {{ $t('common.delete') }}
    div.float-right
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
      draftIdentity: null,
      draftSource: null,
      loadSequence: 0,
      disposed: false,
      // Name of the mutation in flight ('save' / 'delete'), else null.
      pending: null,
      error: '',
    };
  },
  computed: {
    selectionIdentity() {
      return this.bucket_id && this.event && this.event.id
        ? JSON.stringify([this.bucket_id, this.event.id])
        : null;
    },
    // Object replacement is a new editing session even for the same bucket/ID
    // (for example, reopening a timeline event after cancelling its draft).
    selectionSource() {
      return { identity: this.selectionIdentity, event: this.event };
    },
    draftReady() {
      return (
        this.editedEvent !== null &&
        this.draftIdentity === this.selectionIdentity &&
        this.draftSource === this.event
      );
    },
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
    selectionSource() {
      this.getEvent();
    },
  },
  mounted: async function () {
    await this.getEvent();
  },
  beforeDestroy() {
    this.disposed = true;
    this.loadSequence++;
  },
  methods: {
    async save() {
      if (!this.draftReady || this.disposed) return;
      // Capture before any async suspension: another selection can change
      // this.editedEvent or this.bucket_id while replaceEvent is in-flight.
      const savedEvent = _.cloneDeep(this.editedEvent);
      const bucketId = this.bucket_id;
      await this.runMutation('save', savedEvent, bucketId, () =>
        this.$aw.replaceEvent(bucketId, savedEvent)
      );
    },
    async delete_() {
      if (!this.draftReady || this.disposed) return;
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
      const identity = this.selectionIdentity;
      const source = this.selectionSource;
      const sequence = this.loadSequence;
      const stillSelected = () =>
        !this.disposed &&
        this.selectionIdentity === identity &&
        this.selectionSource === source &&
        this.loadSequence === sequence;
      this.pending = name;
      this.error = '';
      try {
        await request();
      } catch (e) {
        console.error(e);
        if (stillSelected()) this.error = this.requestErrorMessage(e, name);
        return;
      } finally {
        this.pending = null;
      }

      // The editor may have been pointed at a different event while the
      // request was in flight; a late response must not act on the new one.
      if (stillSelected()) {
        this.hideModal();
        this.$emit(name, payload);
      } else if (!this.disposed && this.selectionIdentity === identity) {
        // A reopened or reloaded draft may have read the event before this
        // write committed. Invalidate it synchronously and read after the write;
        // do not close the new editing session or let it submit stale data.
        this.getEvent();
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
    // Hiding is best-effort: the modal may already be gone if a parent
    // re-rendered or destroyed this component.
    hideModal() {
      const modal = this.$refs.eventEditModal;
      if (modal) modal.hide();
    },
    async getEvent() {
      const source = this.selectionSource;
      const identity = source.identity;
      const sequence = ++this.loadSequence;
      this.editedEvent = null;
      this.draftIdentity = null;
      this.draftSource = null;
      this.error = '';
      if (!identity || this.disposed) return;
      const bucketId = this.bucket_id;
      const eventId = this.event.id;
      const stillSelected = () =>
        !this.disposed && this.selectionSource === source && this.loadSequence === sequence;
      try {
        const event = await this.$aw.getEvent(bucketId, eventId);
        if (stillSelected()) {
          this.editedEvent = event;
          this.draftIdentity = identity;
          this.draftSource = source.event;
        }
      } catch (e) {
        if (stillSelected()) {
          const response = e && e.response;
          this.error =
            (response && response.data && response.data.message) ||
            (e && e.message) ||
            'Failed to load event.';
        }
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
