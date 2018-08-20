<template lang="pug">
div
  GChart(type="Timeline" :data="chartData" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>
import moment from 'moment';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString} from '../util/color.js'

// TODO: Move to utils
function titleKey(bucket, event) {
  if(bucket.type == "currentwindow") {
    return event.data.app;
  } else if(bucket.type == "web.tab.current") {
    return (new URL(event.data.url)).hostname;
  } else if(bucket.type == "afkstatus") {
    return event.data.status;
  } else {
    return event.data.title;
  }
}

export default {
  props: ['buckets', 'showRowLabels'],
  data () {
    return {};
  },
  computed: {
    // Array will be automatically processed with visualization.arrayToDataTable function
    colors() {
      let colors = [];
      _.each(this.buckets, (bucket) => {
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          let c = getColorFromString(titleKey(bucket, event));
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
          data.push([
            bucket.id,
            titleKey(bucket, event),
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
