<template lang="pug">

div
  h3 Query Explorer

  | See #[a(href="https://docs.activitywatch.net/en/latest/examples/querying-data.html") the documentation] for help on how to write queries.

  hr

  div.alert.alert-danger(v-if="error")
    | {{error}}

  form
    div.form-row
      div.form-group.col-md-6
        | Start
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | End
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-group
      textarea.form-control(v-model="query_code", @keypress.ctrl.enter="query()" style="font-family: monospace", rows=4)
    div.form-inline
      div.form-group
        button.btn.btn-success(type="button", @click="query()") Query
      span(style="padding-left: 1em;")
      | {{eventcount_str}}

  hr

  aw-selectable-eventview(:events="events", :event_type="event_type")
</template>

<style scoped lang="scss"></style>

<script>
import moment from 'moment';

const today = moment().startOf('day');
const tomorrow = moment(today).add(24, 'hours');

export default {
  name: 'QueryExplorer',
  data() {
    return {
      query_code: `afk_events = query_bucket(find_bucket("aw-watcher-afk_"));
window_events = query_bucket(find_bucket("aw-watcher-window_"));
window_events = filter_period_intersect(window_events, filter_keyvals(afk_events, "status", ["not-afk"]));
merged_events = merge_events_by_keys(window_events, ["app", "title"]);
RETURN = sort_by_duration(merged_events);`,
      event_type: 'currentwindow',
      events: [],
      today: today.format(),
      tomorrow: tomorrow.format(),
      error: '',
      startdate: today.format('YYYY-MM-DD'),
      enddate: tomorrow.format('YYYY-MM-DD'),
    };
  },
  computed: {
    eventcount_str: function () {
      if (Array.isArray(this.events)) return 'Number of events: ' + this.events.length;
      else return '';
    },
  },
  methods: {
    query: async function () {
      const query = this.query_code.split(';').map(s => s.trim() + ';');
      const timeperiods = [moment(this.startdate).format() + '/' + moment(this.enddate).format()];
      try {
        const data = await this.$aw.query(timeperiods, query);
        this.events = data[0];
        this.error = '';
      } catch (e) {
        this.error = e.response.data.message;
      }
    },
  },
};
</script>
