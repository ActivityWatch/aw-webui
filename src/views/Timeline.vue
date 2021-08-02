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

    //- vis-timeline(:buckets="buckets", :showRowLabels='true', :queriedInterval="daterange")
    aw-heatmap(:categories="categories", :datasets="datasets")

    aw-devonly(reason="Not ready for production, still experimenting")
      aw-calendar(:buckets="buckets")
  div(v-show="!(buckets !== null && num_events)")
    h1 {{ $t('loading') }}
</template>

<script>
import _ from 'lodash';
import moment from 'moment';
import { buildHeatmapDataset } from '../util/datasets';
import { buildTooltip } from '../util/tooltip.js';
import { getColorFromString, getTitleAttr } from '../util/color';

export default {
  name: 'Timeline',
  data() {
    return {
      buckets: null,
      daterange: null,
      timeintervalDefaultDuration: Number.parseInt(localStorage.durationDefault),
      maxDuration: 31 * 24 * 60 * 60,
      filterAFK: true,
      includeAudible: true,
    };
  },
  computed: {
    categories() {
      return this.$store.state.activity.category.by_period ?
        Object.keys(this.$store.state.activity.category.by_period).map(d => moment(d.split('/')?.[0]).format('DD-MM-YYYY HH:mm:SS')) :
        [];
    },
    datasets() {
      return buildHeatmapDataset(
        this.$store,
        this.$store.state.activity.category.by_period
      );
    },
    host() {
      return this.buckets?.find(b => b.hostname !== 'unknown')?.hostname;
    },
    num_events() {
      return _.sumBy(this.buckets, 'events.length');
    },
    filterCategories: function () {
      if (this.filterCategory) {
        const cats = this.$store.getters['categories/all_categories'];
        const isChild = p => c => c.length > p.length && _.isEqual(p, c.slice(0, p.length));
        const children = _.filter(cats, isChild(this.filterCategory));
        return [this.filterCategory].concat(children);
      } else {
        return null;
      }
    },
  },
  watch: {
    daterange() {
      this.refresh();
    },
    // host: function () {
    //   this.refresh();
    // },
    // filterCategory: function () {
    //   this.refresh();
    // },
    // filterAFK: function () {
    //   this.refresh();
    // },
  },
  mounted: async function () {
    await this.getBuckets();
    await this.$store.dispatch('categories/load');
    await this.refresh();
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
    refresh: async function (force) {
      const daterange = this.daterange ? this.daterange : [
        moment().subtract(1, 'day'),
        moment(),
      ];
      if (!this.daterange) {
        return;
      }

      const timeperiod = {
        start: daterange[0],
        length: [1, 'day'],
      };

      await this.$store.dispatch('activity/ensure_loaded', {
        timeperiod,
        host: this.host,
        force,
        filterAFK: this.filterAFK,
        includeAudible: this.includeAudible,
        filterCategories: this.filterCategories,
      });
    },
  },
};
</script>
