<template lang="pug">
div
  div
    | Events: {{ events.length }}
  svg#timespiral
</template>

<script lang="ts">
// This component renders an interactive "timespiral" where each turn of the "loop" is a 24h day.
// The spiral can be zoomed in/out, to display different days.
// Somewhat inspired by Apple's Time Machine UI.
//
// Similar things done with D3 here:
//  - http://bl.ocks.org/larsenmtl/222043d93a41d48b58d2bfa1e3d4f708
//  - https://observablehq.com/@mydu/spiral-arc-chart
//  - https://bl.ocks.org/tomshanley/4080b28445785939b3f043b8c5b63e22

import * as d3 from 'd3';
import { PieArcDatum } from 'd3-shape';
import moment from 'moment';
import { IEvent } from '~/util/interfaces';

export default {
  name: 'Timespiral',
  props: { events: { type: Array, default: () => [] } },
  data() {
    return {};
  },
  computed: {
    events_today() {
      return this.events.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000);
    },
  },
  watch: {
    events() {
      this.renderChart();
    },
  },
  mounted() {
    this.renderChart();
  },
  updated() {
    this.renderChart();
  },
  beforeUpdate() {
    const svg = d3.select('svg');
    svg.selectAll('*').remove();
  },
  methods: {
    renderChart() {
      if (this.events.length == 0) return;

      // Make a deepcopy of events
      const events = JSON.parse(JSON.stringify(this.events)).sort(
        (x, y) => new Date(x.timestamp).valueOf() - new Date(y.timestamp).valueOf()
      );
      console.log('events:', events);

      console.log('Rendering!');

      // Constants
      const height = 500;
      const width = 500;
      const nbSpirals = 2;
      const margin = 10;

      // Init d3
      const svg = d3
        .select('svg#timespiral')
        .style('height', `${height}px`)
        .style('width', `${width}px`);

      const g = svg.append('g').attr('transform', `translate(${width / 2}, ${width / 2})`);

      // The domain is the range of the data.
      // We need to stretch it such that it ranges all the days in events, from start of day to end of day.
      const eventdomain = d3.extent(events.map((e: IEvent) => e.timestamp));
      const domain_start = moment(eventdomain[0]).startOf('day').valueOf();
      const domain_end = moment(eventdomain[1]).endOf('day').valueOf();
      const domain = [domain_start, domain_end];

      //console.log('domain:', domain);

      // TODO: Compute range from events
      const xScale = d3
        .scaleLinear()
        .domain(domain)
        .range([0, 2 * Math.PI * nbSpirals]);

      const yScale = d3
        .scaleLinear()
        .domain(domain)
        .range([(width - margin) / 2 - 30 * nbSpirals, (width - margin * 2) / 2]);

      events.forEach((d, i) => {
        d.startAngle = xScale(new Date(d.timestamp));
        d.endAngle = xScale(new Date(d.timestamp).valueOf() + 1000 * d.duration);
        //console.log('angles:', d.startAngle, d.endAngle);
      });

      const arcGen = d3
        .arc<PieArcDatum<number>>()
        .innerRadius(d => {
          return yScale(moment(events[d.data].timestamp).valueOf()) - 10;
        })
        .outerRadius(d => yScale(moment(events[d.data].timestamp).valueOf()) + 10)
        //.startAngle(0)
        //.endAngle(1.5 * Math.PI)
        .cornerRadius(1);

      events.forEach((d: IEvent & { index: number; startAngle: number; endAngle: number }, i) => {
        console.log(i, d);
        const gradientArcs = d3
          .pie<number>()
          .sort(null)
          .startAngle(d.startAngle)
          .endAngle(d.endAngle)
          .value(i => {
            return moment(events[i].timestamp).valueOf();
          })([i])
          .map(item => ({ ...item, index: i + item.index }));
        console.log('gradientArcs', gradientArcs);

        // TODO: Colors should come from events (retrievable by query), not generated here

        const group = g
          .append('g')
          .selectAll('path')
          .data(gradientArcs)
          .join('path')
          .attr('d', arcGen as any)
          .attr('stroke', '#55f')
          .attr('fill', d.data.status == 'not-afk' ? '#0f0' : '#f00')
          .attr('opacity', 0.5);
      });

      // draw a colored spiral arc segment for the current day
      /*
        const spiral = svg
        .append('g')
        .attr('class', 'spiral')
        .attr('transform', `translate(${width / 2}, ${height / 2})`)
        .data(events)
        .append('path')
        .attr('d', arcGen)
        .style('fill', '#f00')
        .style('stroke', '#000');
        */

      console.log('Rendered!');
    },
  },
};
</script>
