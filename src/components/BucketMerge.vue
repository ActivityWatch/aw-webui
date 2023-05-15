<template lang="pug">
div
  h3 Merge buckets
  p.small
    | Sometimes, you might want to merge the events of two buckets together into one. 
    | This is commonly useful to address the case where your hostname might have changed, 
    | creating two buckets for the same watcher and host, which you want to combine together again.

  // TODO: select which buckets to merge
  b-row
    b-col
      h4 Bucket from
      b-form-select(v-model="bucket_from" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | Select the bucket from which you want to merge the events.
        | This bucket will be deleted after the merge.
      p.small(v-if="events_from !== null")
        | Events: {{ events_from.length }}
    b-col
      h4 Bucket to
      b-form-select(v-model="bucket_to" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | Select the bucket to which you want to merge the events.
        | This bucket will remain after the merge.
      p.small(v-if="events_to !== null")
        | Events: {{ events_to.length }}

  // TODO: check for overlapping events
  div(v-if="overlappingEvents !== null && overlappingEvents.length > 0")
    h3 Overlapping events
    p
      | The following {{ overlappingEvents.length }} events are overlapping:
      ul
        li(v-for="event in overlappingEvents")
          | {{ event[0].start }} - {{ event[0].end }} ({{ event[0].event.id }}) 
          | overlaps with 
          | {{ event[1].start }} - {{ event[1].end }} ({{ event[1].event.id }})

  // TODO: confirm dialog
  b-button(variant="success" :disabled="!validate" @click="merge()") Merge

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
