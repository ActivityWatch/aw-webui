<template lang="pug">
div(style="overflow-x: scroll;", v-if="datasets !== null")
  apexchart(type="heatmap", :options="options", :series="datasets", :width="width")
</template>

<script>
// import _ from 'lodash';
import moment from 'moment';

export default {
  name: 'HeatmapChart',
  props: {
    buckets: { type: Array },
    queriedInterval: { type: Array },
  },
  data: function () {
    return {
      datasets: null,
      options: null,
      width: this.$isAndroid ? 700 : '100%',
    };
  },
  watch: {
    buckets() {
      this.generate();
    },
    queriedInterval() {
      this.generate();
    },
  },
  methods: {
    generate() {
      if (this.buckets.length === undefined) {
        return;
      }

      // Build categories
      const nbSep = 30;
      const queriedInterval = this.queriedInterval
        ? this.queriedInterval
        : [moment().subtract(60 * 60, 'seconds'), moment()];
      const duration =
        moment.duration(queriedInterval[1].diff(queriedInterval[0])).asMinutes() / nbSep;
      const categories = Array.from({ length: nbSep }, (el, i) =>
        queriedInterval[0].clone().add(duration * i, 'minutes')
      );

      // Build data for xaxis
      const datasets = this.buckets
        .filter(b => b.type === 'currentwindow')
        .reduce((cur, bucket) => {
          bucket.events.forEach(e => {
            if (e.duration < 1) {
              return;
            }

            if (!cur[e.data.app]) {
              cur[e.data.app] = Array.from({ length: nbSep }, () => 0);
            }

            const foundIndex = categories.findIndex((c, i) => {
              const timestamp = moment(e.timestamp);

              if (i >= categories.length - 1) {
                return true;
              }

              if (timestamp > c && timestamp < categories[i + 1]) {
                return true;
              }

              return false;
            });

            cur[e.data.app][foundIndex] += e.duration;
          });

          return cur;
        }, {});

      this.options = {
        chart: {
          width: this.width,
          type: 'heatmap',
        },
        stroke: {
          colors: ['#ccc'],
        },
        dataLabels: {
          enabled: false,
        },
        colors: ['#008FFB'],
        toolbar: {
          show: false,
        },
        xaxis: {
          categories: categories.map(c => c.format('HH:mm')),
        },
      };

      this.datasets = Object.entries(datasets).map(([key, value]) => ({ name: key, data: value }));
    },
  },
};
</script>
