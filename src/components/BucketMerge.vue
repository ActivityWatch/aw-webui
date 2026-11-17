<template lang="pug">
div
  h3 {{ $t('ui.bucketMerge.title') }}
  p.small
    | {{ $t('ui.bucketMerge.intro') }}

  // TODO: select which buckets to merge
  b-row
    b-col
      h4 {{ $t('ui.bucketMerge.from') }}
      b-form-select(v-model="bucket_from" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | {{ $t('ui.bucketMerge.fromHelp') }}
      p.small(v-if="events_from !== null")
        | {{ $t('ui.bucketMerge.events') }}: {{ events_from.length }}
    b-col
      h4 {{ $t('ui.bucketMerge.to') }}
      b-form-select(v-model="bucket_to" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | {{ $t('ui.bucketMerge.toHelp') }}
      p.small(v-if="events_to !== null")
        | {{ $t('ui.bucketMerge.events') }}: {{ events_to.length }}

  // TODO: check for overlapping events
  div(v-if="overlappingEvents !== null && overlappingEvents.length > 0")
    h3 {{ $t('ui.bucketMerge.overlapping') }}
    p
      | {{ $t('ui.bucketMerge.overlapFound', { count: overlappingEvents.length }) }}
      ul
        li(v-for="event in overlappingEvents")
          | {{ event[0].start }} - {{ event[0].end }} ({{ event[0].event.id }})
          | {{ $t('ui.bucketMerge.overlapsWith') }}
          | {{ event[1].start }} - {{ event[1].end }} ({{ event[1].event.id }})

  // TODO: confirm dialog
  b-button(variant="success" :disabled="!validate" @click="merge()") {{ $t('ui.bucketMerge.merge') }}

  // TODO: delete old bucket? (ask user to backup their db if they want to be able to restore after delete)
</template>

<script lang="ts">
import { getClient } from '~/util/awclient';
import { overlappingEvents } from '~/util/transforms';

export default {
  name: 'aw-bucket-merge',
  data() {
    return {
      buckets: [],
      bucket_from: null,
      bucket_to: null,
      events_from: null,
      events_to: null,
      loaded_from: null,
      loaded_to: null,
      request_from: 0,
      request_to: 0,
    };
  },
  computed: {
    inputsLoaded() {
      return (
        this.bucket_from !== null &&
        this.bucket_to !== null &&
        this.loaded_from === this.bucket_from &&
        this.loaded_to === this.bucket_to &&
        Array.isArray(this.events_from) &&
        Array.isArray(this.events_to)
      );
    },
    validate() {
      const set = this.bucket_from !== null && this.bucket_to !== null;
      const not_same = this.bucket_from !== this.bucket_to;
      const not_overlapping =
        this.overlappingEvents !== null && this.overlappingEvents.length === 0;
      return set && this.inputsLoaded && not_same && not_overlapping;
    },
    overlappingEvents() {
      if (!this.inputsLoaded) {
        return null;
      }
      return overlappingEvents(this.events_from, this.events_to);
    },
  },
  watch: {
    bucket_from: async function (new_bucket_id) {
      const request = ++this.request_from;
      this.events_from = null;
      this.loaded_from = null;
      if (new_bucket_id === null) return;
      // Await the client directly: the global async-method mixin swallows errors.
      const events = await getClient().getEvents(new_bucket_id);
      if (request !== this.request_from || new_bucket_id !== this.bucket_from) return;
      this.events_from = events;
      this.loaded_from = new_bucket_id;
    },
    bucket_to: async function (new_bucket_id) {
      const request = ++this.request_to;
      this.events_to = null;
      this.loaded_to = null;
      if (new_bucket_id === null) return;
      const events = await getClient().getEvents(new_bucket_id);
      if (request !== this.request_to || new_bucket_id !== this.bucket_to) return;
      this.events_to = events;
      this.loaded_to = new_bucket_id;
    },
  },
  mounted() {
    this.getBuckets();
  },
  methods: {
    merge: async function () {
      if (!this.validate) return;
      const client = getClient();
      const events = this.events_from;
      const bucket_id = this.bucket_to;
      const result = await client.insertEvents(bucket_id, events);
      console.log('result', result);
    },
    getBuckets: async function () {
      const client = getClient();
      const buckets = await client.getBuckets();
      this.buckets = Object.keys(buckets).map(bucket_id => {
        return { value: bucket_id, text: bucket_id };
      });
    },
  },
};
</script>
