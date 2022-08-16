<template lang="pug">
div
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
      let events = this.split_on_hour;

      // Constants
      const height = 600;
      const width = 600;
      const margin = 60;
      const max_days = 5; // the maximum number of days to show
      const thickness = 250 / max_days; // thickness of spiral arms
      const spacing = 20; // spacing between spiral arms
      const min_radius = thickness + spacing + 20;

      // Init d3
      const svg = d3
        .select('svg#timespiral')
        .style('height', `${height}px`)
        .style('width', `${width}px`);

      const g = svg.append('g').attr('transform', `translate(${width / 2}, ${width / 2})`);

      // The domain is the range of the data.
      // We need to stretch it such that it ranges all the days in events, from start of day to end of day.
      const eventdomain = d3.extent(events.map((e: IEvent) => e.timestamp));

      const _domain_start = moment(eventdomain[0]).startOf('day');
      const _domain_end = moment(eventdomain[1]).endOf('day');

      // Limit the events to max_days
      let domain;
      if (_domain_end.clone().diff(_domain_start) / 1000 > max_days) {
        domain = [_domain_end.clone().subtract(max_days, 'days'), _domain_end];
      } else {
        domain = [_domain_start, _domain_end];
      }
      const nbSpirals = Math.ceil(
        (domain[1].valueOf() - domain[0].valueOf()) / (24 * 60 * 60 * 1000)
      );

      events = events.filter(e => moment(e.timestamp).isAfter(domain[0]));

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
        .range([
          min_radius + (width - margin) / 2 - (thickness + spacing) * nbSpirals,
          (width - margin * 2) / 2,
        ]);

      const thickScale = d3
        .scalePow()
        .exponent(2)
        .domain(domain)
        .range([thickness / (max_days - 1), thickness]);

      // We want to add some spacing at hour-boundaries,
      // to do this we compress the startAngle and endAngle of each hour-segment, around the hour-center, by 1%.
      events.forEach(d => {
        d.startAngle = xScale(new Date(d.timestamp));
        d.endAngle = xScale(new Date(d.timestamp).valueOf() + 1000 * d.duration);

        // Compress the angles around the hour-center.
        const gap = 0.05;
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

      // Computes the radius and spiral thickness for a particular event.
      // Each inner spiral (previous day) should get progressively thinner.
      function spiralThickness(timestamp: string, staggered: boolean): [number, number] {
        const hourstart = staggered
          ? moment(timestamp).startOf('hour').valueOf()
          : moment(timestamp).valueOf();
        return [yScale(hourstart), thickScale(hourstart)]; // the radius and thickness of the spiral at timestamp
      }

      const arcGen = d3
        .arc<PieArcDatum<number>>()
        // Compute the radius of each event, rounded to the hour in which the event occurs.
        .innerRadius(d => {
          const [radius, thick] = spiralThickness(events[d.data].timestamp, true);
          return radius - thick / 2;
        })
        .outerRadius(d => {
          const [radius, thick] = spiralThickness(events[d.data].timestamp, true);
          return radius + thick / 2;
        })
        // Makes corners round and pretty
        .cornerRadius(2);

      events.forEach((e: IEvent & { startAngle: number; endAngle: number }, i) => {
        // TODO: Draw as polygon-segments instead?
        // Would give us control of start/end points so we can make them align prettily.
        const gradientArcs = d3
          .pie<number>()
          .sort(null)
          .startAngle(e.startAngle)
          .endAngle(e.endAngle)
          .value(moment(e.timestamp).valueOf())([i]);

        // Can be used to draw a dot
        /*
        const hourstart = moment(e.timestamp).startOf('hour').add(30, 'minutes').valueOf();
        const a = xScale(hourstart);
        const r = yScale(hourstart);
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);

        g.selectAll('circle')
          .data([[x, y]])
          .enter()
          .append('circle')
          .attr('cx', d => d[0])
          .attr('cy', d => d[1])
          .attr('r', '8px')
          .attr('fill', 'red');
        */

        // Append the arc
        // TODO: Rotate arcs slightly so that arc ends are facing each other (is this even possible)
        g.append('g')
          .selectAll('path')
          .data(gradientArcs)
          .join('path')
          .attr('d', arcGen as any)
          .attr('stroke', 'none')
          // NOTE: Attempted rotation around a pivot point, doesn't work
          //.attr('transform', `rotate(-5 ${x} ${y})`)
          // TODO: Colors should come from events (retrievable by query), not hardcoded
          .attr('fill', e.data.status == 'not-afk' ? '#0d0' : '#ccc')
          .attr('opacity', 0.7);
      });

      const labelColor = '#888';
      const tickColor = '#ccc';

      // Draw clock ticks
      // Modified from sunburst-clock.js
      function drawClockTick(group, a, radius, inner: boolean) {
        const xn = Math.cos(a);
        const yn = Math.sin(a);

        // TODO: Use radius for the last event as a starting point,
        //       not the radius as if the day was full of events.
        //       Maybe even have the max radius be radius of the last event,
        //       with radius matching the last event for a certain time.
        group
          .append('line')
          .attr('x1', (radius - 5) * xn)
          .attr('y1', (radius - 5) * yn)
          .attr('x2', (radius + 5) * xn)
          .attr('y2', (radius + 5) * yn)
          .style('stroke', tickColor)
          .style('stroke-width', 2);

        if (inner)
          group
            .append('line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', (radius - 5) * xn)
            .attr('y2', (radius - 5) * yn)
            .style('stroke', '#fff')
            .style('stroke-width', 2);
      }

      function drawClock(group, h, m, text, radius, inner: boolean) {
        const a = 2 * Math.PI * (h / 24 + m / 24 / 60) - (1 / 2) * Math.PI;
        drawClockTick(g, a, radius, inner);

        const xn = Math.cos(a);
        const yn = Math.sin(a);

        group
          .append('text')
          .text(text || moment({ hours: h }).format('HH:mm'))
          // Fall back to middle,
          // but should be right for 18:00 and left for 06:00.
          .attr('text-anchor', h == 6 ? 'start' : h == 18 ? 'end' : 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '1em')
          //.attr("font-weight", "bold")
          .style('fill', labelColor)
          .attr('x', (radius + 10) * xn)
          .attr('y', (radius + 20) * yn);
      }

      const max_radius = yScale(domain[1]);
      drawClock(g, 0, 0, '00:00', max_radius, true);
      drawClock(g, 3, 0, '', max_radius);
      drawClock(g, 6, 0, '06:00', max_radius, true);
      drawClock(g, 9, 0, '', max_radius);
      drawClock(g, 12, 0, '12:00', max_radius, true);
      drawClock(g, 15, 0, '', max_radius);
      drawClock(g, 18, 0, '18:00', max_radius, true);
      drawClock(g, 21, 0, '', max_radius);

      const now = moment();
      drawClock(g, now.hour(), now.minute(), 'Now', max_radius);

      // Draw date labels
      // We want to draw date-labels at the start of the spiral for each day (at 00:00)

      function drawDate(group, date) {
        const radius = yScale(moment(date).add(8, 'hours'));
        const radius_next_quad = yScale(moment(date).add(14, 'hours'));
        const radius_diff = (radius_next_quad - radius) / 4;
        const m = moment(date).startOf('day');

        const pathid = `wavy${date.valueOf()}`;
        const path = `M 2,-${radius} A ${radius + radius_diff},${
          radius + radius_diff
        } 0 0 1 ${radius_next_quad},0`;

        group
          .append('path')
          .attr('id', pathid) //Unique id of the path
          .attr('d', path) //SVG path
          //.attr('d', 'M 0,-100 A 100,100 0 0 1 110,0') //SVG path
          .style('fill', 'none')
          .style('stroke', '#AAAAAA')
          .style('stroke-width', 0);

        group
          .append('text')
          .append('textPath')
          .text(m.format('Y-M-D'))
          .attr('xlink:href', `#${pathid}`)
          .attr('text-anchor', 'left')
          //.attr('dominant-baseline', 'middle')
          .attr('font-size', `${1 * Math.max(thickScale(m) / thickness, 0.5)}em`)
          //.attr('text-decoration', 'underline');
          .style('fill', '#555');
      }

      const date_labels = d3.timeDays(...domain);
      date_labels.forEach(d => drawDate(g, d));

      // From: https://stackoverflow.com/a/49097025/965332
      // Might serve as a base for later improvements
      function makeSpiral(group, quarterTurns) {
        const pointsPerQuarter = 90;
        const points = [];

        for (let i = 0; i < quarterTurns * pointsPerQuarter; i++) {
          const angle = (i * Math.PI) / 2 / pointsPerQuarter;
          const timestamp = xScale.invert(angle);
          const [radius, _thickness] = spiralThickness(timestamp);
          const line_margin = _thickness / 4;
          points.push((radius - line_margin) * Math.cos(angle));
          points.push((radius - line_margin) * Math.sin(angle));
        }
        group
          .append('polyline')
          .attr('points', points.join(' '))
          .attr('stroke', '#ccc')
          .attr('stroke-width', 1)
          .attr('fill', 'none');
      }

      makeSpiral(g, nbSpirals * 4 - 1);
    },
  },
};
</script>
