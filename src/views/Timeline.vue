<template lang="pug">
div
  h2 {{ $t('timeline') }}

  input-timeinterval(v-model="daterange", :defaultDuration="timeintervalDefaultDuration", :maxDuration="maxDuration")

  div(v-show="buckets !== null")
    div
      div(style="float: left")
        | {{ $t('eventsShown') }} {{ num_events }}
      div(style="float: right; color: #999")
        | {{ $t('controls') }}
    div(style="clear: both")

    vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange")
    aw-heatmap(:buckets="buckets", :queriedInterval="daterange")

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-show="!(buckets !== null && num_events)")
    h1 {{ $t('loading') }}
</template>

<script>
import _ from 'lodash';
import moment from 'moment';

export default {
  name: 'Timeline',
  data() {
    return {
      buckets: null,
      daterange: null,
      timeintervalDefaultDuration: Number.parseInt(localStorage.durationDefault),
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
  },
  mounted: async function () {
    await this.getBuckets();
  },
  methods: {
    getBuckets: async function() {
      const daterange = this.daterange ? this.daterange : [
        moment().subtract(1, 'day'),
        moment(),
      ];
      this.buckets = await this.$store.dispatch('buckets/getBucketsWithEvents', {
        start: daterange[0].format(),
        end: daterange[1].format(),
      });
    },
  },
};
</script>
