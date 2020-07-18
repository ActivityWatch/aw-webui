'use strict';

const d3 = require('d3');
const Color = require('color');
const _ = require('lodash');
const moment = require('moment');

import { getTitleAttr, getColorFromString } from '../util/color.js';

const time = require('../util/time.js');

function create(svg_el) {
  // Clear element
  svg_el.innerHTML = '';

  // svg for the colored timeline
  d3.select(svg_el).attr('viewBox', '0 0 100 4').attr('width', '100%');
}

function set_status(svg_el, text) {
  const timeline = d3.select(svg_el);
  timeline.selectAll('*').remove();

  timeline
    .append('text')
    .attr('x', '0')
    .attr('y', '3')
    .text(text)
    .attr('font-family', 'sans-serif')
    .attr('font-size', '2')
    .attr('fill', 'black');
}

function update(svg_el, events, event_type) {
  const timeline = d3.select(svg_el);
  timeline.selectAll('*').remove();

  if (events.length <= 0) {
    set_status(svg_el, 'No data');
    return;
  }

  events = _.clone(events);
  _.reverse(events);
  const e_first = _.first(events);
  const e_last = _.last(events);
  const m_first = moment(e_first.timestamp);
  const m_last = moment(e_last.timestamp);
  const total_duration = (m_last - m_first) / 1000 + e_last.duration;
  console.log('First: ' + m_first.format());
  console.log('Last: ' + m_last.format());
  console.log('Duration: ' + total_duration);

  // Iterate over each event and create interval boxes
  _.each(events, function (e, i) {
    const id = 'timeline_event_' + i;
    const timestamp = moment(e.timestamp);

    const color_base = getColorFromString(getTitleAttr({ type: event_type }, e));
    const color_hover = Color(color_base).darken(0.4).hex();

    const x = (timestamp - m_first) / 1000 / total_duration;
    const width = (100 * e.duration) / total_duration;

    const eg = timeline
      .append('g')
      .attr('id', id)
      .attr('transform', 'translate(' + 100 * x + ',' + 0 + ')');

    const rect = eg
      .append('rect')
      .attr('width', width)
      .attr('height', 4)
      .style('fill', color_base)
      .on('mouseover', function (d, j, n) {
        const elem = n[j];
        elem.style.fill = color_hover;
      })
      .on('mouseout', function (d, j, n) {
        const elem = n[j];
        elem.style.fill = color_base;
      });

    rect
      .append('title')
      .text(
        timestamp.format() +
          '\n' +
          'Duration: ' +
          time.seconds_to_duration(e.duration) +
          '\n' +
          JSON.stringify(e.data)
      );

    if (e.duration > 0.05 * total_duration) {
      eg.append('text')
        .attr('font-size', 2)
        .attr('x', 1)
        .attr('y', 2.5)
        .attr('pointer-events', 'none')
        .text(getTitleAttr({ type: event_type }, e));
    }
  });

  return svg_el;
}

export default {
  create: create,
  update: update,
};
