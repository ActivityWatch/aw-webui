<template lang="pug">
div
  GChart(type="Timeline" :data="chartData" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>
import moment from 'moment';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString} from '../util/color.js'

export default {
  props: ['buckets'],
  data () {
    return {};
  },
  computed: {
    // Array will be automatically processed with visualization.arrayToDataTable function
    colors() {
      let colors = [];
      _.each(this.buckets, (bucket) => {
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          let c = getColorFromString(event.data.app);
          if(!_.includes(colors, c)) {
            colors.push(c);
          }
        })
      });
      return colors;
    },
    chartData() {
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
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          data.push([
            bucket.name,
            event.data.app,
            // WARNING: XSS risk
            // TODO: This will be subject to an XSS attack and must be escaped
            (
              `<table>
              <tr><th>App:</th><td>${event.data.app}</td></tr>
              <tr><th>Title:</th><td>${event.data.title}</td></tr>
              <tr></tr>
              <tr><th>Time:</th><td style="white-space: nowrap;">${event.timestamp.toISOString()}</td></tr>
              <tr><th>Duration:</th><td>${seconds_to_duration(event.duration)}</td></tr>
              <tr><th>Color:</th><td>${seconds_to_duration(event.duration)}</td></tr>
              </table>`
            ),
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
          showRowLabels: false
        },
        tooltip: {
          isHtml: true
        }
      }
    }
  },
}
</script>
