<template lang="pug">
div
  div.d-flex.align-items-center.mb-3
    h3.mb-0 {{ $t('annotations.title') }}
  p.text-muted {{ $t('annotations.about') }}

  b-form(@submit.prevent="save")
    b-form-row
      b-col(md="3" sm="6")
        b-form-group(:label="$t('annotations.start')" label-for="annotation-start")
          b-form-input#annotation-start(type="datetime-local" v-model="startInput" required)
      b-col(md="3" sm="6")
        b-form-group(:label="$t('annotations.end')" label-for="annotation-end")
          b-form-input#annotation-end(type="datetime-local" v-model="endInput" required)
      b-col(md="6")
        b-form-group(:label="$t('annotations.tags')" label-for="annotation-tags")
          b-form-input#annotation-tags(v-model="tagsInput" :placeholder="$t('annotations.tagsPlaceholder')")
    b-form-group(:label="$t('annotations.note')" label-for="annotation-note")
      b-form-textarea#annotation-note(v-model="noteInput" rows="2" max-rows="6")
    b-alert(v-if="formError" show variant="warning") {{ formErrorMessage }}
    b-button.mr-2(type="submit" variant="primary" :disabled="saving") {{ editingId === null ? $t('annotations.add') : $t('common.save') }}
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
            span.text-muted {{ e.timestamp | shorttime }} &ndash; {{ endOf(e) | shorttime }}
            b-badge.ml-2(v-for="t in tagList(e)" :key="t" variant="secondary") {{ t }}
          div(v-if="e.data.note").annotation-note {{ e.data.note }}
        b-button.mx-1(size="sm" variant="outline-dark" @click="edit(e)") {{ $t('annotations.edit') }}
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

import {
  ANNOTATION_BUCKET_TYPE,
  annotationBucketId,
  draftToEvent,
  formatTags,
  parseTags,
  validateDraft,
} from '~/util/annotations';

const LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm';
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
      startInput: moment().subtract(1, 'hour').format(LOCAL_FORMAT),
      endInput: moment().format(LOCAL_FORMAT),
      tagsInput: '',
      noteInput: '',
    };
  },
  computed: {
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
        default:
          return '';
      }
    },
  },
  mounted: async function () {
    try {
      const info = await this.$aw.getInfo();
      this.bucket_id = annotationBucketId(info.hostname);
      await this.$aw.ensureBucket(this.bucket_id, ANNOTATION_BUCKET_TYPE, info.hostname);
    } catch (e) {
      this.error = this.$t('annotations.errors.load');
      this.loading = false;
      return;
    }
    await this.load();
  },
  methods: {
    endOf(e) {
      return new Date(new Date(e.timestamp).getTime() + e.duration * 1000);
    },
    tagList(e) {
      return parseTags(formatTags(e.data && e.data.tags));
    },
    resetForm() {
      this.editingId = null;
      this.formError = null;
      this.tagsInput = '';
      this.noteInput = '';
      this.startInput = moment().subtract(1, 'hour').format(LOCAL_FORMAT);
      this.endInput = moment().format(LOCAL_FORMAT);
    },
    edit(e) {
      this.editingId = e.id;
      this.formError = null;
      this.startInput = moment(e.timestamp).format(LOCAL_FORMAT);
      this.endInput = moment(this.endOf(e)).format(LOCAL_FORMAT);
      this.tagsInput = formatTags(e.data.tags);
      this.noteInput = e.data.note || '';
      window.scrollTo && window.scrollTo(0, 0);
    },
    load: async function () {
      this.error = null;
      try {
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
      const draft = {
        start: moment(this.startInput, LOCAL_FORMAT, true).toDate(),
        end: moment(this.endInput, LOCAL_FORMAT, true).toDate(),
        tags: this.tagsInput,
        note: this.noteInput,
      };
      this.formError = validateDraft(draft);
      if (this.formError) return;
      const event = draftToEvent(draft);
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
