<template lang="pug">
div
  h2 Activity for {{ periodReadable }}

  p
    | Host: {{ host }}
    br
    | Active time: {{ $store.state.activity_daily.active_duration | friendlyduration }}

  div.d-flex
    div.p-1
      b-button-group
        b-button(:to="link_prefix + '/' + previousPeriod() + '/' + subview",
                 variant="outline-dark")
          icon(name="arrow-left")
          span.d-none.d-md-inline
            |  Previous
        b-button(:to="link_prefix + '/' + nextPeriod() + '/' + subview",
                 :disabled="nextPeriod() > today", variant="outline-dark")
          span.d-none.d-md-inline
            |  Next
          icon(name="arrow-right")
    div.p-1
      b-select(:value="periodLength", :options="['day', 'week', 'month']",
               @change="(periodLength) => setDate(date, periodLength)")
    div.p-1(v-if="periodLength === 'day'")
      input.form-control(id="date" type="date" :value="date" :max="today"
                         @change="setDate($event.target.value)")

    div.p-1.ml-auto
      b-button-group
        b-button(@click="refresh(true)", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  aw-periodusage(:periodusage_arr="periodusage", :link_prefix="link_prefix")

  ul.row.nav.nav-tabs.my-3.px-3
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-summary', params: $route.params }")
        h5 Summary
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-window', params: $route.params }")
        h5 Window
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-browser', params: $route.params }")
        h5 Browser
    li.nav-item
      router-link.nav-link(:to="{ name: 'activity-daily-editor', params: $route.params }")
        h5 Editor

  div
    router-view

  div
    h5 Options

    div.row
      div.col-md-6
        b-form-group(label="Show category" label-cols="5" label-cols-lg="4")
          b-form-select(v-model="filterCategory", :options="categories")
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

import 'vue-awesome/icons/arrow-left'
import 'vue-awesome/icons/arrow-right'
import 'vue-awesome/icons/sync'

export default {
  name: "Activity",
  props: {
    host: String,
    date: {
      type: String,
      default: get_today(),
    },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: function() {
    return {
      today: get_today(),
      filterCategory: null,
    };
  },
  computed: {
    subview: function() { return this.$route.meta.subview; },
    categories: function() {
      const cats = this.$store.getters["settings/all_categories"];
      console.log(cats);
      const entries = cats.map(c => { return { text: c.join(" > "), value: c } });
      return [{ text: "All", value: null}, { text: "Uncategorized", value: ["Uncategorized"]}].concat(entries);
    },
    filterCategories: function() {
      // TODO: Also return all child categories
      if(this.filterCategory) {
        const cats = this.$store.getters["settings/all_categories"];
        const isChild = p => c => c.length > p.length && _.isEqual(p, c.slice(0, p.length));
        const children = _.filter(cats, isChild(this.filterCategory));
        console.log(children);
        return [this.filterCategory].concat(children);
      } else {
        return null;
      }
    },
    link_prefix: function() { return `/activity/${this.host}/${this.periodLength}` },
    periodusage: function() {
      return this.$store.getters['activity_daily/getActiveHistoryAroundTimeperiod'](this.timeperiod);
    },
    timeperiod: function() {
      // TODO: Get start of day/week/month (depending on periodLength) with offset
      return { start: get_day_start_with_offset(this.date), length: [1, this.periodLength] };
    },
    dateformat: function() {
      if(this.periodLength === 'day') { return "YYYY-MM-DD"; }
      else if(this.periodLength === 'week') { return "YYYY[ W]WW"; }
      else if(this.periodLength === 'month') { return "YYYY-MM"; }
      else if(this.periodLength === 'year') { return "YYYY"; }
      else {
        return "YYYY-MM-DD";
      }
    },
    periodReadable: function() { return moment(this.timeperiod.start).format(this.dateformat); },
  },
  watch: {
    timeperiod: function() {
      this.refresh();
    },
    filterCategory: function() {
      this.refresh();
    },
  },

  mounted: async function() {
    this.$store.dispatch('settings/load');
    await this.refresh();
  },

  methods: {
    previousPeriod: function() { return moment(this.date).subtract(1, `${this.periodLength}s`).format("YYYY-MM-DD") },
    nextPeriod: function() { return moment(this.date).add(1, `${this.periodLength}s`).format("YYYY-MM-DD") },
    setDate: function(date, periodLength) {
      const new_date = moment(date).startOf(periodLength).format("YYYY-MM-DD");
      this.$router.push(`/activity/${this.host}/${periodLength}/${new_date}`);
    },

    refresh: async function(force) {
      await this.$store.dispatch("activity_daily/ensure_loaded", { timeperiod: this.timeperiod, host: this.host, force: force, filterAFK: true, filterCategories: this.filterCategories });
    },
  },
}
</script>
