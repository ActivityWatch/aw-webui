<template lang="pug">
div
  h2 Timeline

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration")

  b-form-group
    label(for="type") Type
    b-select#type(v-model="type")
      option(value='all') All buckets
      option(:value='"host:" + host' v-for="host in $store.getters['buckets/hostnames']") {{host}}

  div(v-show="buckets !== null")
    div
      div(style="float: left")
        | Events shown:  {{ num_events }}
      div(style="float: right; color: #999")
        | Drag to pan and scroll to zoom.
    div(style="clear: both")
    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange")

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-show="!(buckets !== null && num_events)")
    h1 Loading...
</template>

<script>
import _ from 'lodash';
import { canonicalEvents } from '~/queries';

export default {
  name: 'Timeline',
  data() {
    return {
      type: 'all',
      buckets: null,
      daterange: null,
      timeintervalDefaultDuration: Number.parseInt(localStorage.durationDefault) || 60 * 60,
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
  },
  watch: {
    daterange() {
      this.getBuckets();
    },
    type() {
      this.getBuckets();
    },
  },
  methods: {
    getBuckets: async function () {
      const start = this.daterange[0].format();
      const end = this.daterange[1].format();

      if (this.type === 'all') {
        this.buckets = await this.$store.dispatch('buckets/getBucketsWithEvents', {
          start,
          end,
        });
      } else if (this.type.startsWith('host:')) {
        const host = this.type.replace('host:', '');
        this.getCanonicalEvents(host, start, end);
      } else {
        console.error('unsupported');
      }
    },
    getCanonicalEvents: async function (hostname, start, end) {
      // TODO: Refactor to share code with Search view
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + hostname,
        bid_afk: 'aw-watcher-afk_' + hostname,
        filter_afk: this.filter_afk,
        // TODO: Use classes
        classes: [],
        //filter_classes: [],
      });
      query += '; RETURN = events;';

      const query_array = query.split(';').map(s => s.trim() + ';');
      const timeperiods = [start + '/' + end];
      try {
        const data = await this.$aw.query(timeperiods, query_array);
        this.buckets = [
          {
            hostname: hostname,
            type: 'currentwindow',
            events: _.orderBy(data[0], ['timestamp'], ['asc']),
          },
        ];
        this.error = '';
      } catch (e) {
        console.error(e);
        this.error = e.response.data.message;
      }
    },
  },
};
</script>
