<!--

  NOTE: This file was copied from Activity.vue, could probably be refactored into something a lot better with less code duplication.

-->

<template lang="pug">
div
  h3.mb-0 {{ $t('trendsFor') }} {{ timeperiod | friendlyperiod }}

  div.mb-2
    ul.list-group.list-group-horizontal-md.mb-3(style="font-size: 0.9em; opacity: 0.7")
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        | #[b {{ $t('host') }}] {{ host }}

  b-alert(style="warning" show)
    | {{ $t('featureDev') }}

  div
    aw-timeline-barchart(:datasets="datasets" :height="100")

  div
    hr
    h5 {{ $t('options') }}

    // TODO: Refactor options from Activity into component and reuse here

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | {{ $t('loadData') }}
</template>

<style lang="scss" scoped></style>

<script>
import moment from 'moment';
import { get_today } from '~/util/time';

import { buildBarchartDataset } from '~/util/datasets';

export default {
  name: 'Trends',
  props: {
    host: String,
  },
  data: function () {
    const today = get_today();
    const since = moment(today).subtract(7, 'days');
    return {
      today,
      timeperiod: { start: since, length: [7, 'days'] },
    };
  },

  computed: {
    datasets: function () {
      return buildBarchartDataset(
        this.$store,
        this.$store.state.activity.category.by_period,
        this.$store.state.activity.active.events,
        this.$store.state.categories.classes
      );
    },
  },

  mounted: async function () {
    this.$store.dispatch('categories/load');
    await this.refresh();
  },

  methods: {
    refresh: async function (force) {
      await this.$store.dispatch('activity/query_category_time_by_period', {
        timeperiod: this.timeperiod,
        host: this.host,
        force: force,
        filterAFK: this.filterAFK,
        includeAudible: this.includeAudible,
        filterCategories: this.filterCategories,
      });
    },

    load_demo: async function () {
      this.data = { '2021-01': 1000, '2021-02': 500 };
    },
  },
};
</script>
