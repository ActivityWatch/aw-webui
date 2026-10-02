'use strict';

import * as d3 from 'd3';
import Color from 'color';
import _ from 'lodash';

import { useCategoryStore } from '~/stores/categories';
import { getCategoryColorFromString } from '~/util/color';
import { seconds_to_duration } from '~/util/time';
import { IEvent } from '~/util/interfaces';

const textColor = '#333';
const durationColor = '#444';

// Unique per-chart prefix for clipPath ids (several summaries can share a page).
let chartCounter = 0;

// Label colours for text drawn *over* a bar: pick whichever of dark/light
// contrasts better with the bar itself, so dark bars get light labels and
// light bars get dark labels, in both light and dark theme.
function inBarColors(barColor: string): { name: string; duration: string } {
  const bar = Color(barColor);
  return bar.contrast(Color(textColor)) >= bar.contrast(Color('#fff'))
    ? { name: textColor, duration: textColor }
    : { name: '#fff', duration: '#eee' };
}

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
  colorKey?: string | string[];
  link?: string;
  category?: string;
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

  // Remove apps without a duration or with zero duration from list
  apps = apps.filter(function (app) {
    return app.duration !== undefined && app.duration > 0;
  });
  if (apps.length <= 0) {
    // All apps were zero/undefined duration — nothing to draw.
    set_status(container, 'No data');
    return container;
  }

  const chartId = 'appsummary-' + chartCounter++;
  const defs = svg.append('defs');

  let curr_y = 0;
  const longest_duration = apps[0].duration;
  _.each(apps, function (app, i) {
    // TODO: Expand on click and list titles

    // Variables
    const widthPct = (app.duration / longest_duration) * 100;
    const width = widthPct + '%';
    const barHeight = 46;
    const textSize = 14;

    let appcolor: string;
    if (Array.isArray(app.colorKey)) {
      const categoryStore = useCategoryStore();
      appcolor = categoryStore.get_category_color(app.colorKey);
    } else {
      appcolor = app.color || getCategoryColorFromString(app.colorKey || app.name);
    }

    const hovercolor = Color(appcolor).darken(0.1).hex();

    // Clip-path ids are defined here so the hover handlers can reference them.
    const clipIn = `${chartId}-in-${i}`;
    const clipOut = `${chartId}-out-${i}`;

    // Add a parent <a> element if link is set
    const a = app.link ? svg.append('a').attr('href', app.link) : svg;

    // The group representing an entry in the barchart
    const eg = a.append('g');
    // Re-colour in-bar labels from the bar's *displayed* fill (computed style),
    // so theme overrides (e.g. dark.css !important rules) are honoured. Called
    // in a rAF so the browser has applied the new fill first.
    const recolorInBarLabels = () => {
      window.requestAnimationFrame(() => {
        const barRect = eg.select<SVGRectElement>('rect').node();
        if (!barRect) return;
        const computedFill = window.getComputedStyle(barRect).fill;
        if (!computedFill) return;
        try {
          const colors = inBarColors(Color(computedFill).hex());
          eg.selectAll<SVGTextElement, unknown>(`text[clip-path="url(#${clipIn})"]`).each(function (
            _e,
            j
          ) {
            const sel = d3.select<SVGTextElement, unknown>(this);
            if (j === 0) sel.style('fill', colors.name, 'important');
            if (j === 1) sel.style('fill', colors.duration, 'important');
          });
        } catch {
          // ignore
        }
      });
    };
    eg.attr('id', 'summary_' + i)
      .on('mouseover', function () {
        eg.select('rect').style('fill', hovercolor);
        // Keep in-bar label colours consistent with the *displayed* hover fill:
        // themes may override the hover fill (e.g. dark.css), so derive label
        // colours from the computed style rather than the raw hover color.
        recolorInBarLabels();
      })
      .on('mouseout', function () {
        eg.select('rect').style('fill', appcolor);
        // Same reasoning as mouseover: the restored bar colour may be themed.
        recolorInBarLabels();
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

    // Labels can be longer than a short bar, so each label is drawn twice:
    // once clipped to the bar (coloured for contrast against the bar) and once
    // clipped to the remaining width (default text colour, which dark.css
    // themes for the page background). See ActivityWatch/aw-server-rust#621.
    defs
      .append('clipPath')
      .attr('id', clipIn)
      .append('rect')
      .attr('x', 0)
      .attr('y', curr_y)
      .attr('width', width)
      .attr('height', barHeight);
    defs
      .append('clipPath')
      .attr('id', clipOut)
      .append('rect')
      .attr('x', width)
      .attr('y', curr_y)
      .attr('width', 100 - widthPct + '%')
      .attr('height', barHeight);
    const onBar = inBarColors(appcolor);

    // App name. Truncate long titles so wide window titles don't run
    // visually past their bar; full text remains in the hover tooltip
    // (the <title> appended above) so no information is hidden.
    const maxNameChars = 80;
    const displayName =
      app.name && app.name.length > maxNameChars
        ? app.name.slice(0, maxNameChars - 1) + '…'
        : app.name;
    for (const [clip, inBar] of [
      [clipIn, true],
      [clipOut, false],
    ] as const) {
      const name = eg
        .append('text')
        .attr('x', 5)
        .attr('y', curr_y + 1.4 * textSize)
        .attr('clip-path', `url(#${clip})`)
        .attr('aria-hidden', 'true')
        .text(displayName)
        .attr('font-family', 'sans-serif')
        .attr('font-size', textSize + 'px')
        .attr('fill', textColor);

      // Duration
      const duration = eg
        .append('text')
        .attr('x', 5)
        .attr('y', curr_y + 2.6 * textSize)
        .attr('clip-path', `url(#${clip})`)
        .attr('aria-hidden', 'true')
        .text(seconds_to_duration(app.duration))
        .attr('font-family', 'sans-serif')
        .attr('font-size', textSize - 3 + 'px')
        .attr('fill', durationColor);

      if (inBar) {
        // Inline !important so the theme's generic `svg text` override
        // (dark.css) doesn't repaint text that sits on the bar itself.
        name.style('fill', onBar.name, 'important').style('text-shadow', 'none', 'important');
        duration
          .style('fill', onBar.duration, 'important')
          .style('text-shadow', 'none', 'important');
      }
    }

    curr_y += barHeight + 5;
  });
  curr_y -= 5;

  svg.attr('height', curr_y);

  // Post-render pass: re-read each bar's actual computed fill (CSS may have
  // overridden it, e.g. dark.css recolors uncategorized #CCC bars to #666)
  // and update the in-bar label colours to maintain contrast.
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(() => {
      for (let i = 0; i < apps.length; i++) {
        const group = svg_elem.querySelector(`#summary_${i}`) as SVGGElement | null;
        if (!group) continue;
        const barRect = group.querySelector('rect') as SVGRectElement | null;
        if (!barRect) continue;
        const computedFill = window.getComputedStyle(barRect).fill;
        if (!computedFill) continue;
        let actualHex: string;
        try {
          actualHex = Color(computedFill).hex();
        } catch {
          continue;
        }
        const colors = inBarColors(actualHex);
        const clipInRef = `url(#${chartId}-in-${i})`;
        const inBarTexts = group.querySelectorAll<SVGTextElement>(`text[clip-path="${clipInRef}"]`);
        if (inBarTexts[0]) inBarTexts[0].style.setProperty('fill', colors.name, 'important');
        if (inBarTexts[1]) inBarTexts[1].style.setProperty('fill', colors.duration, 'important');
      }
    });
  }

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
      category: e.data['$category'],
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
