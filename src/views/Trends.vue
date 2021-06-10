<!--

  NOTE: This file was copied from Activity.vue, could probably be refactored into something a lot better with less code duplication.

-->

<template lang="pug">
div
  h3.mb-0 Trends for {{ periodReadable }}

  div.mb-2
    ul.list-group.list-group-horizontal-md.mb-3(style="font-size: 0.9em; opacity: 0.7")
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        | #[b Host:] {{ host }}

  // TODO: Add chart

  div
    hr
    h5 Options

    // TODO: Refactor options from Activity into component and reuse here

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | Load demo data
</template>

<style lang="scss" scoped></style>

<script>
import moment from 'moment';
import { get_day_start_with_offset, get_today } from '~/util/time';
import _ from 'lodash';

export default {
  name: 'Trends',
  props: {
    host: String,
  },
  data: function () {
    return {
      today: get_today(),
    };
  },

  mounted: async function () {
    this.$store.dispatch('categories/load');
    await this.refresh();
  },

  methods: {
    refresh: async function (force) {
      await this.$store.dispatch('activity/get_trend', {
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
