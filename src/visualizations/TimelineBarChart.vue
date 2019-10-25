<script lang="ts">
import _ from 'lodash';
import Vue from 'vue';
import { Bar } from 'vue-chartjs';
import { Component, Prop, Watch } from 'vue-property-decorator';

@Component({
    extends: Bar, // this is important to add the functionality to your component
})
export default class ChartTimelineBars extends Vue<Bar> {
  @Prop({default: [{
    label: 'Total time',
    backgroundColor: '#6699ff',
    data: Array.from({length: 40}, () => Math.floor(Math.random() * 40)),
  }]})
  datasets: Record<string, any>[];

  mounted () {
    this.renderData();
  }

  @Watch('datasets')
  onDatasetChange() {
    this.renderData();
  }

  renderData() {
    // Overwriting base render method with actual data.
    this.renderChart({
      labels: _.range(0, 24).map(h => `${h}`),
      datasets: this.datasets,
      title: {
        display: true,
        text: 'Timeline'
      },
      tooltips: {
        mode: 'index',
        intersect: false
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: [{ stacked: true }],
      }
    });
  }
}
</script>

<style>
</style>
