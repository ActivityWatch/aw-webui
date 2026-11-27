<template lang="pug">
div
  div.d-flex.align-items-center.mb-3
    h3.mb-0 {{ $t('annotations.title') }}
  p.text-muted {{ $t('annotations.about') }}

  b-form(@submit.prevent="save")
    b-form-row
      b-col(md="3" sm="6")
        b-form-group(:label="$t('annotations.start')" label-for="annotation-start")
          b-form-input#annotation-start(type="datetime-local" step="1" v-model="startInput" :disabled="saving || loading || !bucket_id" required)
          b-form-select.mt-1(v-if="startCandidates.length > 1" v-model="startPick" :options="timeOptions(startCandidates)" :disabled="saving" :aria-label="$t('activity.intervalAmbiguousTime')")
      b-col(md="3" sm="6")
        b-form-group(:label="$t('annotations.end')" label-for="annotation-end")
          b-form-input#annotation-end(type="datetime-local" step="1" v-model="endInput" :disabled="saving || loading || !bucket_id" required)
          b-form-select.mt-1(v-if="endCandidates.length > 1" v-model="endPick" :options="timeOptions(endCandidates)" :disabled="saving" :aria-label="$t('activity.intervalAmbiguousTime')")
      b-col(md="6")
        b-form-group(:label="$t('annotations.tags')" label-for="annotation-tags")
          b-form-input#annotation-tags(v-model="tagsInput" :disabled="saving || loading || !bucket_id" :placeholder="$t('annotations.tagsPlaceholder')")
    b-form-group(:label="$t('annotations.note')" label-for="annotation-note")
      b-form-textarea#annotation-note(v-model="noteInput" :disabled="saving || loading || !bucket_id" rows="2" max-rows="6")
    b-alert(v-if="formError" show variant="warning") {{ formErrorMessage }}
    b-button.mr-2(type="submit" variant="primary" :disabled="saving || loading || !bucket_id") {{ editingId === null ? $t('annotations.add') : $t('common.save') }}
    b-button(v-if="editingId !== null" variant="outline-secondary" :disabled="saving" @click="resetForm") {{ $t('common.cancel') }}

  hr

  b-alert(v-if="error" show variant="danger")
    | {{ error }}
    b-button.ml-2(size="sm" @click="load") {{ $t('activity.refresh') }}

  div(v-if="loading")
    b-spinner.mr-2(small)
    span.text-muted {{ $t('common.loading') }}
  div(v-else-if="events.length === 0")
    p.text-muted {{ $t('annotations.empty') }}
  div(v-else)
    div(v-for="day in days" :key="day.date")
      h5.mt-3.mb-1 {{ day.date }}
      div.annotation-entry.d-flex.align-items-start.px-3.py-2(v-for="e in day.events" :key="e.id")
        div.flex-fill.mr-2
          div
            span.text-muted
              | {{ e.timestamp | shorttime }} &ndash;
              template(v-if="endDate(e)") {{ endDate(e) }}
              |  {{ endOf(e) | shorttime }}
            b-badge.ml-2(v-for="t in tagList(e)" :key="t" variant="secondary") {{ t }}
          div(v-if="e.data.note").annotation-note {{ e.data.note }}
        b-button.mx-1(size="sm" variant="outline-dark" :disabled="saving" @click="edit(e)") {{ $t('annotations.edit') }}
        b-button.mx-1(size="sm" variant="outline-danger" :disabled="saving" @click="remove(e)") {{ $t('common.delete') }}
    b-button.mt-3(v-if="hasMore" variant="outline-secondary" @click="showMore") {{ $t('annotations.showMore') }}
</template>

<style scoped lang="scss">
.annotation-entry {
  border-bottom: 1px solid #eee;
}
.annotation-entry:hover {
  background-color: #f8f9fa;
}
.annotation-note {
  white-space: pre-wrap;
}
</style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { wallTimeInstants } from '~/util/timeperiod';

import {
  ANNOTATION_BUCKET_TYPE,
  annotationBucketId,
  draftToEvent,
  formatNote,
  formatTags,
  parseTags,
  validateDraft,
} from '~/util/annotations';

const LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm:ss';
const PAGE_SIZE = 100;

export default {
  name: 'Annotations',
  data() {
    return {
      loading: true,
      saving: false,
      error: null,
      formError: null,
      bucket_id: null,
      limit: PAGE_SIZE,
      hasMore: false,
      events: [],
      editingId: null,
      originalRange: null,
      originalData: null,
      startPick: null,
      endPick: null,
      startInput: moment().subtract(1, 'hour').format(LOCAL_FORMAT),
      endInput: moment().format(LOCAL_FORMAT),
      tagsInput: '',
      noteInput: '',
    };
  },
  computed: {
    startCandidates() {
      return this.timeCandidates('start', this.startInput);
    },
    endCandidates() {
      return this.timeCandidates('end', this.endInput);
    },
    days() {
      const byDay = _.groupBy(this.events, e => moment(e.timestamp).format('YYYY-MM-DD'));
      return Object.keys(byDay)
        .sort()
        .reverse()
        .map(date => ({ date, events: byDay[date] }));
    },
    // Literal keys, so the locale check can see every message this view uses.
    formErrorMessage() {
      switch (this.formError) {
        case 'invalidRange':
          return this.$t('annotations.errors.invalidRange');
        case 'empty':
          return this.$t('annotations.errors.empty');
        case 'save':
          return this.$t('annotations.errors.save');
        case 'unresolvableTime':
          return this.$t('ui.timeInterval.unresolvableTime');
        default:
          return '';
      }
    },
  },
  watch: {
    startInput() {
      this.startPick = null;
    },
    endInput() {
      this.endPick = null;
    },
  },
  mounted: async function () {
    await this.load();
  },
  methods: {
    timeCandidates(field, wall) {
      // A note/tag edit must retain the saved instant, including milliseconds
      // and the second occurrence of a repeated local hour.
      const original = this.originalRange && this.originalRange[field];
      if (original && moment(original).format(LOCAL_FORMAT) === wall) {
        return [original.toISOString()];
      }
      return wallTimeInstants(wall);
    },
    timeOptions(candidates) {
      return [
        { value: null, text: this.$t('activity.intervalAmbiguousTime'), disabled: true },
        ...candidates.map(value => ({ value, text: moment(value).format('HH:mm:ss Z') })),
      ];
    },
    selectedTime(candidates, pick) {
      const value = candidates.length === 1 ? candidates[0] : candidates.find(c => c === pick);
      return value ? new Date(value) : null;
    },
    endDate(e) {
      const end = moment(this.endOf(e));
      return end.isSame(moment(e.timestamp), 'day') ? '' : end.format('YYYY-MM-DD');
    },
    endOf(e) {
      return new Date(new Date(e.timestamp).getTime() + e.duration * 1000);
    },
    tagList(e) {
      return parseTags(formatTags(e.data && e.data.tags));
    },
    resetForm() {
      this.editingId = null;
      this.originalRange = null;
      this.originalData = null;
      this.startPick = null;
      this.endPick = null;
      this.formError = null;
      this.tagsInput = '';
      this.noteInput = '';
      this.startInput = moment().subtract(1, 'hour').format(LOCAL_FORMAT);
      this.endInput = moment().format(LOCAL_FORMAT);
    },
    edit(e) {
      if (this.saving) return;
      this.originalRange = { start: new Date(e.timestamp), end: this.endOf(e) };
      this.originalData = { ...e.data };
      this.startPick = null;
      this.endPick = null;
      this.editingId = e.id;
      this.formError = null;
      this.startInput = moment(e.timestamp).format(LOCAL_FORMAT);
      this.endInput = moment(this.endOf(e)).format(LOCAL_FORMAT);
      this.tagsInput = formatTags(e.data.tags);
      this.noteInput = formatNote(e.data.note);
      window.scrollTo && window.scrollTo(0, 0);
    },
    load: async function () {
      this.loading = true;
      this.error = null;
      try {
        if (!this.bucket_id) {
          const info = await this.$aw.getInfo();
          const bucket = annotationBucketId(info.hostname);
          await this.$aw.ensureBucket(bucket, ANNOTATION_BUCKET_TYPE, info.hostname);
          this.bucket_id = bucket;
        }
        // Ask for one extra event to know whether more history exists.
        const events = await this.$aw.getEvents(this.bucket_id, { limit: this.limit + 1 });
        this.hasMore = events.length > this.limit;
        this.events = events
          .slice(0, this.limit)
          .map(e => ({ ...e, timestamp: new Date(e.timestamp) }));
      } catch (e) {
        this.error = this.$t('annotations.errors.load');
      } finally {
        this.loading = false;
      }
    },
    showMore: async function () {
      this.limit += PAGE_SIZE;
      await this.load();
    },
    save: async function () {
      if (this.saving || this.loading || !this.bucket_id) return;
      const start = this.selectedTime(this.startCandidates, this.startPick);
      const end = this.selectedTime(this.endCandidates, this.endPick);
      if (!start || !end) {
        this.formError = 'unresolvableTime';
        return;
      }
      const draft = {
        start,
        end,
        tags: this.tagsInput,
        note: this.noteInput,
      };
      const event = draftToEvent(draft);
      if (this.originalData) {
        // Only replace fields the user edited: the form cannot losslessly
        // represent every tag value or metadata written by another client.
        const data = { ...this.originalData };
        if (this.tagsInput !== formatTags(this.originalData.tags)) data.tags = event.data.tags;
        if (this.noteInput !== formatNote(this.originalData.note)) {
          if (event.data.note) data.note = event.data.note;
          else delete data.note;
        }
        event.data = data;
      }
      // Validate what will be written, not the form strings: an untouched
      // field the form cannot represent still counts as annotation content.
      this.formError = validateDraft(draft, event.data);
      if (this.formError) return;
      this.saving = true;
      try {
        if (this.editingId === null) {
          await this.$aw.insertEvent(this.bucket_id, event);
        } else {
          await this.$aw.replaceEvent(this.bucket_id, { ...event, id: this.editingId });
        }
        this.resetForm();
        await this.load();
      } catch (e) {
        this.formError = 'save';
      } finally {
        this.saving = false;
      }
    },
    remove: async function (e) {
      if (this.saving || this.loading || !this.bucket_id) return;
      this.saving = true;
      try {
        await this.$aw.deleteEvent(this.bucket_id, e.id);
        if (this.editingId === e.id) this.resetForm();
        await this.load();
      } catch (err) {
        this.error = this.$t('annotations.errors.delete');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
