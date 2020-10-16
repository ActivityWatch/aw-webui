<template lang="pug">

div
  h3 Query Explorer

  | See #[a(href="https://activitywatch.readthedocs.io/en/latest/querying-data.html") the documentation] for help on how to write queries.

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
      textarea.form-control(v-model="query_code", style="font-family: monospace" rows=4)
    div.form-inline
      div.form-group
        button.btn.btn-success(type="button", @click="query()") Query
      span(style="padding-left: 1em;")
      | {{eventcount_str}}

  hr

  div.form-group
    select.form-control(v-model="vis_method")
      option(value="eventlist") Event List
      option(value="timeline") Timeline
      option(value="summary") Summary
      option(value="raw") Raw JSON

  div(v-if="vis_method == 'timeline'")
    aw-timeline(type="simple", :event_type="event_type", :events="events")
  div(v-if="vis_method == 'eventlist'")
    aw-eventlist(:events="events")
  div(v-if="vis_method == 'summary'")
    input.form-control(type="text" v-model.lazy.trim="summaryKey" placeholder="data key" style="margin-bottom: 1em;")
    aw-summary(:fields="events", :colorfunc="colorfunc", :namefunc="namefunc")
  div(v-if="vis_method == 'raw'")
    pre {{ events }}

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
      vis_method: 'eventlist',
      event_type: 'currentwindow',
      events: [],
      today: today.format(),
      tomorrow: tomorrow.format(),
      error: '',
      startdate: today.format('YYYY-MM-DD'),
      enddate: tomorrow.format('YYYY-MM-DD'),

      /* Summary props */
      summaryKey: '',
      colorfunc: null,
      namefunc: null,
    };
  },
  computed: {
    eventcount_str: function () {
      if (Array.isArray(this.events)) return 'Number of events: ' + this.events.length;
      else return '';
    },
  },
  mounted: function () {
    this.colorfunc = this.summaryKeyFunc;
    this.namefunc = this.summaryKeyFunc;
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
    summaryKeyFunc: function (e) {
      return e.data[this.summaryKey];
    },
  },
};
</script>
