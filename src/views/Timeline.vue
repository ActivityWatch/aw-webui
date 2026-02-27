<template lang="pug">
div
  h2 Timeline

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration").mb-3

  // blocks
  div.d-inline-block.border.rounded.p-2.mr-2
    | Events shown:  {{ num_events }}
  div.d-inline-block.border.rounded.p-2.mr-2
    | Swimlanes:
    select(v-model="swimlane")
      option(:value='null') None
      option(value='category') Categories
      option(value='bucketType') Bucket Specific
  details.d-inline-block.bg-light.small.border.rounded.mr-2.px-2
    summary.p-2
      b Filters: {{ filter_summary }}
    div.p-2.bg-light
      table
        tr
          th.pt-2.pr-3
            label Host:
          td
              select(v-model="filter_hostname")
                option(:value='null') All
                option(v-for="host in hosts", :value="host") {{ host }}
        tr
          th.pt-2.pr-3
            label Client:
          td
            select(v-model="filter_client")
              option(:value='null') All
              option(v-for="client in clients", :value="client") {{ client }}
        tr
          th.pt-2.pr-3
            label AFK:
          td
            b-form-checkbox(v-model="filter_afk" size="sm" switch)
              | Filter AFK
  div.d-inline-block.border.rounded.p-2.mr-2(v-if="num_events !== 0")
    | Events shown: {{ num_events }}
  b-alert.d-inline-block.p-2.mb-0.mt-2(v-if="num_events === 0", variant="warning", show)
    | No events match selected criteria. Timeline is not updated.
  div.float-right.small.text-muted.pt-3
        tr
          th.pt-2.pr-3
            label Duration:
          td
            select(v-model="filter_duration")
              option(:value='null') All
              option(:value='2') 2+ secs
              option(:value='5') 5+ secs
              option(:value='10') 10+ secs
              option(:value='30') 30+ sec
              option(:value='1 * 60') 1+ mins
              option(:value='2 * 60') 2+ mins
              option(:value='3 * 60') 3+ mins
              option(:value='10 * 60') 10+ mins
              option(:value='30 * 60') 30+ mins
              option(:value='1 * 60 * 60') 1+ hrs
              option(:value='2 * 60 * 60') 2+ hrs
  div(style="float: right; color: #999").d-inline-block.pt-3
    | Drag to pan and scroll to zoom

  div(v-if="buckets !== null")
    div(style="clear: both")
    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange", :swimlane="swimlane", :updateTimelineWindow='updateTimelineWindow')

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-else)
    h1.aw-loading Loading...
</template>

<script lang="ts">
import _ from 'lodash';
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
import { canonicalEvents } from '~/queries';
import { seconds_to_duration } from '~/util/time';

export default {
  name: 'Timeline',
  data() {
    return {
      all_buckets: null,
      hosts: null,
      buckets: null,
      clients: null,
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
      filter_hostname: null,
      filter_client: null,
      filter_duration: null,
      filter_afk: false,
      swimlane: null,
      updateTimelineWindow: true,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['always_active_pattern']),
    timeintervalDefaultDuration() {
      const settingsStore = useSettingsStore();
      return Number(settingsStore.durationDefault);
    },
    // This does not match the chartData which is rendered in the timeline, as chartData excludes short events.
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
    filter_summary() {
      const desc = [];
      if (this.filter_hostname) {
        desc.push(this.filter_hostname);
      }
      if (this.filter_client) {
        desc.push(this.filter_client);
      }
      if (this.filter_duration > 0) {
        desc.push(seconds_to_duration(this.filter_duration));
      }
      if (this.filter_afk) {
        desc.push('AFK filtered');
      }

      if (desc.length > 0) {
        return desc.join(', ');
      }
      return 'none';
    },
  },
  watch: {
    daterange() {
      this.updateTimelineWindow = true;
      this.getBuckets();
    },
    filter_hostname() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_client() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_duration() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    filter_afk() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
    swimlane() {
      this.updateTimelineWindow = false;
      this.getBuckets();
    },
  },
  methods: {
    getBuckets: async function () {
      if (this.daterange == null) return;

      this.all_buckets = Object.freeze(
        await useBucketsStore().getBucketsWithEvents({
          start: this.daterange[0].format(),
          end: this.daterange[1].format(),
        })
      );

      this.hosts = this.all_buckets
        .map(a => a.hostname)
        .filter((value, index, array) => array.indexOf(value) === index);
      this.clients = this.all_buckets
        .map(a => a.client)
        .filter((value, index, array) => array.indexOf(value) === index);

      let buckets = this.all_buckets;
      if (this.filter_hostname) {
        buckets = _.filter(buckets, b => b.hostname == this.filter_hostname);
      }
      if (this.filter_client) {
        buckets = _.filter(buckets, b => b.client == this.filter_client);
      }

      if (this.filter_duration > 0) {
        for (const bucket of buckets) {
          bucket.events = _.filter(bucket.events, e => e.duration >= this.filter_duration);
        }
      }

      // AFK filtering: use query engine to filter window events by AFK status
      if (this.filter_afk) {
        buckets = await this._applyAfkFilter(buckets);
      }

      this.buckets = buckets;
    },

    // Replaces raw window bucket events with AFK-filtered events via aw query engine.
    // Also hides AFK status buckets since they're used for filtering, not display.
    _applyAfkFilter: async function (buckets) {
      const bucketsStore = useBucketsStore();
      const result = [];

      for (const bucket of buckets) {
        // Hide AFK status buckets when AFK filtering is active
        if (bucket.type === 'afkstatus') {
          continue;
        }

        // For window buckets, replace events with AFK-filtered query results
        if (bucket.type === 'currentwindow' && bucket.hostname) {
          const afkBucketIds = bucketsStore.bucketsAFK(bucket.hostname);
          if (afkBucketIds.length > 0) {
            try {
              const filteredEvents = await this._queryAfkFilteredEvents(bucket.id, afkBucketIds[0]);
              // Create a copy with filtered events to avoid mutating frozen all_buckets
              result.push({ ...bucket, events: filteredEvents });
              continue;
            } catch (e) {
              console.warn('AFK filter query failed, falling back to raw events:', e);
            }
          }
        }

        // Keep other buckets unchanged
        result.push(bucket);
      }

      return result;
    },

    // Runs a canonicalEvents query to get window events filtered by AFK status,
    // respecting the user's always_active_pattern setting.
    _queryAfkFilteredEvents: async function (windowBucketId, afkBucketId) {
      const queryCode =
        canonicalEvents({
          bid_window: windowBucketId,
          bid_afk: afkBucketId,
          filter_afk: true,
          always_active_pattern: this.always_active_pattern || undefined,
          categories: [],
          filter_categories: null,
        }) + '\nRETURN = events;';

      const queryArray = queryCode
        .split(';')
        .map(s => s.trim())
        .filter(s => s)
        .map(s => s + ';');

      const start = this.daterange[0].format();
      const end = this.daterange[1].format();
      const timeperiods = [`${start}/${end}`];

      const data = await getClient().query(timeperiods, queryArray);
      return data[0] || [];
    },
  },
};
</script>

<style scoped>
details {
  position: relative;
}

details[open] summary ~ * {
  visibility: visible;
  position: absolute;
  border: 1px solid #ddd;
  border-radius: 5px;
  left: 0;
  top: 2.7em;
  background: white;
  z-index: 100;
}
</style>
