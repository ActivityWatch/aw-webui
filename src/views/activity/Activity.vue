<template lang="pug">
div
  h3 Activity #[span.d-sm-inline.d-none for ]
    span.text-muted.d-sm-inline-block.d-block  {{ timeperiod | friendlyperiod }}

  div.mb-2.dim
    ul.list-group.list-group-horizontal-md
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        b.mr-1 Host:
        span {{ host }}
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        b.mr-1 Time active:
        span {{ $store.state.activity.active.duration | friendlyduration }}
    ul.list-group.list-group-horizontal-md(v-if="this.periodLength != 'day'")
      li.list-group-item.pl-0.pr-3.py-0(style="border: 0")
        b.mr-1 Query range:
        span {{ this.periodReadableRange }}


  div.mb-2.d-flex
    div
      b-input-group
        b-input-group-prepend
          b-button.px-2(:to="link_prefix + '/' + previousPeriod() + '/' + subview + '/' + currentViewId",
                   variant="outline-dark")
            icon(name="arrow-left")
        b-select.pl-2.pr-3(:value="periodLength", :options="periodLengths",
                 @change="(periodLength) => setDate(_date, periodLength)")
        b-input-group-append
          b-button.px-2(:to="link_prefix + '/' + nextPeriod() + '/' + subview + '/' + currentViewId",
                   :disabled="nextPeriod() > today", variant="outline-dark")
            icon(name="arrow-right")

    div.mx-2(v-if="periodLength === 'day'")
      input.form-control.px-2(id="date" type="date" :value="_date" :max="today"
                         @change="setDate($event.target.value, periodLength)")

    div.ml-auto
      b-button-group
        b-button.px-2(:pressed.sync="showOptions", variant="outline-dark")
          icon(name="filter")
          span.d-none.d-md-inline
            |  Filters
        b-button.px-2(@click="refresh(true)", variant="outline-dark")
          icon(name="sync")
          span.d-none.d-md-inline
            |  Refresh

  div.row(v-if="showOptions" style="background-color: #EEE;").my-3.py-3
    div.col-md-12
      h5 Filters
    div.col-md-6
      b-form-checkbox(v-model="filterAFK" size="sm")
        | Exclude AFK time
        icon#filterAFKHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="filterAFKHelp" v-b-tooltip.hover title="Filter away time where the AFK watcher didn't detect any input.")
      b-form-checkbox(v-model="includeAudible" :disabled="!filterAFK" size="sm")
        | Count audible browser tab as active
        icon#includeAudibleHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="includeAudibleHelp" v-b-tooltip.hover title="If the active window is an audible browser tab, count as active. Requires a browser watcher.")

    div.col-md-6.mt-2.mt-md-0
      b-form-group(label="Show category" label-cols="5" label-cols-lg="4" style="font-size: 0.88em")
        b-form-select(v-model="filterCategory", :options="categories" size="sm")


  aw-periodusage.mt-2(:periodusage_arr="periodusage", @update="setDate")

  ul.row.nav.nav-tabs.mt-4
    li.nav-item(v-for="view in views")
      router-link.nav-link(:to="{ name: 'activity-view', params: {...$route.params, view_id: view.id}}" :class="{'router-link-exact-active': currentView.id == view.id}")
        h6 {{view.name}}

    li.nav-item(style="margin-left: auto")
      a.nav-link(@click="$refs.new_view.show()")
        h6
          icon(name="plus")
          span.d-none.d-md-inline
            | New view

  b-modal(id="new_view" ref="new_view" title="New view" @show="resetModal" @hidden="resetModal" @ok="handleOk")
    div.my-1
      b-input-group.my-1(prepend="ID")
        b-form-input(v-model="new_view.id")
      b-input-group.my-1(prepend="Name")
        b-form-input(v-model="new_view.name")

  div
    router-view

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | Load demo data
</template>

<style lang="scss" scoped>
@import '../../style/globals';

.dim {
  opacity: 0.85;
}

.nav {
  border-bottom: 1px solid $lightBorderColor;

  .nav-item {
    margin-bottom: 0px;

    &:first-child {
      margin-left: 0;
    }

    .nav-link {
      // default bootstrap vertical padding was too high
      padding: 0.25rem 1rem;

      color: lighten(black, 40%);
      cursor: pointer;
      border: none;

      &:hover {
        color: black !important;
        border-bottom: 3px solid lighten(black, 70%);
        border-radius: 0;
      }

      &.router-link-exact-active {
        color: $activeHighlightColor !important;
        border-bottom: 3px solid lighten($activeHighlightColor, 15%);
        border-radius: 0;

        // Does nothing for Verala Round
        font-weight: bold;

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
import { periodLengthConvertMoment } from '~/util/timeperiod';
import _ from 'lodash';

import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/question-circle';
import 'vue-awesome/icons/filter';

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
      showOptions: false,
      filterCategory: null,
      includeAudible: true,
      filterAFK: true,
      new_view: {},
    };
  },
  computed: {
    periodLengths: function () {
      const periods = ['day', 'week', 'month'];
      if (localStorage.showYearly && JSON.parse(localStorage.showYearly)) {
        periods.push('year');
      }
      return periods;
    },
    views: function () {
      return this.$store.state.views.views;
    },
    currentView: function () {
      return this.views.find(v => v.id == this.$route.params.view_id) || this.views[0];
    },
    currentViewId: function () {
      // If localStore is not yet initialized, then currentView can be undefined. In that case, we return an empty string (which should route to the default view)
      return this.currentView !== undefined ? this.currentView.id : '';
    },
    _date: function () {
      return this.date || get_today();
    },
    subview: function () {
      return this.$route.meta.subview;
    },
    categories: function () {
      const cats = this.$store.getters['categories/all_categories'];
      const entries = cats
        .map(c => {
          return { text: c.join(' > '), value: c };
        })
        .sort((a, b) => a.text > b.text);
      return [
        { text: 'All', value: null },
        { text: 'Uncategorized', value: ['Uncategorized'] },
      ].concat(entries);
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
    periodReadableRange: function () {
      const periodStart = moment(this.timeperiod.start);
      const dateFormatString = 'YYYY-MM-DD';

      // it's helpful to render a range for the week as opposed to just the start of the week
      // or the number of the week so users can easily determine (a) if we are using monday/sunday as the week
      // start and exactly when the week ends. The formatting code ends up being a bit more wonky, but it's
      // worth the tradeoff. https://github.com/ActivityWatch/aw-webui/pull/284

      const startOfWeek = periodStart.format(dateFormatString);
      const endOfWeek = periodStart.add(1, this.periodLength).format(dateFormatString);
      return `${startOfWeek}—${endOfWeek}`;
    },
  },
  watch: {
    host: function () {
      this.refresh();
    },
    timeperiod: function () {
      this.refresh();
    },
    filterCategory: function () {
      this.refresh();
    },
    filterAFK: function () {
      this.refresh();
    },
    includeAudible: function () {
      this.refresh();
    },
  },

  mounted: async function () {
    this.$store.dispatch('views/load');
    this.$store.dispatch('categories/load');
    try {
      await this.refresh();
    } catch (e) {
      if (e.message !== 'canceled') {
        console.error(e);
        throw e;
      }
    }
  },

  beforeDestroy: async function () {
    // Cancels pending requests and resets store
    await this.$store.dispatch('activity/reset');
  },

  methods: {
    previousPeriod: function () {
      return moment(this._date).subtract(1, `${this.periodLength}s`).format('YYYY-MM-DD');
    },
    nextPeriod: function () {
      return moment(this._date).add(1, `${this.periodLength}s`).format('YYYY-MM-DD');
    },

    setDate: function (date, periodLength) {
      // periodLength is an optional argument, default to this.periodLength
      if (!periodLength) {
        periodLength = this.periodLength;
      }
      const new_period_length_moment = periodLengthConvertMoment(periodLength);
      const new_date = moment(date).startOf(new_period_length_moment).format('YYYY-MM-DD');
      this.$router.push(
        `/activity/${this.host}/${periodLength}/${new_date}/${this.subview}/${this.currentViewId}`
      );
    },

    refresh: async function (force) {
      await this.$store.dispatch('activity/ensure_loaded', {
        timeperiod: this.timeperiod,
        host: this.host,
        force: force,
        filterAFK: this.filterAFK,
        includeAudible: this.includeAudible,
        filterCategories: this.filterCategories,
      });
    },

    load_demo: async function () {
      await this.$store.dispatch('activity/load_demo');
    },

    checkFormValidity() {
      // All checks must be false for check to pass
      const checks = {
        // Check if view id is unique
        'ID is not unique': this.$store.state.views.views.map(v => v.id).includes(this.new_view.id),
        'Missing ID': this.new_view.id === '',
        'Missing name': this.new_view.name === '',
      };
      const errors = Object.entries(checks)
        .filter(([_k, v]) => v)
        .map(([k, _v]) => k);
      const valid = errors.length == 0;
      if (!valid) {
        alert(`Invalid form input: ${errors}`);
      }
      return valid;
    },

    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Trigger submit handler
      this.handleSubmit();
    },

    handleSubmit() {
      // Exit when the form isn't valid
      const valid = this.checkFormValidity();
      if (!valid) {
        return;
      }

      this.$store.commit('views/addView', { id: this.new_view.id, name: this.new_view.name });

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.new_view.hide();
      });
    },

    resetModal() {
      this.new_view = {
        id: '',
        name: '',
      };
    },
  },
};
</script>
