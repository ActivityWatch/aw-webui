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
    border-radius: 0;
    /*
    border-width: 0 1px 0 1px !important;
    border-color: #fff !important;
    */

    .vis-item-content {
      color: #333;
      text-overflow: ellipsis;
      overflow-x: hidden;
      display: block;
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
import _ from 'lodash';
import moment from 'moment';
import {buildTooltip} from '../util/tooltip.js'
import {getColorFromString, getTitleAttr} from '../util/color.js'

// Docs: http://visjs.org/docs/timeline/
import {Timeline} from 'vis/dist/vis-timeline-graph2d.min.js';
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
      _.each(this.buckets, (bucket, bidx) => {
        if(bucket.events === undefined) {
          return;
        }
        _.each(_.sortBy(bucket.events, (e) => e.timestamp), (e) => {
          data.push([
            bidx,
            getTitleAttr(bucket, e),
            buildTooltip(bucket, e),
            new Date(e.timestamp),
            new Date(moment(e.timestamp).add(e.duration, 'seconds')),
            getColorFromString(getTitleAttr(bucket, e)),
          ]);
        })
      })
      return data;
    },
  },
}
</script>
