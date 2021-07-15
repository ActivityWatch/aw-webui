<template lang="pug">
div
  div.form-group
    select.form-control(v-model="vis_method")
      option(value="eventlist") {{ $t('eventList') }}
      option(value="timeline") {{ $t('timeline') }}
      option(value="summary") {{ $t('summary') }}
      option(value="raw") {{ $t('rawJson') }}

  div(v-if="vis_method == 'timeline'")
    vis-timeline(:buckets="[{'type': 'search', 'events': events}]")
  div(v-if="vis_method == 'eventlist'")
    aw-eventlist(:events="events")
  div(v-if="vis_method == 'summary'")
    input.form-control(type="text" v-model.lazy.trim="summaryKey" :placeholder="$t('dataKey')" style="margin-bottom: 1em;")
    aw-summary(:fields="events", :colorfunc="colorfunc", :namefunc="namefunc")
  div(v-if="vis_method == 'raw'")
    pre {{ events }}
</template>

<script>
export default {
  name: 'aw-selectable-eventview',
  props: {
    events: Array,
    event_type: { type: String, default: 'currentwindow' },
  },
  data: function () {
    return {
      vis_method: 'eventlist',

      /* Summary props */
      summaryKey: 'title',
      colorfunc: null,
      namefunc: null,
    };
  },
  mounted: async function () {
    this.colorfunc = this.summaryKeyFunc;
    this.namefunc = this.summaryKeyFunc;
  },
  methods: {
    summaryKeyFunc: function (e) {
      return e.data[this.summaryKey];
    },
  },
};
</script>
