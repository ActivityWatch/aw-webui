<template lang="pug">
div
  GChart(type="Timeline" :data="chartData" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>
import moment from 'moment';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString, getTitleAttr} from '../util/color.js'


import VueGoogleCharts from 'vue-google-charts';
Vue.use(VueGoogleCharts);

console.warn("This should not be used anywhere as it depends on Google Charts that may not be used offline according to their TOS!");

export default {
  props: ['buckets', 'showRowLabels'],
  data () {
    return {
      colors: []
    };
  },
  computed: {
    // Array will be automatically processed with visualization.arrayToDataTable function
    chartData() {
      this.colors = [];
      let data = [
        [
          { id: 'Bucket', type: 'string' },
          { id: 'App', type: 'string' },
          { id: 'tooltip', role: 'tooltip', type: 'string', p: { 'html': true } },
          { id: 'Start', type: 'date' },
          { id: 'End', type: 'date' },
        ]
      ];
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
      _.each(this.buckets, (bucket) => {
        if(bucket.events === undefined) {
          return;
        }
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          let color = getColorFromString(getTitleAttr(bucket, event));
          if(!_.includes(this.colors, color)) {
            this.colors.push(color);
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
      return data;
    },
    chartOptions() {
      return {
        colors: this.colors,
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
