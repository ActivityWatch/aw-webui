<template lang="pug">
div
  h3 Validate buckets
  p.small
    | This is a small tool to check the validity of your buckets and their events.

  // Form
  b-row
    b-col
      h4 Bucket
      b-form-select(v-model="bucket" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | Select the bucket to validate.
      p.small(v-if="events !== null")
        | Events: {{ events.length }}

  // Checks
  // check for duplicate events
  div(v-if="duplicateEvents !== null")
    details
      summary
        icon.mx-2(name="check", style="color: #0C0", v-if="duplicateEvents.length === 0")
        icon.mx-2(name="exclamation-triangle", style="color: #CC0", v-else)
        | Duplicates: {{ duplicateEvents.length }}
      div.p-2
        p(v-if="duplicateEvents.length === 0")
          | No duplicate events found.
        p(v-else)
          | The following {{ duplicateEvents.length }} duplicates were found.
          ul.mt-2
            li(v-for="overlap in duplicateEvents")
              | {{ overlap[0].start.toISOString() }} - (id: {{ overlap[0].event.id }} & {{ overlap[1].event.id }}): {{ JSON.stringify(overlap[0].data) }}

  // check for overlapping events
  div(v-if="overlappingEvents !== null")
    details
      summary
        icon.mx-2(name="check", style="color: #0C0", v-if="overlappingEvents.length === 0")
        icon.mx-2(name="exclamation-triangle", style="color: #CC0", v-else)
        | Overlaps: {{ overlappingEvents.length }}x with a total duration of {{ overlapDuration / 1000 | friendlyduration }}
      div.p-2
        p(v-if="overlappingEvents.length === 0")
          | No overlapping events found.
        p(v-else)
          | The following {{ overlappingEvents.length }} overlaps were found.
          br
          span(v-if="overlapDurationSameData > 0")
            | Of these, {{ overlapDurationSameData / 1000 | friendlyduration }} are overlaps where the data is the same. These events could potentially be merged.
          p.mt-2(v-for="event in overlappingEvents")
            ul
              li {{ event[0].start.toISOString() }}/{{ event[0].end.toISOString() }} - (id: {{ event[0].event.id }}): {{ JSON.stringify(event[0].event.data) }}
              li {{ event[1].start.toISOString() }}/{{ event[1].end.toISOString() }} - (id: {{ event[1].event.id }}): {{ JSON.stringify(event[1].event.data) }}

  // count zero-duration events
  div(v-if="zeroDurationEvents !== null")
    details
      summary
        icon.mx-2(name="check", style="color: #0C0", v-if="zeroDurationEvents.length === 0")
        icon.mx-2(name="info-circle", style="color: #09F", v-else)
        | Zero-duration events: {{ zeroDurationEvents.length }}
      div.p-2
        p.ml-3(v-if="zeroDurationEvents.length === 0")
          | No zero-duration events found.
        p.ml-3(v-else)
          | The following {{ zeroDurationEvents.length }} zero-duration events were found:
          ul.mt-2
            li(v-for="event in zeroDurationEvents")
              | {{ event.timestamp.toISOString() }}/{{ new Date(new Date(event.timestamp).valueOf() + 1000 * event.duration).toISOString() }} - (id: {{ event.id }}): {{ JSON.stringify(event.data) }}


  // TODO: check for events that are too long
</template>

<script lang="ts">
import 'vue-awesome/icons/check';
import 'vue-awesome/icons/exclamation-triangle';
import 'vue-awesome/icons/info-circle';
import { getClient } from '~/util/awclient';
import { overlappingEvents } from '~/util/transforms';
import _ from 'lodash';

export default {
  name: 'aw-bucket-merge',
  data() {
    return {
      buckets: [],
      bucket: null,
      events: null,
    };
  },
  computed: {
    validate() {
      const set = this.bucket !== null;
      const not_overlapping =
        this.overlappingEvents !== null && this.overlappingEvents.length === 0;
      return set && not_overlapping;
    },
    duplicateEvents() {
      if (this.overlappingEvents === null) {
        return null;
      }
      return this.overlappingEvents.filter(overlap => {
        if (
          _.isEqual(overlap[0].start, overlap[1].start) &&
          _.isEqual(overlap[0].end, overlap[1].end) &&
          _.isEqual(overlap[0].event.data, overlap[1].event.data)
        ) {
          return true;
        }
      });
    },
    overlappingEvents() {
      if (this.events === null) {
        return null;
      }
      return overlappingEvents(this.events, this.events);
    },
    overlapDuration() {
      // The total amount of overlapping time
      if (this.overlappingEvents === null) {
        return null;
      }
      return this.overlappingEvents.reduce((acc, event) => {
        const start = event[0].start > event[1].start ? event[0].start : event[1].start;
        const end = event[0].end < event[1].end ? event[0].end : event[1].end;
        return acc + (end - start);
      }, 0);
    },
    overlapDurationSameData() {
      // like overlapDuration, but only count overlaps where the data is the same
      // These events could be merged safely (assuming they have no other overlaps)
      if (this.overlappingEvents === null) {
        return null;
      }
      return this.overlappingEvents.reduce((acc, event) => {
        if (!_.isEqual(event[0].event.data, event[1].event.data)) {
          return acc;
        }
        const start = event[0].start > event[1].start ? event[0].start : event[1].start;
        const end = event[0].end < event[1].end ? event[0].end : event[1].end;
        return acc + (end - start);
      }, 0);
    },
    zeroDurationEvents() {
      if (this.events === null) {
        return null;
      }
      return this.events.filter(event => event.duration === 0);
    },
  },
  watch: {
    bucket: async function (new_bucket_id) {
      this.events = null;
      this.events = await this.getEvents(new_bucket_id);
    },
  },
  mounted() {
    this.getBuckets();
  },
  methods: {
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
