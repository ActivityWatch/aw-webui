<template lang="pug">
div.mx-3
  b-form
    b-form-group(:label="$t('ui.calendar.source')")
      select(:value="activeSource", @change="source = $event.target.value")
        option(value="category", :disabled="!hasCategories") {{ $t('ui.calendar.categories') }}
        option(value="bucket") {{ $t('ui.calendar.rawBucket') }}
    b-form-group(v-if="activeSource === 'bucket'", :label="$t('ui.calendar.bucket')")
      select(v-model="selectedBucket")
        option(v-for="bucket in buckets", :value="bucket.id") {{ bucket.id }}
    b-form-group(:label="$t('ui.calendar.show')")
      select(v-model="view")
        option(value="timeGridDay") {{ $t('ui.calendar.day') }}
        option(value="timeGridWeek") {{ $t('ui.calendar.week') }}
    b-form-group
      b-checkbox(v-model="fitToActive")
        | {{ $t('ui.calendar.fitActive') }}
  FullCalendar(ref="fullCalendar", :options="calendarOptions")
</template>

<script lang="ts">
import { getTitleAttr, getColorFromString } from '../util/color';
import moment from 'moment';
import _ from 'lodash';
import FullCalendar from '@fullcalendar/vue';
import timeGridPlugin from '@fullcalendar/timegrid';
import { calendarTimeBounds } from '~/util/calendar';
import { useCategoryStore } from '~/stores/categories';
import { categoryPathLabel } from '~/util/categoryLabels';

// Category mode renders the Timeline's canonical categorized stream
// (categoryTimelineQuery + mergeCategoryIntervals), so there is no second query.
// TODO: Use the recommended way of dynamically getting events: https://fullcalendar.io/docs/events-function
export default {
  components: {
    FullCalendar, // make the <FullCalendar> tag available
  },
  props: {
    buckets: { type: Array },
    // Merged category intervals from Timeline; they carry no source event IDs.
    categorizedEvents: { type: Array, default: () => [] },
  },
  data() {
    return { fitToActive: false, selectedBucket: null, source: null, view: 'timeGridDay' };
  },
  computed: {
    hasCategories: function () {
      // Key off renderable blocks, so a stream of only zero-duration or
      // uncategorized intervals still falls back to the raw bucket.
      return this.categoryEvents.length > 0;
    },
    activeSource: function () {
      if (this.source === 'bucket') return 'bucket';
      return this.hasCategories ? 'category' : 'bucket';
    },
    calendarOptions: function () {
      const events: any[] = Array.isArray(this.events) ? this.events.filter(Boolean) : [];
      return {
        plugins: [timeGridPlugin],
        initialView: this.view,
        eventClick: this.onEventClick,
        events: events,
        allDaySlot: false,
        ...calendarTimeBounds(events, this.fitToActive),
        nowIndicator: true,
        expandRows: true,
        slotLabelFormat: {
          hour: '2-digit',
          minute: '2-digit',
          //second: '2-digit',
          hour12: false,
        },
      };
    },
    events: function () {
      // NOTE: This returns FullCalendar events, not ActivityWatch events.
      if (this.activeSource === 'category') return this.categoryEvents;
      if (this.buckets == null) return [];

      const bucket = _.find(this.buckets, b => b.id == this.selectedBucket);
      if (bucket == null) {
        return [];
      }
      let events = Array.isArray(bucket.events) ? bucket.events : [];
      events = _.filter(events, e => e && e.timestamp && Number(e.duration) > 10);
      events = _.map(events, e => {
        return {
          title: getTitleAttr(bucket, e),
          start: moment(e.timestamp).format(),
          end: moment(e.timestamp).add(e.duration, 'seconds').format(),
          backgroundColor: getColorFromString(getTitleAttr(bucket, e)),
        };
      });
      return events;
    },
    categoryEvents: function () {
      const categoryStore = useCategoryStore();
      const intervals = Array.isArray(this.categorizedEvents) ? this.categorizedEvents : [];
      return intervals
        .filter(e => e && e.timestamp && Number(e.duration) > 0 && e.data?.$category)
        .map(e => {
          const name = e.data.$category;
          return {
            title: categoryPathLabel(name),
            start: moment(e.timestamp).format(),
            end: moment(e.timestamp).add(e.duration, 'seconds').format(),
            backgroundColor: categoryStore.get_category_color(name),
          };
        });
    },
  },
  watch: {
    view: function (to) {
      const calendar = this.$refs.fullCalendar.getApi();
      calendar.changeView(to);
    },
  },
  methods: {
    onEventClick: function (arg) {
      // TODO: Open event inspector/editor here
      console.info('Calendar event selected:', arg.event);
    },
  },
};
</script>
