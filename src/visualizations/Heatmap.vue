<template lang="pug">
<div>
  <apexchart type="heatmap" :options="options" :series="datasets" width="500" height="350"></apexchart>
</div>
</template>

<script>
export default {
  name: 'HeatmapChart',
  props: {
    categories: { type: Array },
    datasets: { type: Array },
  },
  data: function() {
    return {
      options: {
        chart: {
          width: 500,
          height: 350,
          type: 'heatmap',
        },
        dataLabels: {
          enabled: false
        },
        colors: ["#008FFB"],
        toolbar: {
          show: false,
        },
        xaxis: {
          categories: this.categories,
        }
      },
    }
  },
}
</script>
