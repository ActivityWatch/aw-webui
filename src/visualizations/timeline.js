"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

var time = require("../util/time.js");

// Whenever a appname is found without a color in this dict, create one and assign
let appname_colors = {};
var color = Color();
color.hsv(0, 60, 100);
function getColor(appname) {
  if(!(appname in appname_colors)) {
    appname_colors[appname] = color.rgbString();
    color.hue(color.hue() + 90);
  }
  return appname_colors[appname];
}

function renderTimeline(el, events, total_duration) {
  // Clear element
  el.innerHTML = "";

  let svg = d3.select(el).append("svg");
  svg.attr("viewBox", "0 0 100 10");

  let g = svg.append("g");
  g.attr("width", "100%");

  let curr_x = 0;
  _.each(events, function(e, i) {
    let eg = g.append("g");
    // TODO: Also render titles when clicked
    eg.append("svg:title")
      .text(  "Appname: " + e.appname + "\n" +
              "Duration: " + time.seconds_to_duration(e.duration) + "\n" +
              "Timestamp: " + e.timestamp);

    var e_width = e.duration / total_duration * 100
    eg.append("rect")
     .attr("x", curr_x)
     .attr("y", 0)
     .attr("width", e_width)
     .attr("height", 10)
     .style("fill", getColor(e.appname));
    curr_x += e_width
  });

  return svg;
}

module.exports = renderTimeline;

