<template lang="pug">
div
  div#visualization
</template>

<script>
import moment from 'moment';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString} from '../util/color.js'

import {DataSet, Timeline} from 'vis/dist/vis-timeline-graph2d.min.js';
import 'vis/dist/vis-timeline-graph2d.min.css';

// TODO: Move to utils
function titleKey(bucket, event) {
  if(bucket.type == "currentwindow") {
    return event.data.app;
  } else if(bucket.type == "web.tab.current") {
    try {
      return (new URL(event.data.url)).hostname;
    } catch(e) {
      return event.data.url;
    }
  } else if(bucket.type == "afkstatus") {
    return event.data.status;
  } else {
    return event.data.title;
  }
}

export default {
  props: ['buckets', 'showRowLabels'],
  data () {
    return {
      groups: [],
      items: [],
    };
  },
  mounted() {
    this.container = document.getElementById('visualization');
    this.groups = new DataSet();
    this.items = new DataSet([]);
    var options = {
      min: new Date(2018, 7, 1),                // lower limit of visible range
      max: new Date(2018, 10, 1),                // upper limit of visible range
      zoomMin: 1000 * 60 * 60 * 24,             // one day in milliseconds
      zoomMax: 1000 * 60 * 60 * 24 * 31 * 3,    // about three months in milliseconds
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap'
      }
    };
    var timeline = new Timeline(this.container, this.items, this.groups, options);
  },
  watch: {
    buckets() {
      this.groups.clear();
      this.items.clear();
      _.each(this.buckets, (bucket, bidx) => {
        this.groups.add({id: bidx, content: bucket.id});
      });
      console.log(this.groups);
      _.each(this.chartData, (row, i) => {
        if (i === 0 || i > 4) return;
        console.log(row);
        this.items.add({
          id: i,
          group: row[0],
          content: row[1],
          //text: row[2],
          start: moment(row[3]).format('YYYY-MM-DDTHH:mm:ss'),
          end: moment(row[4]).add(1, 'day').format('YYYY-MM-DDTHH:mm:ss'),
        });
      });
      this.items = this.items;
      console.log(this.items);
    }
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
      _.each(this.buckets, (bucket, bidx) => {
        if(bucket.events === undefined) {
          return;
        }
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (event) => {
          data.push([
            bidx,
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
