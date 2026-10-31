<template lang="pug">
div
  div.form-group
    select.form-control(v-model="vis_method")
      option(value="eventlist") {{ $t('ui.eventView.eventList') }}
      option(value="timeline") {{ $t('ui.eventView.timeline') }}
      option(value="summary") {{ $t('ui.eventView.summary') }}
      option(value="raw") {{ $t('ui.eventView.rawJson') }}

  div(v-if="vis_method == 'timeline' && canUseEventVisualizations")
    vis-timeline(:buckets="[{'id': 'search', 'type': 'search', 'events': events}]")
  div(v-else-if="vis_method == 'timeline'")
    pre.result-fallback {{ fallbackText }}
  div(v-if="vis_method == 'eventlist' && canUseEventVisualizations")
    aw-eventlist(:events="events")
  div(v-else-if="vis_method == 'eventlist'")
    pre.result-fallback {{ fallbackText }}
  div(v-if="vis_method == 'summary' && canUseEventVisualizations")
    input.form-control(type="text" v-model.lazy.trim="summaryKey" :placeholder="$t('ui.eventView.dataKey')" style="margin-bottom: 1em;")
    aw-summary(:fields="events", :colorfunc="colorfunc", :namefunc="namefunc")
  div(v-else-if="vis_method == 'summary'")
    pre.result-fallback {{ fallbackText }}
  div(v-if="vis_method == 'raw'")
    pre {{ events }}
</template>

<script lang="ts">
import { formatQueryResult, isEventArray } from '~/util/queryResult';

export default {
  name: 'aw-selectable-eventview',
  props: {
    events: { type: null, default: () => [] },
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
  computed: {
    canUseEventVisualizations: function () {
      return isEventArray(this.events);
    },
    fallbackText: function () {
      return formatQueryResult(this.events);
    },
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
