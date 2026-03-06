<template lang="pug">
div.mx-3
  b-form
    b-form-group(label="Host:")
      select(v-model="selectedHost")
        option(v-for="host in hostnames" :value="host") {{ host }}
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
import moment from 'moment';
import _ from 'lodash';
import FullCalendar from '@fullcalendar/vue';
import timeGridPlugin from '@fullcalendar/timegrid';

import queries from '~/queries';
import { useCategoryStore } from '~/stores/categories';

function mergeAdjacent(events) {
  // process events, merging adjacent events with same category
  const mergedEvents = [];
  let lastEvent = null;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (lastEvent == null) {
      lastEvent = event;
      continue;
    }
    // if adjacent with less than 10 seconds between, merge
    const isAdjacent =
      moment(event.timestamp).diff(
        moment(lastEvent.timestamp).add(lastEvent.duration, 'seconds'),
        'seconds'
      ) < 10;
    if (
      isAdjacent &&
      event.data['$category'].join(' > ') == lastEvent.data['$category'].join(' > ')
    ) {
      lastEvent.duration += event.duration;
    } else {
      mergedEvents.push(lastEvent);
      lastEvent = event;
    }
  }
  if (lastEvent != null) mergedEvents.push(lastEvent);
  return mergedEvents;
}

// TODO: Use canonical timeline query, with flooding and categorization
// TODO: Checkbox for toggling category-view, where adjacent events with same category are merged and the events are labeled by category
// TODO: Use the recommended way of dynamically getting events: https://fullcalendar.io/docs/events-function
export default {
  components: {
    FullCalendar,
  },
  props: {
    buckets: { type: Array },
  },
  data() {
    return {
      events: [],
      fitToActive: false,
      selectedHost: 'erb-m2.localdomain',
      view: 'timeGridWeek',
    };
  },
  computed: {
    hostnames: function () {
      if (this.buckets == null) return [];
      return _.uniq(this.buckets.map(b => b.hostname).filter(h => h != null));
    },
    calendarOptions: function () {
      const events = this.events;
      const first = _.minBy(events, e => e.start);
      const last = _.maxBy(events, e => e.end);
      // FIXME: end must be at least one slot (1 hour) after start, otherwise it fails hard
      let start, end;
      if (this.fitToActive && events.length > 0) {
        console.log(first.start);
        start = moment(first.start).startOf('hour').format().slice(11, 16);
        end = moment(last.end).endOf('hour').format().slice(11, 16);
      } else {
        start = '00:00:00';
        end = '24:00:00';
      }
      return {
        plugins: [timeGridPlugin],
        initialView: this.view,
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
    queryOptions: function () {
      return {
        hostname: this.selectedHost,
        filter_afk: true,
        start: moment().startOf('week').format(),
        stop: moment().endOf('week').format(),
      };
    },
  },
  watch: {
    view: function (to) {
      const calendar = this.$refs.fullCalendar.getApi();
      calendar.changeView(to);
    },
    selectedHost: async function () {
      console.log('selectedHost changed');
      this.events = await this.loadEventsCanonical();
    },
  },
  mounted: async function () {
    this.events = await this.loadEventsCanonical();
  },
  methods: {
    onEventClick: function (arg) {
      // TODO: Open event inspector/editor here
      alert('event click!\n' + JSON.stringify(arg.event, null, 2));
    },
    loadEventsCanonical: async function () {
      console.log('loadEventsCanonical');
      console.log(this.queryOptions.hostname);
      if (this.queryOptions.hostname == null) return [];

      const categoryStore = useCategoryStore();
      categoryStore.load();
      const categories = categoryStore.classes_for_query;

      let query = queries.canonicalEvents({
        bid_window: 'aw-watcher-window_' + this.queryOptions.hostname,
        bid_afk: 'aw-watcher-afk_' + this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        categories,
      });
      query += 'RETURN = events;';
      console.log(query);
      query = query.split(';').map(s => s.trim() + ';');

      const timeperiods = [
        moment(this.queryOptions.start).format() + '/' + moment(this.queryOptions.stop).format(),
      ];
      console.log('Querying');
      const data = await this.$aw.query(timeperiods, query);
      console.log(data);
      let events = _.orderBy(data[0], ['timestamp'], ['desc']);

      events = mergeAdjacent(events);
      console.log('mergedEvents', events);

      events = _.filter(events, e => e.duration > 60);
      events = _.map(events, e => {
        return {
          title: e.data['$category'].join(' > '),
          start: moment(e.timestamp).format(),
          end: moment(e.timestamp).add(e.duration, 'seconds').format(),
          backgroundColor: categoryStore.get_category_color(e.data['$category']),
        };
      });
      return events;
    },
  },
};
</script>
