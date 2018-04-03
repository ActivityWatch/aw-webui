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
    div.form-group
      span.btn.btn-success(v-on:click="query()") Query

  hr

  div.form-group
    select.form-control(v-model="vis_method")
      option(value="") Select a visualization method
      option(value="timeline") Timeline
      option(value="eventlist") Event List

  div(v-if="vis_method == 'timeline'")
    aw-timeline(type="simple", :event_type="event_type", :events="events")
  div(v-if="vis_method == 'eventlist'")
    aw-eventlist(:events="events")
</template>

<style scoped lang="scss">
</style>

<script>
import moment from 'moment';
import awclient from '../awclient.js';

import Timeline from '../visualizations/Timeline.vue';
import EventList from '../visualizations/EventList.vue';

let today = moment().startOf("day");
let tomorrow = moment(today).add(24, "hours");

export default {
  name: "QueryExplorer",
  components: {
    "aw-timeline": Timeline,
    "aw-eventlist": EventList,
  },
  data: () => {
    return {
      "query_code": "bucketname='aw-watcher-window_hostname';\n\
events = query_bucket(bucketname);\n\
RETURN = events;",
      "vis_method": "",
      "event_type": "currentwindow",
      "events": [],
      "today": today.format(),
      "tomorrow": tomorrow.format(),
      "error": "",
      "startdate": today.format("YYYY-MM-DD"),
      "enddate": tomorrow.format("YYYY-MM-DD"),
    }
  },
  methods: {
    query: function() {
      let query = this.query_code.split(";").map((s) => s.trim() + ";");
      let timeperiods = [moment(this.startdate).format() + "/" + moment(this.enddate).format()];
      awclient.query(timeperiods, query).then((response) => {
        console.log(response.data);
        this.events = response.data[0];
        this.error = "";
       }, (err) => this.error_handler(err.response.data.message));
    },
    error_handler: function(error) {
      this.error = error;
    }
  },
  mounted: function() {
  },
}
</script>
