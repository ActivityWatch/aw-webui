<template lang="pug">
div
  h3 {{ id }}
  b-alert(v-if="notFound", show, variant="warning")
    | {{ $t('extraViews.bucket.notFound', { id }) }}
    |
    router-link(to="/buckets") {{ $t('extraViews.bucket.seeAll') }}
  div(v-else-if="bucket")
    table
      tr
        th {{ $t('ui.bucketDetail.type') }}
        td {{ bucket.type }}
      tr
        th {{ $t('ui.bucketDetail.client') }}
        td {{ bucket.client }}
      tr
        th {{ $t('ui.bucketDetail.hostname') }}
        td {{ bucket.hostname }}
      tr
        th {{ $t('ui.bucketDetail.created') }}
        td {{ bucket.created | iso8601 }}
      tr(v-if="bucket.metadata")
        th {{ $t('ui.bucketDetail.firstLastEvent') }}
        td
          | {{ bucket.metadata.start}} /
          | {{ bucket.metadata.end }}
      tr
        th {{ $t('ui.bucketDetail.eventCount') }}
        td {{ eventcount }}
      tr
        th {{ $t('ui.bucketDetail.data') }}
        td {{ bucket.data }}

    input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

    b-alert(v-if="showingMostRecent", variant="info", show)
      | {{ $t('extraViews.bucket.noEventsPrefix') }} {{ lastEventTime | friendlytime }}{{ $t('extraViews.bucket.noEventsSuffix', { count: events.length }) }}

    vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

    aw-eventlist(:bucket_id="id", @save="updateEvent", @deleted="removeEvent", :events="events" editable=true)
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
      // Incremented per request, so only the latest response is applied.
      eventsRequestId: 0,
      countRequestId: 0,
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
    // The router reuses this component when navigating between buckets, so
    // reload everything for the new bucket instead of showing the old one's events.
    id: async function (bucket_id) {
      this.events = [];
      this.eventcount = '?';
      this.showingMostRecent = false;
      if (!this.bucket) {
        await this.bucketsStore.loadBuckets();
        if (bucket_id !== this.id || !this.bucket) return;
      }
      // Without a daterange yet, the time interval input emits one and the
      // daterange watcher loads the events.
      await Promise.all([
        this.daterange ? this.getEvents(bucket_id) : null,
        this.getEventCount(bucket_id),
      ]);
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
      // A newer request (other bucket or time range) supersedes this one; drop late responses.
      const requestId = ++this.eventsRequestId;
      const daterange = this.daterange;
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucket_id,
        start: daterange[0].format(),
        end: daterange[1].format(),
      });
      if (requestId !== this.eventsRequestId) return;
      let events = bucket.events;
      let showingMostRecent = false;
      let lastEventTime = null;

      // Stale or imported buckets have nothing in the selected range (#136):
      // fall back to the latest events so the view stays useful for debugging.
      // Publish only the complete refresh, retaining local rows if fallback fails.
      const hasData = this.bucket.metadata && this.bucket.metadata.end;
      if (events.length == 0 && hasData) {
        try {
          const recent = await this.bucketsStore.getBucketWithEvents({
            id: bucket_id,
            limit: 100,
          });
          if (requestId !== this.eventsRequestId) return;
          events = recent.events;
          if (events.length > 0) {
            // The API returns newest first.
            lastEventTime = events[0].timestamp;
            showingMostRecent = true;
          }
        } catch (e) {
          console.warn('[bucket] Failed to load most recent events:', e);
          return;
        }
      }
      this.events = events;
      this.showingMostRecent = showingMostRecent;
      this.lastEventTime = lastEventTime;
    },
    getEventCount: async function (bucket_id) {
      const requestId = ++this.countRequestId;
      const count = await getClient().countEvents(bucket_id);
      if (requestId !== this.countRequestId) return;
      // aw-client already unwraps the response body, except that 0.3.x returns the
      // raw response when the body is falsy (a count of 0).
      this.eventcount = typeof count === 'number' ? count : count.data;
    },
    removeEvent: async function (event, bucketId) {
      if (bucketId !== this.id) return;
      const remaining = this.events.filter(e => e.id !== event.id);
      if (remaining.length !== this.events.length) {
        this.events = remaining;
        if (typeof this.eventcount === 'number') {
          this.eventcount = Math.max(0, this.eventcount - 1);
        }
      }
      // Supersede any pre-delete responses. Reload the current range (including
      // its recent-events fallback) and the authoritative total, rather than
      // letting an older snapshot restore the row or count. Keep the local
      // removal if refreshing fails; the server has already confirmed it.
      await Promise.all([
        this.daterange ? this.getEvents(bucketId) : null,
        this.getEventCount(bucketId),
      ]).catch(e => console.warn('[bucket] Failed to refresh after deletion:', e));
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
