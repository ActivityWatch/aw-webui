<template lang="pug">
div
  div#visualization
</template>


<style lang="scss">
div#visualization {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.vis-timeline {
  font-family: arial;
  font-size: 9pt;

  .vis-item {
    border: 0;
    /*
    border-width: 0 1px 0 1px !important;
    border-color: #fff !important;
    */

    .vis-item-content {
      color: #333;
    }
  }

  .vis-tooltip {
    font-family: arial !important;
    font-size: 9pt !important;

    table {
      td {
        max-width: 25em;
        text-overflow: ellipsis;
        overflow: hidden;
      }
    }
  }
}
</style>


<script>
import moment from 'moment';
import {seconds_to_duration} from '../util/time.js'
import {getColorFromString, getTitleAttr} from '../util/color.js'

// Docs: http://visjs.org/docs/timeline/
import {DataSet, Timeline} from 'vis/dist/vis-timeline-graph2d.min.js';
import 'vis/dist/vis-timeline-graph2d.min.css';

export default {
  props: ['buckets', 'showRowLabels'],
  data () {
    return {
      timeline: null,
      options: {
        zoomMin: 1000 * 60,             // 10min in milliseconds
        zoomMax: 1000 * 60 * 60 * 24 * 31 * 3,    // about three months in milliseconds
        stack: false,
        tooltip: {
          followMouse: true,
          overflowMethod: 'cap',
        }
      }
    };
  },
  mounted() {
    this.$nextTick(() => {
      let el = this.$el.querySelector('#visualization');
      this.timeline = new Timeline(el, [], [], this.options);
    });
  },
  watch: {
    buckets() {
      let groups = _.map(this.buckets, (bucket, bidx) => {
        return {id: bidx, content: this.showRowLabels ? '': bucket.id};
      });
      let items = _.map(this.chartData, (row, i) => {
        return {
          id: i,
          group: row[0],
          content: row[1],
          title: row[2],
          start: moment(row[3]),
          end: moment(row[4]),
          style: `background-color: ${row[5]}`,
        }
      });
      if(groups.length > 0 && items.length > 0) {
        this.options.min = _.min(_.map(items, (item) => item.start));
        this.options.max = _.max(_.map(items, (item) => item.end));
        this.timeline.setOptions(this.options);
        this.timeline.setData({groups: groups, items: items})
        this.timeline.fit();
      }
    }
  },
  computed: {
    chartData() {
      let data = [];
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
          <tr><th>Time:</th><td>${event.timestamp.toISOString()}</td></tr>
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
            getTitleAttr(bucket, event),
            buildTooltip(bucket, event),
            new Date(event.timestamp),
            new Date(moment(event.timestamp).add(event.duration, 'seconds')),
            getColorFromString(getTitleAttr(bucket, event)),
          ]);
        })
      })
      return data;
    },
  },
}
</script>
