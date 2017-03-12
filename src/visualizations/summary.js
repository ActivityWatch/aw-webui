"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

var time = require("../util/time.js");

var color = Color();
function nextColor() {
  color.values.alpha = color.values.alpha*0.7+0.05
  return color.rgbString()
}

function renderSummary(el, apps) {
  // Reset next color
  color = Color();
  color.hsv(200, 100, 90);
  // Clear element
  el.innerHTML = "";

  let svg = d3.select(el).append("svg");
  svg.attr("width", "100%");

  let g = svg.append("g");

  var curr_y = 0;
  var longest_duration = apps[0].duration
  _.each(apps, function(app, i) {
    let barHeight = 50;
    let textSize = 15;

    // TODO: Expand on click and list titles
    let eg = g.append("g");
    // Color box background
    eg.append("rect")
     .attr("x", 0)
     .attr("y", curr_y)
     .attr("rx", 5)
     .attr("ry", 5)
     .attr("width", (app.duration/longest_duration)*80+"%")
     .attr("height", barHeight)
     .style("fill", nextColor());
    // App name
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + 5 + textSize)
     .text(app.name)
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black");
    // Duration
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

  svg.attr("height", curr_y);

  return svg;
}

module.exports = renderSummary;
