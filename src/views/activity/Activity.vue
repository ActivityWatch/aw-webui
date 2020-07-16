<template lang="pug">
div
  h3.mb-0 Activity for {{ periodReadable }}

  div.mb-2
    ul.list-group.list-group-horizontal-md.mb-3(style="font-size: 0.9em; opacity: 0.7")
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        | #[b Host:] {{ host }}
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        | #[b Time active:] {{ $store.state.activity.active.duration | friendlyduration }}

  div.mb-2.d-flex
    div
      b-input-group
        b-input-group-prepend
          b-button.px-2(:to="link_prefix + '/' + previousPeriod() + '/' + subview",
                   variant="outline-dark")
            icon(name="arrow-left")
        b-select.px-2(:value="periodLength", :options="['day', 'week', 'month']",
                 @change="(periodLength) => setDate(_date, periodLength)")
        b-input-group-append
          b-button.px-2(:to="link_prefix + '/' + nextPeriod() + '/' + subview",
                   :disabled="nextPeriod() > today", variant="outline-dark")
            icon(name="arrow-right")

    div.mx-2(v-if="periodLength === 'day'")
      input.form-control.px-2(id="date" type="date" :value="_date" :max="today"
                         @change="setDate($event.target.value, periodLength)")

    div.ml-auto
      b-button-group
        b-button.px-2(@click="refresh(true)", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="periodusage", @update="setDate")

  ul.row.nav.nav-tabs.mt-3.pl-3
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-summary', params: $route.params }")
        h6 Summary
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-window', params: $route.params }")
        h6 Window
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-browser', params: $route.params }")
        h6 Browser
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-editor', params: $route.params }")
        h6 Editor

  div
    router-view

  div
    h5 Options

    div.row
      div.col-md-6
        b-form-group(label="Show category" label-cols="5" label-cols-lg="4")
          b-form-select(v-model="filterCategory", :options="categories")

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | Load demo data
</template>

<style lang="scss" scoped>
$buttoncolor: #ddd;
$bordercolor: #ddd;

.nav {
  border-bottom: 2px solid $bordercolor;

  .nav-item {
    margin-bottom: -2px;

    .nav-link {
      background-color: $buttoncolor;
      margin: 0 0.2em 0 0.2em;
      padding: 0.4em 0.5em 0.1em 0.5em;
      border: 2px solid $bordercolor;
      border-bottom: none;
      border-radius: 0.5rem 0.5rem 0 0;
      color: #111 !important;

      &:hover {
        background-color: #f8f8f8;
      }

      &.router-link-exact-active {
        background-color: #fff;
        color: #333 !important;

        &:hover {
          background-color: #fff;
        }
      }
    }
  }
}
</style>

<script>
import moment from 'moment';
import { get_day_start_with_offset, get_today } from '~/util/time';
import _ from 'lodash';

import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/sync';

export default {
  name: 'Activity',
  props: {
    host: String,
    date: {
      type: String,
      // NOTE: This does not work as you'd might expect since the default is set on
      // initialization, which would lead to the same date always being returned,
      // even if the day has changed.
      // Instead, use the computed _date.
      //default: get_today(),
    },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: function () {
    return {
      today: get_today(),
      filterCategory: null,
    };
  },
  computed: {
    _date: function () {
      return this.date || get_today();
    },
    subview: function () {
      return this.$route.meta.subview;
    },
    categories: function () {
      const cats = this.$store.getters['settings/all_categories'];
      const entries = cats.map(c => {
        return { text: c.join(' > '), value: c };
      });
      return [
        { text: 'All', value: null },
        { text: 'Uncategorized', value: ['Uncategorized'] },
      ].concat(entries);
    },
    filterCategories: function () {
      if (this.filterCategory) {
        const cats = this.$store.getters['settings/all_categories'];
        const isChild = p => c => c.length > p.length && _.isEqual(p, c.slice(0, p.length));
        const children = _.filter(cats, isChild(this.filterCategory));
        return [this.filterCategory].concat(children);
      } else {
        return null;
      }
    },
    link_prefix: function () {
      return `/activity/${this.host}/${this.periodLength}`;
    },
    periodusage: function () {
      return this.$store.getters['activity/getActiveHistoryAroundTimeperiod'](this.timeperiod);
    },
    timeperiod: function () {
      return { start: get_day_start_with_offset(this._date), length: [1, this.periodLength] };
    },
    dateformat: function () {
      if (this.periodLength === 'day') {
        return 'YYYY-MM-DD';
      } else if (this.periodLength === 'week') {
        return 'YYYY[ W]WW';
      } else if (this.periodLength === 'month') {
        return 'YYYY-MM';
      } else if (this.periodLength === 'year') {
        return 'YYYY';
      } else {
        return 'YYYY-MM-DD';
      }
    },
    periodReadable: function () {
      return moment(this.timeperiod.start).format(this.dateformat);
    },
    periodLengthMoment: function () {
      return this.periodLengthConvertMoment(this.periodLength);
    },
  },
  watch: {
    timeperiod: function () {
      this.refresh();
    },
    filterCategory: function () {
      this.refresh();
    },
  },

  mounted: async function () {
    this.$store.dispatch('settings/load');
    await this.refresh();
  },

  methods: {
    previousPeriod: function () {
      return moment(this._date).subtract(1, `${this.periodLength}s`).format('YYYY-MM-DD');
    },
    nextPeriod: function () {
      return moment(this._date).add(1, `${this.periodLength}s`).format('YYYY-MM-DD');
    },
    periodLengthConvertMoment(periodLength) {
      if (periodLength === 'day') {
        return 'day';
      } else if (periodLength === 'week') {
        /* This is necessary so the week starts on Monday instead of Sunday */
        return 'isoWeek';
      } else if (periodLength === 'month') {
        return 'month';
      } else if (periodLength === 'year') {
        return 'year';
      } else {
        console.error('Invalid periodLength ${periodLength}, defaulting to "day"');
        return 'day';
      }
    },

    setDate: function (date, periodLength) {
      // periodLength is an optional argument, default to this.periodLength
      if (!periodLength) {
        periodLength = this.periodLength;
      }
      const new_period_length_moment = this.periodLengthConvertMoment(periodLength);
      const new_date = moment(date).startOf(new_period_length_moment).format('YYYY-MM-DD');
      console.log(new_date, periodLength);
      this.$router.push(`/activity/${this.host}/${periodLength}/${new_date}/${this.subview}`);
    },

    refresh: async function (force) {
      await this.$store.dispatch('activity/ensure_loaded', {
        timeperiod: this.timeperiod,
        host: this.host,
        force: force,
        filterAFK: true,
        filterCategories: this.filterCategories,
      });
    },

    load_demo: async function () {
      await this.$store.dispatch('activity/load_demo');
    },
  },
};
</script>
