<script lang="ts">
import _ from 'lodash';
import { ChartOptions } from 'chart.js';
import { Bar } from 'vue-chartjs';
import { Vue, Component, Prop, Watch } from 'vue-property-decorator';
import { get_hour_offset } from '~/util/time';

@Component({
  extends: Bar, // this is important to add the functionality to your component
})
export default class ChartTimelineBars extends Vue<Bar> {
  constructor() {
    super();
  }

  @Prop({
    default: [
      {
        label: 'Total time',
        backgroundColor: '#6699ff',
        data: Array.from({ length: 40 }, () => Math.floor(Math.random() * 40)),
      },
    ],
  })
  datasets: Record<string, any>[];

  @Prop({ default: 'day' })
  resolution: 'day' | 'week' | 'month';

  mounted() {
    this.renderData();
  }

  @Watch('datasets')
  onDatasetChange() {
    this.renderData();
  }

  labels() {
    const hourOffset = get_hour_offset();
    if (this.resolution == 'day') {
      return _.range(0, 24).map(h => `${(h + hourOffset) % 24}`);
    } else if (this.resolution == 'week') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (this.resolution == 'month') {
      // FIXME: Needs access to the timeperiod start to know which month
      const daysInMonth = 31;
      return ['1st', '2nd', '3rd'].concat(_.range(4, daysInMonth + 1).map(d => `${d}th`));
    } else {
      console.error('Invalid resolution');
    }
  }

  yAxes() {
    if (this.resolution == 'day') {
      return [
        {
          stacked: true,
          ticks: {
            stepSize: 0.25,
            min: 0,
            max: 1,
            callback: function (value: number) {
              if (value == 1) {
                return '1h';
              } else {
                return Math.round(value * 60) + 'min';
              }
            },
          },
        },
      ];
    } else {
      return [
        {
          stacked: true,
          ticks: {
            stepSize: 1,
            min: 0,
            callback: function (value: number) {
              if (value == 1) {
                return '1h';
              } else {
                return Math.round(value) + 'h';
              }
            },
          },
        },
      ];
    }
  }

  renderData() {
    // Overwriting base render method with actual data.
    // TODO: Use different x-axis depending on timeperiod
    console.log(this.datasets);
    const data = {
      labels: this.labels(),
      datasets: this.datasets,
      title: {
        display: true,
        text: 'Timeline',
      },
      responsive: true,
      maintainAspectRatio: false,
    };
    const options = {
      skipNull: true,
      tooltips: {
        mode: 'point',
        intersect: false,
      },
      legend: {
        display: false,
      },
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: this.yAxes(),
      },
    } as ChartOptions;
    this.renderChart(data, options);
  }
}
</script>

<style></style>
