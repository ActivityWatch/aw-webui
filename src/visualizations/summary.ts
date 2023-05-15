'use strict';

import * as d3 from 'd3';
import Color from 'color';
import _ from 'lodash';

import { getCategoryColorFromString } from '~/util/color';
import { seconds_to_duration } from '~/util/time';
import { IEvent } from '~/util/interfaces';

const textColor = '#333';

function create(container: HTMLElement) {
  // Clear element
  container.innerHTML = '';

  // Create svg canvas
  const svg = d3.select(container).append('svg');
  svg.attr('width', '100%').attr('height', '100px').attr('class', 'appsummary');
}

function set_status(container: HTMLElement, msg: string) {
  // Select svg canvas
  const svg_elem = container.querySelector('.appsummary');
  const svg = d3.select(svg_elem);
  svg_elem.innerHTML = '';

  svg
    .append('text')
    .attr('x', '0px')
    .attr('y', '25px')
    .text(msg)
    .attr('font-family', 'sans-serif')
    .attr('font-size', '20px')
    .attr('fill', '#999');
}

interface Entry {
  name: string;
  hovertext: string;
  duration: number;
  color?: string;
  colorKey?: string;
  link?: string;
}

function update(container: HTMLElement, apps: Entry[]) {
  // No apps, sets status to "No data"
  if (apps.length <= 0) {
    set_status(container, 'No data');
    return container;
  }

  const svg_elem = container.querySelector('.appsummary');
  svg_elem.innerHTML = '';
  const svg = d3.select(svg_elem);

  // Remove apps without a duration from list
  apps = apps.filter(function (app) {
    return app.duration !== undefined;
  });

  let curr_y = 0;
  const longest_duration = apps[0].duration;
  _.each(apps, function (app, i) {
    // TODO: Expand on click and list titles

    // Variables
    const width = (app.duration / longest_duration) * 100 + '%';
    const barHeight = 46;
    const textSize = 14;
    const appcolor = app.color || getCategoryColorFromString(app.colorKey || app.name);
    const hovercolor = Color(appcolor).darken(0.1).hex();

    // Add a parent <a> element if link is set
    const a = app.link ? svg.append('a').attr('href', app.link) : svg;

    // The group representing an entry in the barchart
    const eg = a.append('g');
    eg.attr('id', 'summary_' + i)
      .on('mouseover', function () {
        eg.select('rect').style('fill', hovercolor);
      })
      .on('mouseout', function () {
        eg.select('rect').style('fill', appcolor);
      });

    eg.append('title').text(app.hovertext + '\n' + seconds_to_duration(app.duration));

    // Color box background
    eg.append('rect')
      .attr('x', 0)
      .attr('y', curr_y)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('width', width)
      .attr('height', barHeight)
      .style('fill', appcolor);

    // App name
    eg.append('text')
      .attr('x', 5)
      .attr('y', curr_y + 1.4 * textSize)
      .text(app.name)
      .attr('font-family', 'sans-serif')
      .attr('font-size', textSize + 'px')
      .attr('fill', textColor);

    // Duration
    eg.append('text')
      .attr('x', 5)
      .attr('y', curr_y + 2.6 * textSize)
      .text(seconds_to_duration(app.duration))
      .attr('font-family', 'sans-serif')
      .attr('font-size', textSize - 3 + 'px')
      .attr('fill', '#444');

    curr_y += barHeight + 5;
  });
  curr_y -= 5;

  svg.attr('height', curr_y);

  return container;
}

function updateSummedEvents(
  container: HTMLElement,
  summedEvents: IEvent[],
  titleKeyFunc: (event: IEvent) => string,
  hoverKeyFunc: (event: IEvent) => string,
  colorKeyFunc: (event: IEvent) => string,
  linkKeyFunc: (event: IEvent) => string = () => null
) {
  if (hoverKeyFunc == null) {
    hoverKeyFunc = titleKeyFunc;
  }
  const apps = _.map(summedEvents, e => {
    return {
      name: titleKeyFunc(e),
      hovertext: hoverKeyFunc(e),
      duration: e.duration,
      color: e.data['$color'],
      colorKey: colorKeyFunc(e),
      link: linkKeyFunc(e),
    } as Entry;
  });
  update(container, apps);
}

export default {
  create: create,
  update: update,
  updateSummedEvents: updateSummedEvents,
  set_status: set_status,
};
