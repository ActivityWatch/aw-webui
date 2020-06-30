<template>
  <FullCalendar :options="calendarOptions" />
</template>

<script>
import { getTitleAttr, getColorFromString } from '../util/color';
import moment from 'moment';
import FullCalendar from '@fullcalendar/vue';
import timeGridPlugin from '@fullcalendar/timegrid';

// TODO: Use canonical timeline query instead, with flooding and categorization
// TODO: Use the recommended way of dynamically getting events: https://fullcalendar.io/docs/events-function
export default {
  components: {
    FullCalendar, // make the <FullCalendar> tag available
  },
  props: {
    buckets: { type: Array },
  },
  data() {
    return { fitToActive: true };
  },
  computed: {
    calendarOptions: function() {
      const events = this.events;
      const first = _.minBy(events, e => e.start);
      const last = _.maxBy(events, e => e.end);
      // FIXME: end must be at least one slot (1 hour) after start, otherwise it fails hard
      const start = this.fitToActive && events.length > 0 ? first.start.slice(11, 16) : '00:00:00';
      const end = this.fitToActive && events.length > 0 ? last.end.slice(11, 16) : '24:00:00';
      return {
        plugins: [timeGridPlugin],
        initialView: 'timeGridDay',
        eventClick: this.onEventClick,
        events: events,
        allDaySlot: false,
        slotMinTime: start,
        slotMaxTime: end,
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
    events: function() {
      // NOTE: This returns FullCalendar events, not ActivityWatch events.
      if (this.buckets == null) return [];

      const bucket = _.find(this.buckets, b => b.id == 'aw-watcher-window_erb-main2-arch');
      let events = bucket.events;
      events = _.filter(events, e => e.duration > 10);
      events = _.map(events, e => {
        return {
          title: getTitleAttr(bucket, e),
          start: moment(e.timestamp).format(),
          end: moment(e.timestamp)
            .add(e.duration, 'seconds')
            .format(),
          backgroundColor: getColorFromString(getTitleAttr(bucket, e)),
        };
      });
      return events;
    },
  },
  methods: {
    onEventClick: function(arg) {
      // TODO: Open event inspector/editor here
      alert('event click! ' + JSON.stringify(arg.event));
    },
  },
};
</script>
