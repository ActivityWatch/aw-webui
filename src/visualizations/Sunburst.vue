<template lang="pug">
div#root
  div#main
    div#sequence
    div#chart
      div#explanation(style="visibility: hidden")
        span#percentage
        br
        | of visits begin with this sequence of pages

  div#sidebar
    input(type="checkbox", id="togglelegend")
    | Legend
    br
    div#legend(style="visibility: hidden")
</template>

<style scoped lang="scss">
#root {
  font-family: 'Open Sans', sans-serif;
  font-size: 12px;
  font-weight: 400;
  width: 960px;
  height: 700px;
  margin-top: 10px;

  #main {
    float: left;
    width: 750px;
  }

  #sidebar {
    float: right;
    width: 100px;
  }

  #sequence {
    width: 600px;
    height: 70px;
  }

  #legend {
    padding: 10px 0 0 3px;
  }

  #sequence text, #legend text {
    font-weight: 600;
    fill: #fff;
  }

  #chart {
    position: relative;
  }

  #chart path {
    stroke: #fff;
  }

  #explanation {
    position: absolute;
    top: 260px;
    left: 305px;
    width: 140px;
    text-align: center;
    color: #666;
    z-index: 10; // might not be needed
  }

  #percentage {
    font-size: 2.5em;
  }
}
</style>

<script>
// NOTE: This is just a Vue.js component wrapper for timeline-simple.js
//       Code should generally go in the framework-independent file.

// TODO: Sunburst requires a hierarchical data format

import sunburst from './sunburst.js';
import coloring_types from './coloring.js';

let aw_sunburst = {
  name: "aw-sunburst",
  props: ['hierarchy'],
  mounted: function() {
    sunburst.create(this.$el);
  },
  watch: {
    "hierarchy": function() {
      sunburst.update(this.$el, this.hierarchy);
    }
  }
}

export default aw_sunburst;
</script>
