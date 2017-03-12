"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

var time = require("../util/time.js");

var color = Color();
color.hsv(200, 100, 90);
function nextColor() {
  return color.rgbString()
}

function renderSummary(el, apps) {
  // Clear element
  el.innerHTML = "";

  let svg = d3.select(el).append("svg");
  let width = 400;
  svg.attr("width", width+"px");

  let g = svg.append("g");
  g.attr("width","400px")

  var curr_y = 0;
  _.each(apps, function(app, i) {
    let barHeight = 50;
    let textSize = 15;

    let eg = g.append("g");
    // TODO: Also render titles when expanded

    eg.append("rect")
     .attr("x", 0)
     .attr("y", curr_y)
     .attr("width", (app.duration/((86400-28800)%86400))*width+"px")
     .attr("height", barHeight)
     .style("fill", nextColor());
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + 5 + textSize)
     .text(app.name)
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black");
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + 5 + textSize + 5 + textSize)
     .text(time.seconds_to_duration(app.duration))
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black");
    curr_y += barHeight + 5;
  });
  curr_y -= 5;

  // Set so that SVG resizes depending on timeline length
  svg.attr("height", curr_y);

  return svg;
}

module.exports = renderSummary;

