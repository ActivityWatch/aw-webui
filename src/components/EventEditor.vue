<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", :title="$t('ui.eventEditor.editTitle')", centered, hide-footer, :no-close-on-backdrop="busy", :no-close-on-esc="busy", :hide-header-close="busy")
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
      tr(v-for="(v, k) in editableData" :key="k")
        td
          b-input(disabled, :value="k", size="sm")
        td
          b-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", :disabled="busy", style="margin: 0.25em")
          b-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", :disabled="busy", size="sm")
          b-input(v-if="typeof event.data[k] === 'number'", v-model.number="editedEvent.data[k]", :disabled="busy", size="sm", type="number")

    b-form-group.mt-2(v-if="editableTags" :label="$t('stopwatch.tagsLabel')" :label-for="'event-tags-' + event.id")
      b-input(:id="'event-tags-' + event.id" data-testid="event-tags" v-model="tagsText" :disabled="busy")

    hr

    b-alert(v-if="error" show variant="danger")
      | {{ error }}

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
import { parseTags } from '../util/tags';

import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/trash';

export default {
  name: 'EventEditor',
  props: {
    event: { type: Object },
    bucket_id: { type: String, required: true },
    editableTags: { type: Boolean, default: false },
  },
  data() {
    return {
      editedEvent: null,
      tagsText: '',
      // Name of the mutation in flight ('save' / 'delete'), else null.
      pending: null,
      error: '',
    };
  },
  computed: {
    editableData() {
      const data = this.editedEvent ? this.editedEvent.data : {};
      return this.editableTags ? _.omit(data, 'tags') : data;
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
      // Capture before any async suspension: another selection can change
      // this.editedEvent or this.bucket_id while replaceEvent is in-flight.
      const savedEvent = _.cloneDeep(this.editedEvent);
      if (this.editableTags) savedEvent.data.tags = parseTags(this.tagsText);
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
    // Hiding is best-effort: the modal may already be gone if a parent
    // re-rendered or destroyed this component.
    hideModal() {
      const modal = this.$refs.eventEditModal;
      if (modal) modal.hide();
    },
    async getEvent() {
      if (this.bucket_id && this.event && this.event.id) {
        this.editedEvent = await this.$aw.getEvent(this.bucket_id, this.event.id);
        this.tagsText = Array.isArray(this.editedEvent.data.tags)
          ? this.editedEvent.data.tags.join(', ')
          : '';
      } else {
        this.editedEvent = null;
        this.tagsText = '';
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
