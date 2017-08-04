"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");
const moment = require("moment");

import event_parsing from "../util/event_parsing";
import color from "../util/color.js"

var time = require("../util/time.js");

// Helper functions used when hover state changes.
function set_color(elem_id, color) {
  var rect = document.getElementById(elem_id).children[0];
  rect.style.fill = color;
};

function create(svg_el) {
  // Clear element
  svg_el.innerHTML = "";

  // svg for the colored timeline
  let timeline = d3.select(svg_el)
    .attr("viewBox", "0 0 100 4")
    .attr("width", "100%");
}

function set_status(svg_el, text){
  let timeline = d3.select(svg_el);
  timeline.selectAll("*").remove();

  timeline.append("text")
   .attr("x", "0")
   .attr("y", "3")
   .text(text)
   .attr("font-family", "sans-serif")
   .attr("font-size", "2")
   .attr("fill", "black")
}

function update(svg_el, events, options) {
  /*
   * The options object is of the format:
   *   {
   *     "coloring": {
   *        "colors": {string: color},
   *        "key": string
   *     }
   *   }
   */

  if(options.coloring === undefined) {
    options.coloring = {};
  }
  console.log(options);

  let timeline = d3.select(svg_el);
  timeline.selectAll("*").remove();

  if (events.length <= 0){
    set_status(container, "No data");
    return;
  }

  events = _.clone(events);
  _.reverse(events);
  let e_first = _.first(events);
  let e_last = _.last(events);
  let m_first = moment(e_first.timestamp);
  let m_last = moment(e_last.timestamp);
  let total_duration = (m_last - m_first) / 1000 + e_last.duration;
  console.log("First: " + m_first.format());
  console.log("Last: " + m_last.format());
  console.log("Duration: " + total_duration);

  // Iterate over each event and create interval boxes
  _.each(events, function(e, i) {
    let id = "timeline_event_" + i;
    let timestamp = moment(e.timestamp);

    let color_base = undefined;
    let color_key = options.coloring.key !== undefined ? e.data[options.coloring.key] : JSON.stringify(e.data);
    if(options.coloring.colors !== undefined) {
      color_base = options.coloring.colors[color_key];
    } else {
      color_base = color.getAppColor(color_key);
    }

    let x = (timestamp - m_first) / 1000 / total_duration;
    let width = 100 * e.duration / total_duration;

    let eg = timeline.append("g")
      .attr("id", id)
      .attr("transform", "translate(" + 100 * x + "," + 0 + ")");

    let rect = eg.append("rect")
      .attr("width", width)
      .attr("height", 4)
      .style("fill", color_base)
      .on("mouseover", () => {
          let color_hover = Color(color_base).darken(0.4).rgbString();
          set_color(id, color_hover);
      })
      .on("mouseout", () => {
          set_color(id, color_base);
      });

    rect.append("title")
        .text(timestamp.format() + "\n"
            + "Duration: " + time.seconds_to_duration(e.duration) + "\n"
            + JSON.stringify(e.data));

    if(e.duration > 0.05 * total_duration) {
      eg.append("text")
        .attr("font-size", 2)
        .attr("x", 1)
        .attr("y", 2.5)
        .attr("pointer-events", "none")
        .text(e.data[options.coloring.key])
    }
  });

  return svg_el;
}

module.exports = {
  "create": create,
  "update": update,
};
