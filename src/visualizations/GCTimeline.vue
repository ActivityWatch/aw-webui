<template lang="pug">
div
  GChart(type="Timeline" :data="chartData" :options="chartOptions", :settings="{ packages: ['timeline'] }")
</template>

<script>

import moment from 'moment';

export default {
  props: ['buckets'],
  computed: {
    chartData() {
      console.log(this.buckets);
      let data = [
        [
          {label: 'Bucket', type: 'string'},
          {label: 'Title', type: 'string'},
          {label: 'Start', type: 'date'},
          {label: 'End', type: 'date'},
        ]
      ];
      _.each(this.buckets, (bucket) => {
        console.log("Bucket:");
        console.log(bucket);
        _.each(bucket.events, (event) => {
          data.push([
            bucket.name,
            event.data.title,
            new Date(event.timestamp),
            new Date(moment(event.timestamp).add(event.duration, 'seconds'))
          ]);
        })
      })

      //data = [data[0], data[1]]
      console.log(data);
      return data;
    },
  },
  data () {
    return {
      // Array will be automatically processed with visualization.arrayToDataTable function
      /*chartData: [
        ['Title', 'Start', 'End'],
        ['', 1000, 400],
        ['2015', 1170, 460, 250],
        ['2016', 660, 1120, 300],
        ['2017', 1030, 540, 350]
      ],*/
      chartOptions: {
        chart: {
          title: 'Company Performance',
          subtitle: 'Sales, Expenses, and Profit: 2014-2017',
        }
      }
    }
  }
}
</script>
