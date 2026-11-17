<template lang="pug">
div
  h3 {{ $t('report.title') }}

  | {{ $t('report.description') }}

  b-alert.mt-2(variant="warning" show)
    | {{ $t('report.earlyDev') }}

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  aw-select-categories-or-pattern(v-model="filterCategories")
    template(v-slot:input-group-append="")
      b-button(type="button", @click="generate()" variant="success" :disabled="!has_pattern")
        icon(name="search")
        | {{ $t('report.generate') }}

  div.d-flex.mt-1
    span.mr-auto.small.text-muted {{ $t('ui.search.hostname') }}: {{queryOptions.hostname}}
    b-button.border-0(size="sm", variant="outline-dark" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] {{ $t('ui.search.showOptions') }}
      span(v-else)
        | #[icon(name="angle-double-up")] {{ $t('ui.search.hideOptions') }}

  div(v-show="show_options")
    h4 {{ $t('report.options') }}
    aw-query-options(v-model="queryOptions")

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] {{ $t('ui.search.searching') }}


  div(v-if="events != null")
    hr

    div.d-flex
      div.flex-fill
        | {{ $t('report.foundEvents', { count: events.length, seconds: (queryTime / 1000).toFixed(2) }) }}
      div
        b-input-group(size="sm")
          b-input-group-prepend
            b-input-group-text
              icon(name="save")
              .mx-1 {{ $t('ui.report.exportAs') }}
          b-input-group-append
            b-button(type="button", @click="export_csv()" variant="outline-dark")
              | {{ $t('report.csv') }}
            b-button(type="button", @click="export_json()" variant="outline-dark")
              | {{ $t('ui.report.json') }}

    hr

    vis-timeline(:events="events.slice(0, 500)" filterShortEvents=true)
    div.small.text-muted(v-if="events.length > 500")
      | {{ $t('ui.report.recentEvents', { shown: 500, total: events.length }) }}

    hr

    aw-timeline-barchart(v-if="datasets.length" :datasets="datasets" :timeperiod_start="result.period.start" :timeperiod_length="result.period.length" :height="100")

    hr

    aw-selectable-eventview(:events="events")

    hr

    div
      | {{ $t('search.notFound') }}
      br
      | {{ $t('search.addWeek') }} #[b-button(size="sm" variant="outline-dark" @click="extendByWeek()") {{ $t('search.addWeekBtn') }}]

</template>

<style scoped lang="scss"></style>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';

import 'vue-awesome/icons/search';
import 'vue-awesome/icons/spinner';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

import { canonicalEvents, querystr_to_array } from '~/queries';
import { reportChartDatasets } from '~/util/reportChart';
import { TimePeriod } from '~/util/timeperiod';

import { useCategoryStore } from '~/stores/categories';
import { useBucketsStore } from '~/stores/buckets';

import { getClient } from '~/util/awclient';
import { downloadFile, reportEventsCsv } from '~/util/export';

export default {
  name: 'Report',
  data() {
    return {
      categoryStore: useCategoryStore(),
      bucketsStore: useBucketsStore(),

      result: null,
      generation: 0,

      status: null,
      queryTime: null,
      error: '',

      // Options
      show_options: false,
      queryOptions: {},
      filterCategories: [],
    };
  },
  computed: {
    has_pattern: function () {
      return this.filterCategories.length > 0;
    },
    events: function () {
      return this.result ? this.result.events : null;
    },
    datasets: function () {
      return this.result ? this.result.datasets : [];
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
  },
  methods: {
    generate: async function () {
      const generation = ++this.generation;
      this.status = 'searching';
      const time = moment();
      try {
        // Controls remain editable; all result data belongs to this resolved request.
        const options = _.cloneDeep(this.queryOptions);
        const categories = _.cloneDeep(this.filterCategories);
        const classes = _.cloneDeep(this.categoryStore.classes);
        const start = moment(options.start);
        const end = moment(options.stop);
        if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
          throw new Error('Report end must be after its start.');
        }
        const period: TimePeriod = {
          start: start.format(),
          length: [end.diff(start), 'milliseconds'],
        };
        let query = canonicalEvents({
          ...this.bucketsStore.desktopBucketIds(options.hostname),
          filter_afk: options.filter_afk,
          categories,
          filter_categories: categories.map(c => c[0]),
        });
        query += '; RETURN = events;';
        const data = await getClient().query(
          [start.format() + '/' + end.format()],
          querystr_to_array(query)
        );
        if (generation !== this.generation) return;
        const events = _.orderBy(data[0], ['timestamp'], ['desc']);
        const datasets = reportChartDatasets(events, period, classes);
        this.result = { events, datasets, period };
        this.error = '';
        this.queryTime = moment().diff(time);
      } catch (e) {
        if (generation !== this.generation) return;
        console.error(e);
        this.error = e?.response?.data?.message || e?.message || this.$t('common.requestFailed');
      } finally {
        if (generation === this.generation) this.status = null;
      }
    },

    async export_json() {
      const data = JSON.stringify(this.events, null, 2);
      await downloadFile('events.json', data, 'application/json');
    },

    async export_csv() {
      await downloadFile('events.csv', reportEventsCsv(this.events), 'text/csv');
    },

    extendByWeek() {
      this.queryOptions.start = moment(this.queryOptions.start)
        .subtract(1, 'week')
        .format('YYYY-MM-DD');
      this.generate();
    },
  },
};
</script>
