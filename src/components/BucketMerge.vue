<template lang="pug">
div
  h3 {{ $t('bucketTools.mergeTitle') }}
  p.small
    | {{ $t('bucketTools.mergeDescription') }}

  // TODO: select which buckets to merge
  b-row
    b-col
      h4 {{ $t('bucketTools.bucketFrom') }}
      b-form-select(v-model="bucket_from" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | {{ $t('bucketTools.mergeFromHelp') }}
        |
        | {{ $t('bucketTools.mergeFromDeleted') }}
      p.small(v-if="events_from !== null")
        | {{ $t('bucketTools.events', { count: events_from.length }) }}
    b-col
      h4 {{ $t('bucketTools.bucketTo') }}
      b-form-select(v-model="bucket_to" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | {{ $t('bucketTools.mergeToHelp') }}
        |
        | {{ $t('bucketTools.mergeToRemain') }}
      p.small(v-if="events_to !== null")
        | {{ $t('bucketTools.events', { count: events_to.length }) }}

  // TODO: check for overlapping events
  div(v-if="overlappingEvents !== null && overlappingEvents.length > 0")
    h3 {{ $t('bucketTools.overlappingEvents') }}
    p
      | {{ $t('bucketTools.overlappingCount', { count: overlappingEvents.length }) }}
      ul
        li(v-for="event in overlappingEvents")
          | {{ event[0].start }} - {{ event[0].end }} ({{ event[0].event.id }})
          |
          | {{ $t('bucketTools.overlapsWith') }}
          |
          | {{ event[1].start }} - {{ event[1].end }} ({{ event[1].event.id }})

  // TODO: confirm dialog
  b-button(variant="success" :disabled="!validate" @click="merge()") {{ $t('bucketTools.merge') }}

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
    };
  },
  computed: {
    validate() {
      const set = this.bucket_from !== null && this.bucket_to !== null;
      const not_same = this.bucket_from !== this.bucket_to;
      const not_overlapping =
        this.overlappingEvents !== null && this.overlappingEvents.length === 0;
      return set && not_same && not_overlapping;
    },
    overlappingEvents() {
      if (this.events_from === null || this.events_to === null) {
        return null;
      }
      return overlappingEvents(this.events_from, this.events_to);
    },
  },
  watch: {
    bucket_from: async function (new_bucket_id) {
      this.events_from = await this.getEvents(new_bucket_id);
    },
    bucket_to: async function (new_bucket_id) {
      this.events_to = await this.getEvents(new_bucket_id);
    },
  },
  mounted() {
    this.getBuckets();
  },
  methods: {
    merge: async function () {
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
    getEvents: async function (bucket_id) {
      const client = getClient();
      return await client.getEvents(bucket_id);
    },
  },
};
</script>
