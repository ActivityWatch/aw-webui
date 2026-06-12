<template lang="pug">
div
  h3 {{ $t('bucketTools.validateTitle') }}
  p.small
    | {{ $t('bucketTools.validateDescription') }}

  // Form
  b-row
    b-col
      h4 {{ $t('bucketTools.bucket') }}
      b-form-select(v-model="bucket" :options="buckets" :disabled="buckets.length === 0")
      p.small
        | {{ $t('bucketTools.validateBucketHelp') }}
      p.small(v-if="events !== null")
        | {{ $t('bucketTools.events', { count: events.length }) }}

  // Checks
  // check for duplicate events
  div(v-if="duplicateEvents !== null")
    details
      summary
        icon.mx-2(name="check", style="color: #0C0", v-if="duplicateEvents.length === 0")
        icon.mx-2(name="exclamation-triangle", style="color: #CC0", v-else)
        | {{ $t('bucketTools.duplicates', { count: duplicateEvents.length }) }}
      div.p-2
        p(v-if="duplicateEvents.length === 0")
          | {{ $t('bucketTools.noDuplicates') }}
        p(v-else)
          | {{ $t('bucketTools.duplicatesFound', { count: duplicateEvents.length }) }}
          ul.mt-2
            li(v-for="overlap in duplicateEvents")
              | {{ overlap[0].start.toISOString() }} - (id: {{ overlap[0].event.id }} & {{ overlap[1].event.id }}): {{ JSON.stringify(overlap[0].data) }}

  // check for overlapping events
  div(v-if="overlappingEvents !== null")
    details
      summary
        icon.mx-2(name="check", style="color: #0C0", v-if="overlappingEvents.length === 0")
        icon.mx-2(name="exclamation-triangle", style="color: #CC0", v-else)
        | {{ $t('bucketTools.overlapsBefore', { count: overlappingEvents.length }) }} {{ overlapDuration / 1000 | friendlyduration }}
      div.p-2
        p(v-if="overlappingEvents.length === 0")
          | {{ $t('bucketTools.noOverlaps') }}
        p(v-else)
          | {{ $t('bucketTools.overlapsFound', { count: overlappingEvents.length }) }}
          br
          span(v-if="overlapDurationSameData > 0")
            | {{ $t('bucketTools.sameDataOverlapsBefore') }} {{ overlapDurationSameData / 1000 | friendlyduration }} {{ $t('bucketTools.sameDataOverlapsAfter') }}
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
        | {{ $t('bucketTools.zeroDuration', { count: zeroDurationEvents.length }) }}
      div.p-2
        p.ml-3(v-if="zeroDurationEvents.length === 0")
          | {{ $t('bucketTools.noZeroDuration') }}
        p.ml-3(v-else)
          | {{ $t('bucketTools.zeroDurationFound', { count: zeroDurationEvents.length }) }}
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
