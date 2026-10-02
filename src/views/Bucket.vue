<template lang="pug">
div
  h3 {{ id }}
  b-alert(v-if="notFound", show, variant="warning")
    | No bucket named "{{ id }}".
    |
    router-link(to="/buckets") See all buckets
  div(v-else-if="bucket")
    table
      tr
        th Type:
        td {{ bucket.type }}
      tr
        th Client:
        td {{ bucket.client }}
      tr
        th Hostname:
        td {{ bucket.hostname }}
      tr
        th Created:
        td {{ bucket.created | iso8601 }}
      tr(v-if="bucket.metadata")
        th First/last event:
        td
          | {{ bucket.metadata.start}} /
          | {{ bucket.metadata.end }}
      tr
        th Eventcount:
        td {{ eventcount }}
      tr
        th Data:
        td {{ bucket.data }}

    input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

    b-alert(v-if="showingMostRecent", variant="info", show)
      | No events in the selected range. The last event in this bucket is from {{ lastEventTime | friendlytime }}, showing the {{ events.length }} most recent events instead.

    vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

    aw-eventlist(:bucket_id="id", @save="updateEvent", :events="events" editable=true)
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';

export default {
  name: 'Bucket',
  props: {
    id: String,
  },
  data: () => {
    return {
      bucketsStore: useBucketsStore(),

      events: [],
      eventcount: '?',
      loaded: false,
      showingMostRecent: false,
      lastEventTime: null,
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    bucket() {
      return this.bucketsStore.getBucket(this.id);
    },
    notFound() {
      return this.loaded && !this.bucket;
    },
    bucket_with_events() {
      return {
        ...this.bucket,
        events: this.events,
      };
    },
  },
  watch: {
    daterange: async function () {
      await this.getEvents(this.id);
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
    if (!this.bucket) {
      // The cached list may predate this bucket, so refresh before calling it missing.
      await this.bucketsStore.loadBuckets();
    }
    this.loaded = true;
    if (this.bucket) {
      await this.getEventCount(this.id);
    }
  },
  methods: {
    getEvents: async function (bucket_id) {
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
      this.events = bucket.events;
      this.showingMostRecent = false;

      // Stale or imported buckets have nothing in the selected range (#136):
      // fall back to the latest events so the view stays useful for debugging.
      const lastEnd = this.bucket.metadata && this.bucket.metadata.end;
      if (this.events.length == 0 && lastEnd) {
        const recent = await this.bucketsStore.getBucketWithEvents({
          id: bucket_id,
          limit: 100,
        });
        if (recent.events.length > 0) {
          this.events = recent.events;
          this.lastEventTime = lastEnd;
          this.showingMostRecent = true;
        }
      }
    },
    getEventCount: async function (bucket_id) {
      const count = await getClient().countEvents(bucket_id);
      // aw-client already unwraps the response body, except that 0.3.x returns the
      // raw response when the body is falsy (a count of 0).
      this.eventcount = typeof count === 'number' ? count : count.data;
    },
    updateEvent: function (event) {
      const i = this.events.findIndex(e => e.id == event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue.
        this.$set(this.events, i, event);
      } else {
        console.error(':(');
      }
    },
  },
};
</script>
