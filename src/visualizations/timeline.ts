/*
 * Creates a colored timeline where you can hover for more info.
 */

import * as d3 from 'd3';
import Color from 'color';
import _ from 'lodash';
import moment from 'moment';

import { getColorFromString } from '../util/color';
import { seconds_to_duration } from '../util/time';
import { IEvent } from '../util/interfaces';

function show_info(container: HTMLElement, elem_id: string): void {
  const title_event_box = container.querySelector('#' + elem_id) as HTMLElement;
  const titleinfo = container.querySelector('.titleinfo-container') as HTMLElement;
  titleinfo.innerHTML = title_event_box.innerHTML;
  titleinfo.style.height = title_event_box.getAttribute('height') || '';
}

function create(container: HTMLElement): void {
  // Clear element
  container.innerHTML = '';

  // svg for the colored timeline
  d3.select(container)
    .append('svg')
    .attr('class', 'apptimeline')
    .attr('viewBox', '0 0 100 10')
    .attr('width', '100%');

  // Hidden svg image that stores all titleinfo for each timeperiod
  d3.select(container).append('div').attr('class', 'titleinfo-list').style('display', 'none');

  // Container for titleinfo that has a fixed size and a overflow scroll
  const titleinfo_container = document.createElement('div');
  titleinfo_container.style.width = '100%';
  titleinfo_container.style.height = '200px';
  titleinfo_container.style.overflowY = 'scroll';
  container.appendChild(titleinfo_container);

  // Titleinfo box that changes content depending on what was timeperiod was last recently hovered on
  d3.select(titleinfo_container)
    .append('div')
    .style('width', '100%')
    .attr('class', 'titleinfo-container');
}

function set_status(container: HTMLElement, text: string): void {
  const timeline_elem = container.querySelector('.apptimeline') as HTMLElement;
  const titleinfo_list_elem = container.querySelector('.titleinfo-list') as HTMLElement;
  const titleinfo_container_elem = container.querySelector('.titleinfo-container') as HTMLElement;

  const timeline = d3.select(timeline_elem);
  timeline_elem.innerHTML = '';
  titleinfo_list_elem.innerHTML = '';
  titleinfo_container_elem.innerHTML = '';

  timeline
    .append('text')
    .attr('x', '0')
    .attr('y', '3')
    .text(text)
    .attr('font-family', 'sans-serif')
    .attr('font-size', '3')
    .attr('fill', 'black');
}

function update(
  container: HTMLElement,
  events: IEvent[],
  showAFK: boolean,
  chunkfunc: (event: IEvent) => string,
  eventfunc: (subevent: IEvent) => string
): HTMLElement {
  const timeline = d3.select(container.querySelector('.apptimeline')).html(null);
  const titleinfo_list = d3.select(container.querySelector('.titleinfo-list')).html(null);
  d3.select(container.querySelector('.titleinfo-container')).html(null);

  if (events.length <= 0) {
    set_status(container, 'No data');
    return container;
  }

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  const timeStart = moment(firstEvent.timestamp);
  const timeEnd = moment(lastEvent.timestamp).add(lastEvent.duration, 'seconds');
  const totalDuration = _.sumBy(events, 'duration');

  const secSinceStart = timeEnd.diff(timeStart, 'seconds', true);

  // Iterate over each app timeperiod
  let curr_x = 0;
  _.each(events, function (e, i) {
    // Timeline rect

    let eventX: string | number, eventWidth: number;
    if (showAFK) {
      const eventBegin = moment(e.timestamp);
      eventX = eventBegin.diff(timeStart, 'seconds', true) / secSinceStart;
      eventX = eventX * 100 + '%';
      eventWidth = (e.duration / secSinceStart) * 100;
    } else {
      eventX = curr_x;
      eventWidth = (e.duration / totalDuration) * 100;
    }

    const appcolor = getColorFromString(chunkfunc(e));
    const hovercolor = Color(appcolor).darken(0.4).hex();

    const eg = timeline.append('g').attr('id', 'timeline_event_' + i);

    const rect = eg
      .append('rect')
      .attr('x', eventX)
      .attr('y', 0)
      .attr('width', eventWidth + '%')
      .attr('height', 10)
      .style('fill', appcolor)
      .on('mouseover', () => {
        rect.style('fill', hovercolor);
        show_info(container, 'titleinfo_event_' + i);
      })
      .on('mouseout', () => {
        rect.style('fill', appcolor);
      });

    // Titleinfo box
    const infobox = titleinfo_list
      .append('div')
      .attr('id', 'titleinfo_event_' + i)
      .style('display', 'none');

    // Appname and duration text
    infobox
      .append('h5')
      .attr('x', '10px')
      .attr('y', '20px')
      .text(chunkfunc(e) + ' (' + seconds_to_duration(e.duration) + ')')
      .attr('font-family', 'sans-serif')
      .attr('font-size', '20px')
      .attr('fill', 'black');

    // Titleinfo
    const infolist = infobox.append('table');
    _.each(e.data.subevents, function (t: IEvent) {
      const inforow = infolist.append('tr');
      // Clocktime
      const clocktime = moment(t.timestamp).format('HH:mm:ss');
      inforow.append('td').text(clocktime);
      // Duration
      const duration = seconds_to_duration(t.duration);
      inforow.append('td').text(duration).style('padding-left', '1em').style('text-align', 'right');
      // Title
      inforow.append('td').text(eventfunc(t)).style('padding-left', '1em');
    });

    curr_x += eventWidth;
  });

  return container;
}

export default {
  create,
  update,
  set_status,
};
