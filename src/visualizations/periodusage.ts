import * as d3 from 'd3';
import _ from 'lodash';
import moment from 'moment';

import { seconds_to_duration, get_hour_offset } from '../util/time.ts';

function create(svg_elem: SVGElement) {
  // Clear element
  svg_elem.innerHTML = '';
}

function set_status(svg_elem: SVGElement, msg: string) {
  // Select svg canvas
  svg_elem.innerHTML = '';
  const svg = d3.select(svg_elem);

  svg
    .append('text')
    .attr('x', '50%')
    .attr('y', '25pt')
    .text(msg)
    .attr('font-family', 'sans-serif')
    .attr('font-size', '20pt')
    .attr('text-anchor', 'middle')
    .attr('fill', '#AAA');
}

const diagramcolor = '#aaa';
const diagramcolor_selected = '#fc5';
const diagramcolor_focused = '#adf';

function update(svg_elem: SVGElement, usage_arr, onPeriodClicked) {
  const dateformat = 'YYYY-MM-DD';

  // No apps, sets status to "No data"
  if (usage_arr.length <= 0) {
    set_status(svg_elem, 'No data');
    return;
  }
  svg_elem.innerHTML = '';
  const svg = d3.select(svg_elem);

  function get_usage_time(day_events) {
    const day_event = _.head(_.filter(day_events, e => e.data.status == 'not-afk'));
    return day_event != undefined ? day_event.duration : 0;
  }

  const usage_times = usage_arr.map(day_events => get_usage_time(day_events));
  let longest_usage = Math.max.apply(null, usage_times);
  // Avoid division by zero
  if (longest_usage <= 0) {
    longest_usage = 0.00000000001;
  }

  const padding = 0.3 * (100 / (usage_arr.length - 1));
  const width = 100 / usage_arr.length - padding;
  const center_elem = Math.floor(usage_arr.length / 2);

  _.each(usage_arr, (events, i: number) => {
    const usage_time = get_usage_time(events);
    const height = 85 * (usage_time / longest_usage);
    let date = '';
    if (events.length > 0) {
      // slice off so it's only the day
      date = moment(events[0].timestamp).subtract(get_hour_offset(), 'hours').format(dateformat);
    }
    const color = i === center_elem ? diagramcolor_selected : diagramcolor;
    const offset = 50;

    const x = i * padding + i * width + 0.25 * width;

    // FIXME: Doesn't work well, notably breaks on last7d and last30d
    if (moment(date).isSame(moment(), 'day')) {
      svg
        .append('line')
        .attr('x1', x + width / 2 + '%')
        .attr('y1', 0)
        .attr('x2', x + width / 2 + '%')
        .attr('y2', 200)
        .attr('style', 'stroke: #888; stroke-width: 2px;')
        .attr('stroke-dasharray', '4, 2');

      svg
        .append('text')
        .attr('x', x + 1.5 * width + '%')
        .attr('y', '30')
        .text('Today');
    }

    const rect = svg
      .append('rect')
      .attr('x', x + '%')
      .attr('y', 101 - height + '%') // Draw rect bottom-up
      .attr('rx', 3)
      .attr('ry', 3)
      .attr(
        'style',
        i === center_elem ? 'stroke: black; stroke-width: 1;' : 'stroke: #222; stroke-width: 1;'
      )
      .attr('width', width + '%')
      .attr('height', height + offset + '%')
      .attr('color', color)
      .attr('date', date)
      .style('fill', color)
      .on('mouseover', () => {
        rect.style('fill', diagramcolor_focused);
      })
      .on('mouseout', e => {
        rect.style('fill', e.target.attributes.color.value);
      })
      .on('click', function () {
        onPeriodClicked(date);
      });
    rect.append('title').text(date + '\n' + seconds_to_duration(usage_time));
  });
}

export default {
  create: create,
  update: update,
  set_status: set_status,
};
