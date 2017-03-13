"use strict";

const d3 = require("d3");
const Color = require("color");
const _ = require("lodash");

import color from "../util/color.js";

var time = require("../util/time.js");

function renderSummary(el, apps) {
  // Clear element
  el.innerHTML = "";

  let svg = d3.select(el).append("svg");
  svg.attr("width", "100%");

  var curr_y = 0;
  var longest_duration = apps[0].duration
  _.each(apps, function(app, i) {
    // TODO: Expand on click and list titles

    // Variables
    var width = (app.duration/longest_duration)*80+"%";
    let barHeight = 50;
    let textSize = 15;
    var appcolor = color.getAppColor(app.name);
    var hovercolor = Color(appcolor).darken(0.4).rgbString();

    // The group representing an application in the barchart
    let eg = svg.append("g");
    eg.attr("id", "summary_app_"+i)
      .on("mouseover", function() { eg.select("rect").style("fill", hovercolor) })
      .on("mouseout", function() { eg.select("rect").style("fill", appcolor) });

    // Color box background
    eg.append("rect")
     .attr("x", 0)
     .attr("y", curr_y)
     .attr("rx", 5)
     .attr("ry", 5)
     .attr("width", width)
     .attr("height", barHeight)
     .style("fill", appcolor);

    // App name
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + 5 + textSize)
     .text(app.name)
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black")

    // Duration
    eg.append("text")
     .attr("x", 5)
     .attr("y", curr_y + 5 + textSize + 5 + textSize)
     .text(time.seconds_to_duration(app.duration))
     .attr("font-family", "sans-serif")
     .attr("font-size", textSize + "px")
     .attr("fill", "black")

    curr_y += barHeight + 5;
  });
  curr_y -= 5;

  svg.attr("height", curr_y);

  return svg;
}

module.exports = renderSummary;
