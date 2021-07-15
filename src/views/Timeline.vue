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

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-show="!(buckets !== null && num_events)")
    h1 {{ $t('loading') }}
</template>

<script>
import _ from 'lodash';
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
  watch: {
    daterange() {
      this.getBuckets();
    },
  },
  methods: {
    getBuckets: async function () {
      this.buckets = await this.$store.dispatch('buckets/getBucketsWithEvents', {
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
    },
  },
};
</script>
