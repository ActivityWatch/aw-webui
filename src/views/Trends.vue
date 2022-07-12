<!--

  NOTE: This file was copied from Activity.vue, could probably be refactored into something a lot better with less code duplication.

-->

<template lang="pug">
div
  h3.mb-0 Trends for {{ timeperiod | friendlyperiod }}

  // Select a hostname from the ones available in the store
  b-input-group(size="sm")
    b-form-select(
      v-model="host"
      label="Host"
      :options="bucketsStore.hosts"
      placeholder="Select a hostname")

  div.mb-2
    ul.list-group.list-group-horizontal-md.mb-3(style="font-size: 0.9em; opacity: 0.7")
      li.list-group-item.pl-0.pr-3.py-0.border-0
        | #[b Host:] {{ host }}

  b-alert(style="warning" show)
    | This feature is still in early development.

  div
    aw-timeline-barchart(:datasets="datasets" :height="100")

  div
    hr
    h5 Options

    // TODO: Refactor options from Activity into component and reuse here

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | Load demo data
</template>

<style lang="scss" scoped></style>

<script lang="ts">
import moment from 'moment';
import { get_today_with_offset } from '~/util/time';
import { buildBarchartDataset } from '~/util/datasets';

import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useActivityStore, QueryOptions } from '~/stores/activity';

export default {
  name: 'Trends',
  props: {},
  data: function () {
    const today = get_today_with_offset();
    const n_days = 7;
    const since = moment(today).subtract(n_days, 'days');
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),
      activityStore: useActivityStore(),

      today,
      timeperiod: { start: since, length: [n_days, 'day'] },
    };
  },

  computed: {
    host() {
      return this.$route.params.host;
    },
    datasets: function () {
      return buildBarchartDataset(
        this.activityStore.category.by_period,
        this.categoryStore.classes
      );
    },
  },

  mounted: async function () {
    this.categoryStore.load();
    await this.refresh();
  },

  methods: {
    refresh: async function (force) {
      const queryParams: QueryOptions = {
        timeperiod: this.timeperiod,
        host: this.host,
        force,
        filter_afk: this.filter_afk,
        include_audible: this.include_audible,
        filter_categories: this.filter_categories,
        dont_query_inactive: false,
      };
      await this.activityStore.query_category_time_by_period(queryParams);
    },

    load_demo: async function () {
      this.data = { '2021-01': 1000, '2021-02': 500 };
    },
  },
};
</script>
