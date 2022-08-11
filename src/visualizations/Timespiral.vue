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

function split_events_on_hours(events: IEvent[]): IEvent[] {
  // Takes a list of events, finds events that crosses hour-boundaries (e.g. 01:00, or 23:00)
  // and splits them into two (or more) events, one plus one per hour boundary crossed.
  //
  // Returns a list of events, with the original events intact, and the new events added.

  // Deepcopy
  events = JSON.parse(JSON.stringify(events));

  // First we need to find them, and filter them away from the other events.
  const crossing_events = events.filter(e => {
    // Does the event cross an hour mark?
    const start = moment(e.timestamp);
    const end = moment(e.timestamp).add(e.duration, 'seconds');
    return !start.isSame(end, 'hour');
  });

  const split_events = crossing_events
    .map(e => {
      // Split the event into at least two events, one more for each additional hour boundary crossed.
      const start = moment(e.timestamp);
      const end = moment(e.timestamp).add(e.duration, 'seconds');

      // We handle the start and end bits first, as they are not whole hours.
      const new_events: IEvent[] = [
        // First split event just needs to end at the end of the start hour.
        {
          ...e,
          duration: moment(start).startOf('hour').add(1, 'hour').diff(start, 'seconds'),
        },
        // Last split event just needs to start at the beginning of the end hour.
        {
          ...e,
          timestamp: moment(end).startOf('hour').format(),
          duration: moment(end).diff(end.startOf('hour'), 'seconds'),
        },
      ];

      // Now we handle the middle bits.
      for (
        let ts = start.startOf('hour').add(1, 'hour');
        ts < end.startOf('hour');
        ts.add(1, 'hour')
      ) {
        const new_e = {
          ...e,
          timestamp: ts.format(),
          duration: 60 * 60,
        };
        new_events.push(new_e);
      }

      return new_events;
    })
    .reduce((a, b) => a.concat(b), []); // flatten

  // Return the sorted list of: original events, without the crossing events, and with the new split events added.
  return (
    events
      .filter(e => !crossing_events.includes(e))
      .concat(split_events)
      // TypeScript won't let me sort this with -, for some reason
      .sort((a, b) => {
        const a_start = moment(a.timestamp);
        const b_start = moment(b.timestamp);
        return a_start.diff(b_start);
      })
      .reverse()
  );
}

export default {
  name: 'Timespiral',
  props: { events: { type: Array, default: () => [] } },
  data() {
    return {};
  },
  computed: {
    split_on_hour() {
      if (this.events && this.events.length > 0) {
        return split_events_on_hours(this.events);
      } else {
        return [];
      }
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

      // Gets a deepcopy of events
      const events = this.split_on_hour;

      // Constants
      const height = 500;
      const width = 500;
      const margin = 20;
      const thickness = 20;

      // Init d3
      const svg = d3
        .select('svg#timespiral')
        .style('height', `${height}px`)
        .style('width', `${width}px`);

      const g = svg.append('g').attr('transform', `translate(${width / 2}, ${width / 2})`);

      // The domain is the range of the data.
      // We need to stretch it such that it ranges all the days in events, from start of day to end of day.
      const eventdomain = d3.extent(events.map((e: IEvent) => e.timestamp));
      const domain_start = moment(eventdomain[0]).startOf('day');
      const domain_end = moment(eventdomain[1]).endOf('day');
      const domain = [domain_start, domain_end];
      const nbSpirals = Math.ceil(
        (domain_end.valueOf() - domain_start.valueOf()) / (24 * 60 * 60 * 1000)
      );

      // To generate a spiral, we need two scales. One for the angle, and one for the radius.

      // The angle
      const xScale = d3
        .scaleTime()
        .domain(domain)
        .range([0, 2 * Math.PI * nbSpirals]);

      // The radius
      const yScale = d3
        .scaleTime()
        .domain(domain)
        .range([(width - margin) / 2 - 30 * nbSpirals, (width - margin * 2) / 2]);

      // We want to add some spacing at hour-boundaries,
      // to do this we compress the startAngle and endAngle of each hour-segment, around the hour-center, by 1%.
      events.forEach(d => {
        d.startAngle = xScale(new Date(d.timestamp));
        d.endAngle = xScale(new Date(d.timestamp).valueOf() + 1000 * d.duration);

        // Compress the angles around the hour-center.
        const gap = 0.04;
        const hour = moment(d.timestamp).startOf('hour');

        // This kinda works? But also kinda breaks as it seems to lead to overlap
        // FIXME: Get rid of overlap bug
        d.startAngle += (d.startAngle - xScale(hour)) * gap;
        d.endAngle -= (d.endAngle - xScale(hour)) * gap;
      });

      // It seems very difficult to make proper smooth spiral arcs with D3.
      // Instead, we can split events on hour marks and leave a gap (helpful for readability).
      // Events within the same hour share the same radius/y, to give it the appearance of hour-segments.

      // Events have been split by `split_on_hour` above.

      const arcGen = d3
        .arc<PieArcDatum<number>>()
        // Compute the radius of each event, rounded to the hour in which the event occurs.
        .innerRadius(d => {
          return yScale(moment(events[d.data].timestamp).startOf('hour').valueOf()) - thickness / 2;
        })
        .outerRadius(
          d => yScale(moment(events[d.data].timestamp).endOf('hour').valueOf()) + thickness / 2
        )
        // Makes corners round and pretty
        .cornerRadius(3);

      events.forEach((d: IEvent & { index: number; startAngle: number; endAngle: number }, i) => {
        //console.log(i, d);
        const gradientArcs = d3
          .pie<number>()
          .sort(null)
          .startAngle(d.startAngle)
          .endAngle(d.endAngle)
          .value(idx => {
            return moment(events[idx].timestamp).valueOf();
          })([i])
          .map(item => ({ ...item, index: i + item.index }));

        // Append the arc
        // TODO: Rotate arcs slightly so that arc ends are facing each other (is this even possible)
        g.append('g')
          .selectAll('path')
          .data(gradientArcs)
          .join('path')
          .attr('d', arcGen as any)
          .attr('stroke', 'none')
          // TODO: Colors should come from events (retrievable by query), not hardcoded
          .attr('fill', d.data.status == 'not-afk' ? '#0f0' : '#f00')
          .attr('opacity', 0.5);
      });
    },
  },
};
</script>
