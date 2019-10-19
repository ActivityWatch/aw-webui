<template lang="pug">
div
  GChart(type="Timeline" :data="dataAndColors[0]" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>
import moment from 'moment';
import _ from 'lodash';
import {buildTooltip} from '../util/tooltip.js'
import {getColorFromString, getTitleAttr} from '../util/color.js'

import Vue from 'vue';
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
    dataAndColors() {
      const colors = [];
      const data = [
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
          const color = getColorFromString(getTitleAttr(bucket, event));
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
