<template lang="pug">
div
  h3.mb-0
    | {{ $t('activity.title') }}
    span.d-sm-inline.d-none {{ $t('activity.titleFor') }}
    span.text-muted.d-sm-inline-block.d-block
      span(v-if="periodIsBrowseable") {{ timeperiod | friendlyperiod }}
      span(v-else) {{ periodLengthText[periodLength] }}

  div.mb-3.text-muted(style="font-size: 0.9em;")
    ul.list-group.list-group-horizontal-md
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.host') }}
        span {{ host }}
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.timeActive') }}
        span {{ activityStore.active.duration | friendlyduration }}
    ul.list-group.list-group-horizontal-md(v-if="periodLength != 'day'")
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.queryRange') }}
        span {{ periodReadableRange }}

  div.activity-toolbar.d-flex.flex-wrap.align-items-center
    div.d-flex.mr-2
      b-button-group
        b-button.px-3(
          v-for="opt in primaryPeriods"
          :key="opt.value"
          :pressed="periodLength === opt.value"
          @click="setDate(_date, opt.value)"
          variant="outline-dark"
          size="sm"
        ) {{ opt.text }}
        // If an extended period is active (week/month/year), surface it as
        // an extra pressed pill so the user sees what's selected — the kebab
        // alone wouldn't communicate that. Click toggles it back off (back
        // to "day") so it's not stuck.
        b-button.px-3(
          v-if="!isPrimaryPeriod"
          pressed
          variant="outline-dark"
          size="sm"
          @click="setDate(_date, 'day')"
        ) {{ extendedPeriodLabel }}
      // Kebab sits outside the b-button-group so the last pressed pill
      // (whichever it is) keeps its rounded right corner.
      b-dropdown.kebab-dropdown.ml-1(
        size="sm"
        variant="outline-secondary"
        toggle-class="border-0"
        no-caret
        right
        title="More ranges"
        aria-label="More date ranges"
      )
        template(v-slot:button-content)
          icon(name="ellipsis-v")
        b-dropdown-item-button(
          v-for="opt in extendedPeriods"
          :key="opt.value"
          :active="periodLength === opt.value"
          @click="setDate(_date, opt.value)"
        ) {{ opt.text }}

    b-input-group.mr-2(size="sm" style="width: auto")
      b-input-group-prepend
        b-button.px-2(:to="link_prefix + '/' + previousPeriod() + '/' + subview + '/' + currentViewId",
                 variant="outline-dark",
                 :title="'Previous ' + periodLength",
                 :aria-label="'Previous ' + periodLength")
          icon(name="arrow-left")
      input.form-control.form-control-sm.activity-dateinput(
        type="date"
        :value="_date"
        :max="today"
        :title="periodIsBrowseable ? periodReadableRange : ''"
        @change="setDate($event.target.value, periodLength)"
      )
      b-input-group-append
        b-button.px-2(:to="link_prefix + '/' + nextPeriod() + '/' + subview + '/' + currentViewId",
                      :disabled="nextPeriod() > today", variant="outline-dark",
                      :title="'Next ' + periodLength",
                      :aria-label="'Next ' + periodLength")
          icon(name="arrow-right")

    div.ml-auto
      b-button-group(size="sm")
        b-button.px-2(:pressed.sync="showOptions", variant="outline-dark", title="Filters", aria-label="Filters")
          icon(name="filter")
          span.d-none.d-md-inline
            |  {{ $t('activity.filters') }}
            b-badge(pill, variant="secondary" v-if="filters_set > 0").ml-2 {{ filters_set }}
        b-button.px-2(@click="refresh(true)", variant="outline-dark", title="Refresh", aria-label="Refresh")
          icon(name="sync")
          span.d-none.d-md-inline
            |  {{ $t('activity.refresh') }}

  div.row(v-if="showOptions" style="background-color: #EEE;").my-3.py-3
    div.col-md-12
      h5 {{ $t('activity.filters') }}
    div.col-md-6
      b-form-checkbox(v-model="filter_afk" size="sm")
        | {{ $t('activity.excludeAfk') }}
        icon#filterAFKHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="filterAFKHelp" v-b-tooltip.hover :title="$t('activity.excludeAfkHelp')")
      b-form-checkbox(v-model="include_audible" :disabled="!filter_afk" size="sm")
        | {{ $t('activity.countAudible') }}
        icon#includeAudibleHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="includeAudibleHelp" v-b-tooltip.hover :title="$t('activity.countAudibleHelp')")

      b-form-checkbox(v-if="devmode" v-model="include_stopwatch" size="sm")
        // WIP: https://github.com/ActivityWatch/aw-webui/pull/368
        | {{ $t('activity.includeStopwatch') }}
        br
        b {{ $t('home.noteLabel') }}
        |  {{ $t('activity.includeStopwatchNote') }}

    div.col-md-6.mt-2.mt-md-0
      b-form-group(:label="$t('activity.showCategory')" label-cols="5" label-cols-lg="4" style="font-size: 0.88em")
        b-form-select(v-model="filter_category", :options="categoryStore.category_select(true)" size="sm")


  aw-periodusage(:periodusage_arr="periodusage", @update="setDate")

  aw-uncategorized-notification(:periodLength="periodLength")

  ul.row.nav.nav-tabs.mt-4
    li.nav-item(v-for="view in views")
      router-link.nav-link(:to="{ name: 'activity-view', params: {...$route.params, view_id: view.id}, query: $route.query}" :class="{'router-link-exact-active': currentView.id == view.id}")
        h6 {{ viewName(view) }}

    li.nav-item(style="margin-left: auto")
      a.nav-link(@click="$refs.new_view.show()")
        h6
          icon(name="plus")
          span.d-none.d-md-inline
            | {{ $t('activity.newView') }}

  b-modal(id="new_view" ref="new_view" :title="$t('activity.newView')" :ok-title="$t('common.confirm')" :cancel-title="$t('common.cancel')" @show="resetModal" @hidden="resetModal" @ok="handleOk")
    div.my-1
      b-input-group.my-1(:prepend="$t('activity.id')")
        b-form-input(v-model="new_view.id")
      b-input-group.my-1(:prepend="$t('activity.name')")
        b-form-input(v-model="new_view.name")

  div
    router-view

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | {{ $t('activity.loadDemoData') }}
</template>

<style lang="scss" scoped>
@import '../../style/globals';

.activity-toolbar {
  // row-gap kicks in only when items wrap to a second line, so the
  // single-row case stays compact without piling mb-2 on every child.
  row-gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.activity-dateinput {
  // Keep the date picker compact and aligned with the period button-group
  // regardless of mode (day / week / month / year / N days). The full
  // human-readable range remains available via the input's tooltip and the
  // page heading.
  width: 9.5rem;
  min-width: 9.5rem;
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

<script lang="ts">
import { mapState } from 'pinia';
import moment from 'moment';
import { get_day_start_with_offset, get_today_with_offset } from '~/util/time';
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
import 'vue-awesome/icons/ellipsis-v';

import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { useActivityStore, QueryOptions } from '~/stores/activity';
import { useViewsStore } from '~/stores/views';

export default {
  name: 'Activity',
  components: {
    'aw-uncategorized-notification': () => import('~/components/UncategorizedNotification.vue'),
  },
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
      activityStore: useActivityStore(),
      categoryStore: useCategoryStore(),
      viewsStore: useViewsStore(),
      settingsStore: useSettingsStore(),

      today: null,
      showOptions: false,

      include_audible: true,
      // Include stopwatch events when a stopwatch bucket exists. The
      // store query falls back to noop if no bucket is present, so this
      // is safe for users without stopwatch data. Enabling by default
      // means the "Top Stopwatch Events" visualization shows real
      // numbers as soon as a user records a session; previously a
      // stopwatch run produced "No data" unless they also flipped the
      // dev-only "Include manually logged events" checkbox.
      include_stopwatch: true,
      filter_afk: true,
      new_view: {},
    };
  },
  computed: {
    ...mapState(useViewsStore, ['views']),
    ...mapState(useSettingsStore, ['devmode']),
    ...mapState(useSettingsStore, ['always_active_pattern']),

    // number of filters currently set (different from defaults)
    filters_set() {
      return (this.filter_category ? 1 : 0) + (!this.filter_afk ? 1 : 0);
    },

    // getter and setter for filter_category, getting and setting $route.query
    filter_category: {
      get() {
        if (!this.$route.query.category) return null;
        return this.$route.query.category.split('>');
      },
      set(value) {
        if (value == null) {
          this.$router.push({ query: _.omit(this.$route.query, 'category') });
        } else {
          this.$router.push({ query: { ...this.$route.query, category: value.join('>') } });
        }
      },
    },

    periodLengths: function () {
      const settingsStore = useSettingsStore();
      const periods = [
        { value: 'day', text: this.$t('activity.periodDay') },
        { value: 'week', text: this.$t('activity.periodWeek') },
        { value: 'month', text: this.$t('activity.periodMonth') },
      ];
      if (settingsStore.showYearly) {
        periods.push({ value: 'year', text: this.$t('activity.periodYear') });
      }
      return periods.concat([
        { value: 'last7d', text: this.$t('activity.period7Days') },
        { value: 'last30d', text: this.$t('activity.period30Days') },
      ]);
    },
    periodLengthText: function () {
      return {
        last7d: this.$t('activity.last7Days'),
        last30d: this.$t('activity.last30Days'),
      };
    },
    periodLengthsButtons: function () {
      return this.periodLengths;
    },
    // Rolling windows ("Last N days") are surfaced as primary buttons —
    // they always represent a full period of data, whereas calendar
    // periods (week/month/year) show only a partial range until the
    // boundary is reached. Calendar periods stay in the kebab for users
    // who need exact week/month boundaries (week-over-week comparisons).
    primaryPeriods: function () {
      return this.periodLengthsButtons.filter(p => ['day', 'last7d', 'last30d'].includes(p.value));
    },
    extendedPeriods: function () {
      return this.periodLengthsButtons.filter(p => !['day', 'last7d', 'last30d'].includes(p.value));
    },
    isPrimaryPeriod: function () {
      return ['day', 'last7d', 'last30d'].includes(this.periodLength);
    },
    extendedPeriodLabel: function () {
      const opt = this.extendedPeriods.find(p => p.value === this.periodLength);
      return opt ? opt.text : '';
    },
    periodIsBrowseable: function () {
      return ['day', 'week', 'month', 'year'].includes(this.periodLength);
    },
    currentView: function () {
      return this.views.find(v => v.id == this.$route.params.view_id) || this.views[0];
    },
    currentViewId: function () {
      // If localStore is not yet initialized, then currentView can be undefined. In that case, we return an empty string (which should route to the default view)
      return this.currentView !== undefined ? this.currentView.id : '';
    },
    _date: function () {
      const offset = this.settingsStore.startOfDay;
      return this.date || get_today_with_offset(offset);
    },
    subview: function () {
      return this.$route.meta.subview;
    },
    filter_categories: function () {
      if (this.filter_category) {
        const cats = this.categoryStore.all_categories;
        const isChild = p => c => c.length > p.length && _.isEqual(p, c.slice(0, p.length));
        const children = _.filter(cats, isChild(this.filter_category));
        return [this.filter_category].concat(children);
      } else {
        return null;
      }
    },
    link_prefix: function () {
      return `/activity/${this.host}/${this.periodLength}`;
    },
    periodusage: function () {
      return this.activityStore.getActiveHistoryAroundTimeperiod(this.timeperiod);
    },
    timeperiod: function () {
      const settingsStore = useSettingsStore();

      if (this.periodIsBrowseable) {
        return {
          start: get_day_start_with_offset(this._date, settingsStore.startOfDay),
          length: [1, this.periodLength],
        };
      } else {
        const len = { last7d: [7, 'days'], last30d: [30, 'days'] }[this.periodLength];
        return {
          start: get_day_start_with_offset(
            moment(this._date).subtract(len[0] - 1, len[1]),
            settingsStore.startOfDay
          ),
          length: len,
        };
      }
    },
    periodReadableRange: function () {
      const periodStart = moment(this.timeperiod.start);
      const dateFormatString = 'YYYY-MM-DD';

      // it's helpful to render a range for the week as opposed to just the start of the week
      // or the number of the week so users can easily determine (a) if we are using monday/sunday as the week
      // start and exactly when the week ends. The formatting code ends up being a bit more wonky, but it's
      // worth the tradeoff. https://github.com/ActivityWatch/aw-webui/pull/284

      let periodLength;
      if (this.periodIsBrowseable) {
        periodLength = [1, this.periodLength];
      } else {
        if (this.periodLength === 'last7d') {
          periodLength = [7, 'day'];
        } else if (this.periodLength === 'last30d') {
          periodLength = [30, 'day'];
        } else {
          throw 'unknown periodLength';
        }
      }

      const startOfPeriod = periodStart.format(dateFormatString);
      const endOfPeriod = periodStart.add(...periodLength).format(dateFormatString);
      return `${startOfPeriod}—${endOfPeriod}`;
    },
  },
  watch: {
    host: function () {
      this.refresh();
    },
    timeperiod: function () {
      this.refresh();
    },
    filter_category: function () {
      this.refresh();
    },
    filter_afk: function () {
      this.refresh();
    },
    include_audible: function () {
      this.refresh();
    },
  },

  mounted: async function () {
    this.viewsStore.load();
    this.categoryStore.load();
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
    await this.activityStore.reset();
  },

  methods: {
    previousPeriod: function () {
      return moment(this._date)
        .subtract(
          this.timeperiod.length[0],
          this.timeperiod.length[1] as moment.unitOfTime.DurationConstructor
        )
        .format('YYYY-MM-DD');
    },
    nextPeriod: function () {
      return moment(this._date)
        .add(
          this.timeperiod.length[0],
          this.timeperiod.length[1] as moment.unitOfTime.DurationConstructor
        )
        .format('YYYY-MM-DD');
    },

    setDate: function (date, periodLength) {
      // periodLength is an optional argument, default to this.periodLength
      if (!periodLength) {
        periodLength = this.periodLength;
      }

      const momentJsDate = moment(date);
      if (!momentJsDate.isValid()) {
        return;
      }

      // When switching between period buttons (day/week/month/year), prefer
      // today's date if today falls inside the source period. Otherwise the
      // user gets thrown across the calendar — e.g. year(2026) → month →
      // week lands on 2025-12-29 because startOf("week") of Jan 1 walks
      // back into the previous year.
      let anchorDate = momentJsDate;
      const today = moment(get_today_with_offset(this.settingsStore.startOfDay));
      if (this.periodIsBrowseable) {
        const sourceUnit = periodLengthConvertMoment(this.periodLength);
        const sourceStart = momentJsDate.clone().startOf(sourceUnit);
        // moment.add() rejects "isoWeek" as a DurationConstructor (even
        // though startOf() accepts it). Cast — runtime handles both spellings.
        const sourceEnd = sourceStart
          .clone()
          .add(1, sourceUnit as moment.unitOfTime.DurationConstructor);
        if (today.isSameOrAfter(sourceStart) && today.isBefore(sourceEnd)) {
          anchorDate = today;
        }
      }

      let new_date;
      if (periodLength == 'last7d') {
        periodLength = 'last7d';
        new_date = anchorDate.clone().add(1, 'days').format('YYYY-MM-DD');
      } else if (periodLength == 'last30d') {
        periodLength = 'last30d';
        new_date = anchorDate.clone().add(1, 'days').format('YYYY-MM-DD');
      } else {
        const new_period_length_moment = periodLengthConvertMoment(periodLength);
        new_date = anchorDate.clone().startOf(new_period_length_moment).format('YYYY-MM-DD');
      }
      const path = `/activity/${this.host}/${periodLength}/${new_date}/${this.subview}/${this.currentViewId}`;
      if (this.$route.path !== path) {
        this.$router.push({
          path,
          query: this.$route.query,
        });
      }
    },

    refresh: async function (force) {
      const queryOptions: QueryOptions = {
        timeperiod: this.timeperiod,
        host: this.host,
        force: force,
        filter_afk: this.filter_afk,
        include_audible: this.include_audible,
        include_stopwatch: this.include_stopwatch,
        filter_categories: this.filter_categories,
        always_active_pattern: this.always_active_pattern,
      };
      await this.activityStore.ensure_loaded(queryOptions);
    },

    load_demo: async function () {
      await this.activityStore.load_demo();
    },
    viewName(view) {
      return view.nameKey ? this.$t(view.nameKey) : view.name || view.id;
    },

    checkFormValidity() {
      // All checks must be false for check to pass
      const checks = {
        // Check if view id is unique
        [this.$t('activity.idNotUnique')]: this.viewsStore.views
          .map(v => v.id)
          .includes(this.new_view.id),
        [this.$t('activity.missingId')]: this.new_view.id === '',
        [this.$t('activity.missingName')]: this.new_view.name === '',
      };
      const errors = Object.entries(checks)
        .filter(([_k, v]) => v)
        .map(([k, _v]) => k);
      const valid = errors.length == 0;
      if (!valid) {
        alert(this.$t('activity.invalidFormInput', { errors: errors.join(', ') }));
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

      const viewsStore = useViewsStore();
      viewsStore.addView({ id: this.new_view.id, name: this.new_view.name, elements: [] });
      viewsStore.save();

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
