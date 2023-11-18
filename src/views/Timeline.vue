<template lang="pug">
div
  h2 Timeline

  div.d-flex.justify-content-between.align-items-end
    table
      tr
        th.pr-2
          label Host filter:
        td
            select(v-model="filter_hostname")
              option(:value='null') *
              option(v-for="host in hosts", :value="host") {{ host }}
        th.pr-2
          label Client filter:
        td
          select(v-model="filter_client")
            option(:value='null') *
            option(v-for="client in clients", :value="client") {{ client }}

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration")

  div(v-if="buckets !== null")
    div
      div(style="float: left")
        | Events shown:  {{ num_events }}
      div(style="float: right; color: #999")
        | Drag to pan and scroll to zoom.
    div(style="clear: both")
    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange")

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-else)
    h1.aw-loading Loading...
</template>

<script>
import _ from 'lodash';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'Timeline',
  data() {
    return {
      all_buckets: null,
      hosts: null,
      buckets: null,
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
      filter_hostname: null,
      filter_client: null,
    };
  },
  computed: {
    timeintervalDefaultDuration() {
      const settingsStore = useSettingsStore();
      return Number(settingsStore.durationDefault);
    },
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
  },
  watch: {
    daterange() {
      this.getBuckets();
    },
    filter_hostname() {
      this.getBuckets();
    },
    filter_client() {
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
      this.buckets = this.all_buckets;
      this.buckets = _.filter(
        this.buckets,
        b => this.filter_hostname == null || b.hostname == this.filter_hostname
      );
      this.buckets = _.filter(
        this.buckets,
        b => this.filter_client == null || b.client == this.filter_client
      );
    },
  },
};
</script>
