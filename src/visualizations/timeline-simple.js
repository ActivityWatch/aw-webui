"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");
const moment = require("moment");

import color from "../util/color.js";
import coloring_types from "./coloring.js";

var time = require("../util/time.js");

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

function update(svg_el, events, event_type) {
  if(coloring_types[event_type] === undefined) {
    console.log("");
  }
  let coloring = coloring_types[event_type];

  let timeline = d3.select(svg_el);
  timeline.selectAll("*").remove();

  if (events.length <= 0){
    set_status(svg_el, "No data");
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
    let color_key = coloring.key !== undefined ? e.data[coloring.key] : JSON.stringify(e.data);
    if(coloring.colors !== undefined) {
      color_base = coloring.colors[color_key];
    } else {
      // Get one random color per value
      color_base = color.getAppColor(color_key);
    }
    let color_hover = Color(color_base).darken(0.4).hex();

    let x = (timestamp - m_first) / 1000 / total_duration;
    let width = 100 * e.duration / total_duration;

    let eg = timeline.append("g")
      .attr("id", id)
      .attr("transform", "translate(" + 100 * x + "," + 0 + ")");

    let rect = eg.append("rect")
      .attr("width", width)
      .attr("height", 4)
      .style("fill", color_base)
      .on("mouseover", function(d, i, n){
          let elem = n[i];
          elem.style.fill = color_hover;
      })
      .on("mouseout", function(d, i, n){
          let elem = n[i];
          elem.style.fill = color_base;
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
        .text(e.data[coloring.key])
    }
  });

  return svg_el;
}

module.exports = {
  "create": create,
  "update": update,
};
