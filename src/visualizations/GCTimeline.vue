<template lang="pug">
div
  GChart(type="Timeline" :data="dataAndColors[0]" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>
import moment from 'moment';
import _ from 'lodash';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString, getTitleAttr} from '../util/color.js'

import Vue from 'vue';
import VueGoogleCharts from 'vue-google-charts';
Vue.use(VueGoogleCharts);

console.warn("This should not be used anywhere as it depends on Google Charts that may not be used offline according to their TOS!");

// TODO: Move to utils
function buildTooltip(bucket, event) {
  // WARNING: XSS risk
  // TODO: This will be subject to an XSS attack and must be escaped
  let inner = "Unknown bucket type";
  if(bucket.type == "currentwindow") {
    inner = `
      <tr><th>App:</th><td>${event.data.app}</td></tr>
      <tr><th>Title:</th><td>${event.data.title}</td></tr>
      `;
  } else if(bucket.type == "web.tab.current") {
    inner = `
      <tr><th>Title:</th><td>${event.data.title}</td></tr>
      <tr><th>URL:</th><td><a href=${event.data.url}>${event.data.url}</a></td></tr>
      `;
  } else {
    inner = `
      <tr><td>Data:</td><td>${JSON.stringify(event.data)}</td></tr>
      `;
  }
  return `<table>${inner}
    <tr></tr>
    <tr><th>Time:</th><td style="white-space: nowrap;">${event.timestamp.toISOString()}</td></tr>
    <tr><th>Duration:</th><td>${seconds_to_duration(event.duration)}</td></tr>
    </table>`;
}

export default {
  props: ['buckets', 'showRowLabels'],
  data () {
    return {
      colors: []
    };
  },
  computed: {
    // Array will be automatically processed with visualization.arrayToDataTable function
    dataAndColors() {
      let colors = [];
      let data = [
        [
          { id: 'Bucket', type: 'string' },
          { id: 'App', type: 'string' },
          { id: 'tooltip', role: 'tooltip', type: 'string', p: { 'html': true } },
          { id: 'Start', type: 'date' },
          { id: 'End', type: 'date' },
        ]
      ];
      _.each(this.buckets, (bucket) => {
        if(bucket.events === undefined) {
          return;
        }
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          let color = getColorFromString(getTitleAttr(bucket, event));
          if(!_.includes(colors, color)) {
            colors.push(color);
          }
          data.push([
            bucket.id,
            getTitleAttr(bucket, event),
            buildTooltip(bucket, event),
            new Date(event.timestamp),
            new Date(moment(event.timestamp).add(event.duration, 'seconds'))
          ]);
        })
      })
      return [data, colors];
    },
    chartOptions() {
      return {
        colors: this.dataAndColors[1],
        timeline: {
          showRowLabels: this.showRowLabels,
        },
        tooltip: {
          isHtml: true
        }
      }
    }
  },
}
</script>
