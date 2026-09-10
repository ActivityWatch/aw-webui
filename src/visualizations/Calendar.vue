<template lang="pug">
div.mx-3
  b-form
    b-form-group(label="Bucket:")
      select(v-model="selectedBucket")
        option(v-for="bucket in buckets", :value="bucket.id") {{ bucket.id }}
    b-form-group(label="Show:")
      select(v-model="view")
        option(value="timeGridDay") Day
        option(value="timeGridWeek") Week
    b-form-group
      b-checkbox(v-model="fitToActive")
        | Fit to active
  FullCalendar(ref="fullCalendar", :options="calendarOptions")
</template>

<script>
import { getTitleAttr, getColorFromString } from '../util/color';
import moment from 'moment';
import _ from 'lodash';
import FullCalendar from '@fullcalendar/vue';
import timeGridPlugin from '@fullcalendar/timegrid';
import { calendarTimeBounds } from '~/util/calendar';

// TODO: Use canonical timeline query, with flooding and categorization
// TODO: Checkbox for toggling category-view, where adjacent events with same category are merged and the events are labeled by category
// TODO: Use the recommended way of dynamically getting events: https://fullcalendar.io/docs/events-function
export default {
  components: {
    FullCalendar, // make the <FullCalendar> tag available
  },
  props: {
    buckets: { type: Array },
  },
  data() {
    return { fitToActive: false, selectedBucket: null, view: 'timeGridDay' };
  },
  computed: {
    calendarOptions: function () {
      const events = this.events;
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
      if (this.buckets == null) return [];

      const bucket = _.find(this.buckets, b => b.id == this.selectedBucket);
      if (bucket == null) {
        return [];
      }
      let events = bucket.events;
      events = _.filter(events, e => e.duration > 10);
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
      alert('event click! ' + JSON.stringify(arg.event));
    },
  },
};
</script>
